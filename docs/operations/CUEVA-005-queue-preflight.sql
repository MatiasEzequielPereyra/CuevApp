-- psql -v cueva_queue_mode=check|restrict -v cueva_cron_role=ROLE -f this-file
-- Operator only. Run before loading the worker secret in Vault.
\set ON_ERROR_STOP on
begin;
select set_config('cueva_005.queue_mode', :'cueva_queue_mode', true) as queue_mode,
       set_config('cueva_005.cron_role', :'cueva_cron_role', true) as cron_role \gset

do $preflight$
declare
  v_mode text := current_setting('cueva_005.queue_mode');
  v_role oid;
  v_queue regclass := 'net.http_request_queue'::regclass;
  v_post regprocedure := 'net.http_post(text,jsonb,jsonb,jsonb,integer)'::regprocedure;
  v_writer oid;
  v_writer_name name;
  v_inserted text[] := array['method', 'url', 'headers', 'body', 'timeout_milliseconds'];
  v_columns text;
begin
  select oid into v_role from pg_roles where rolname = current_setting('cueva_005.cron_role');
  if v_mode not in ('check', 'restrict') or v_role is null
     or v_role in ('anon'::regrole, 'authenticated'::regrole) then
    raise exception 'CUEVA queue mode or cron role invalid';
  end if;

  -- pg_net inserts these columns, obtains the generated ID and wakes its worker.
  select case when prosecdef then proowner else v_role end into strict v_writer
  from pg_proc where oid = v_post;
  if not has_schema_privilege(v_role, 'net', 'USAGE') or not has_function_privilege(v_role, v_post, 'EXECUTE')
     or not has_function_privilege(v_writer, 'net.wake()', 'EXECUTE')
     or not has_column_privilege(v_writer, v_queue, 'id', 'SELECT')
     or not has_sequence_privilege(v_writer, pg_get_serial_sequence('net.http_request_queue', 'id'), 'USAGE,UPDATE')
     or exists (
       select 1 from unnest(v_inserted) as inserted(column_name)
       where not has_column_privilege(v_writer, v_queue, inserted.column_name, 'INSERT')
     ) then
    raise exception 'CUEVA cron role cannot enqueue with pg_net';
  end if;

  if v_mode = 'restrict' then
    select rolname into strict v_writer_name from pg_roles where oid = v_writer;
    revoke all privileges on table net.http_request_queue from public, anon, authenticated restrict;
    select string_agg(quote_ident(attname), ', ' order by attnum) into strict v_columns
    from pg_attribute where attrelid = v_queue and attnum > 0 and not attisdropped;
    execute format(
      'revoke all privileges (%s) on table net.http_request_queue from public, anon, authenticated restrict',
      v_columns
    );

    -- Preserve only the queue privileges the existing pg_net writer just lost.
    if not has_column_privilege(v_writer, v_queue, 'id', 'SELECT') then
      execute format('grant select (id) on net.http_request_queue to %I', v_writer_name);
    end if;
    select string_agg(quote_ident(column_name), ', ' order by column_name) into v_columns
    from unnest(v_inserted) as inserted(column_name)
    where not has_column_privilege(v_writer, v_queue, column_name, 'INSERT');
    if v_columns is not null then
      execute format('grant insert (%s) on net.http_request_queue to %I', v_columns, v_writer_name);
    end if;
  end if;

  if exists (
    select 1 from unnest(array['anon', 'authenticated']) as api(role_name)
    where has_any_column_privilege(api.role_name, v_queue, 'SELECT,INSERT,UPDATE,REFERENCES')
       or has_table_privilege(api.role_name, v_queue, 'DELETE,TRUNCATE,TRIGGER,MAINTAIN')
  ) then
    raise exception 'CUEVA queue accessible to API roles';
  end if;

end
$preflight$;

-- The worker cannot see this row without a commit. The probe uses no secret.
savepoint cueva_queue_probe;
set local role :"cueva_cron_role";
do $probe$
begin
  perform net.http_post('http://127.0.0.1:1/cueva-unused-queue-probe');
end
$probe$;
rollback to savepoint cueva_queue_probe;

commit;
select 'PASS' as cueva_005_queue_preflight, :'cueva_cron_role' as cron_role;
