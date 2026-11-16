-- Operator only, after isolated delivery and infrastructure approval.
-- Load Vault values privately before executing. This file contains no secret.
begin;

do $install$
declare
  v_job_id bigint;
begin
  perform pg_advisory_xact_lock(505005001);
  if exists (
    select 1 from cron.job
    where jobname = 'cueva-notifications-worker'
       or position('/api/notifications/worker' in command) > 0
       or position('cueva_notifications_worker_secret' in command) > 0
  ) then
    raise exception 'CUEVA notification job already exists or overlaps';
  end if;
  if (select count(*) from vault.decrypted_secrets where name = 'cueva_notifications_worker_url') <> 1
     or (select count(*) from vault.decrypted_secrets where name = 'cueva_notifications_worker_secret') <> 1
     or not exists (
       select 1 from vault.decrypted_secrets
       where name = 'cueva_notifications_worker_url'
         and decrypted_secret = 'https://cueva-gym.vercel.app/api/notifications/worker'
     )
     or not exists (
       select 1 from vault.decrypted_secrets
       where name = 'cueva_notifications_worker_secret'
         and length(decrypted_secret) >= 32 and decrypted_secret !~ '[[:space:][:cntrl:]]'
     ) then
    raise exception 'CUEVA notification Vault configuration invalid';
  end if;
  if exists (
    select 1 from unnest(array['anon', 'authenticated']) as api(role_name)
    where has_any_column_privilege(api.role_name, 'net.http_request_queue', 'SELECT,INSERT,UPDATE,REFERENCES')
       or has_table_privilege(api.role_name, 'net.http_request_queue', 'DELETE,TRUNCATE,TRIGGER')
       or has_any_column_privilege(api.role_name, 'vault.decrypted_secrets', 'SELECT')
  ) then
    raise exception 'CUEVA notification credentials or queue accessible to API roles';
  end if;

  v_job_id := cron.schedule('cueva-notifications-worker', '*/5 * * * *', $command$
    do $dispatch$
    declare
      v_url text;
      v_secret text;
      v_request_id bigint;
    begin
      select decrypted_secret into strict v_url
      from vault.decrypted_secrets where name = 'cueva_notifications_worker_url';
      select decrypted_secret into strict v_secret
      from vault.decrypted_secrets where name = 'cueva_notifications_worker_secret';
      if v_url is distinct from 'https://cueva-gym.vercel.app/api/notifications/worker'
         or v_secret is null or length(v_secret) < 32 or v_secret ~ '[[:space:][:cntrl:]]' then
        raise exception 'CUEVA notification Vault configuration invalid';
      end if;
      v_request_id := net.http_post(
        url := v_url,
        body := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
        timeout_milliseconds := 65000
      );
      raise log 'CUEVA notification dispatch pg_net request_id=%', v_request_id;
    end
    $dispatch$;
  $command$);
  if not exists (
    select 1 from cron.job where jobid = v_job_id
      and jobname = 'cueva-notifications-worker' and active
      and schedule = '*/5 * * * *' and database = current_database()
  ) then
    raise exception 'CUEVA notification job metadata mismatch';
  end if;
end
$install$;

commit;
