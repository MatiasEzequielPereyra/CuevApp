-- Operator only. Disable this job without deleting execution history.
begin;

do $stop$
declare
  v_job_id bigint;
begin
  perform pg_advisory_xact_lock(505005001);
  select jobid into strict v_job_id
  from cron.job
  where jobname = 'cueva-notifications-worker' and database = current_database();
  perform cron.alter_job(v_job_id, active := false);
  if exists (select 1 from cron.job where jobid = v_job_id and active) then
    raise exception 'CUEVA notification job is still active';
  end if;
end
$stop$;

commit;
