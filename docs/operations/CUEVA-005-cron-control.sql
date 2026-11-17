-- psql -v cueva_operation=activate|stop|resume -v cueva_job_id=ID -f this-file
-- Use ID 0 for activate. Preserve the returned job ID in the rollout record.
\set ON_ERROR_STOP on
begin;
select set_config('cueva_005.operation', :'cueva_operation', true) as operation,
       set_config('cueva_005.job_id', :'cueva_job_id', true) as job_id \gset

do $control$
declare
  v_operation text := current_setting('cueva_005.operation');
  v_job_id bigint := current_setting('cueva_005.job_id')::bigint;
  v_name constant text := 'cueva-notifications-worker';
  v_schedule constant text := '*/5 * * * *';
  v_url constant text := 'https://cueva-gym.vercel.app/api/notifications/worker';
  v_command constant text := format($command$
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
      if v_url is distinct from %L
         or v_secret is null or length(v_secret) < 32 or v_secret ~ '[[:space:][:cntrl:]]' then
        raise exception 'CUEVA notification Vault configuration invalid';
      end if;
      v_request_id := net.http_post(
        url := v_url,
        body := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
        timeout_milliseconds := 65000
      );
      raise log 'CUEVA notification dispatch pg_net request_id=%%', v_request_id;
    end
    $dispatch$;
  $command$, v_url);
  v_job cron.job%rowtype;
begin
  perform pg_advisory_xact_lock(505005001);
  if v_operation not in ('activate', 'stop', 'resume')
     or (v_operation = 'activate' and v_job_id <> 0)
     or (v_operation <> 'activate' and v_job_id <= 0) then
    raise exception 'CUEVA notification operation or job ID invalid';
  end if;

  if v_operation <> 'activate' then
    select * into v_job from cron.job where jobid = v_job_id;
    if not found or v_job.jobname is distinct from v_name
       or v_job.database is distinct from current_database()
       or v_job.username is distinct from current_user then
      raise exception 'CUEVA notification job identity mismatch';
    end if;
  end if;

  if v_operation <> 'stop' then
    if exists (
      select 1 from cron.job
      where jobid <> v_job_id and (
        jobname = v_name or position('/api/notifications/worker' in command) > 0
        or position('cueva_notifications_worker_secret' in command) > 0
      )
    ) then
      raise exception 'CUEVA notification job already exists or overlaps';
    end if;

    if exists (
      select 1 from unnest(array['anon', 'authenticated']) as api(role_name)
      where has_any_column_privilege(api.role_name, 'net.http_request_queue', 'SELECT,INSERT,UPDATE,REFERENCES')
         or has_table_privilege(api.role_name, 'net.http_request_queue', 'DELETE,TRUNCATE,TRIGGER,MAINTAIN')
         or has_any_column_privilege(api.role_name, 'vault.decrypted_secrets', 'SELECT')
    ) then
      raise exception 'CUEVA notification credentials or queue accessible to API roles';
    end if;

    if (select count(*) from vault.decrypted_secrets where name = 'cueva_notifications_worker_url') <> 1
       or (select count(*) from vault.decrypted_secrets where name = 'cueva_notifications_worker_secret') <> 1
       or not exists (
         select 1 from vault.decrypted_secrets
         where name = 'cueva_notifications_worker_url' and decrypted_secret = v_url
       )
       or not exists (
         select 1 from vault.decrypted_secrets
         where name = 'cueva_notifications_worker_secret'
           and length(decrypted_secret) >= 32 and decrypted_secret !~ '[[:space:][:cntrl:]]'
       ) then
      raise exception 'CUEVA notification Vault configuration invalid';
    end if;

    if v_operation = 'resume' and (
      v_job.active or v_job.schedule is distinct from v_schedule or v_job.command is distinct from v_command
      or v_job.nodename is distinct from 'localhost' or v_job.nodeport is distinct from current_setting('port')::integer
    ) then
      raise exception 'CUEVA notification job cannot resume with changed metadata or while active';
    end if;

    -- Capability check as the actual cron role. Roll back the queue insert inside the exception block.
    begin
      perform net.http_post('http://127.0.0.1:1/cueva-unused-queue-probe');
      raise sqlstate 'CV005';
    exception when sqlstate 'CV005' then
      null;
    end;
  end if;

  if v_operation = 'activate' then
    v_job_id := cron.schedule(v_name, v_schedule, v_command);
  else
    perform cron.alter_job(v_job_id, active := v_operation = 'resume');
  end if;

  select * into v_job from cron.job where jobid = v_job_id;
  if not found or v_job.jobname is distinct from v_name
     or v_job.database is distinct from current_database() or v_job.username is distinct from current_user
     or v_job.active is distinct from (v_operation <> 'stop')
     or (v_operation <> 'stop' and (
       v_job.schedule is distinct from v_schedule or v_job.command is distinct from v_command
       or v_job.nodename is distinct from 'localhost' or v_job.nodeport is distinct from current_setting('port')::integer
     )) then
    raise exception 'CUEVA notification job metadata mismatch';
  end if;
  perform set_config('cueva_005.job_id', v_job_id::text, true);
end
$control$;

select jobid, jobname, schedule, active, username, database from cron.job
where jobid = current_setting('cueva_005.job_id')::bigint;
commit;
