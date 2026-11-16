-- Catalog checks only. Compare history names and actual IDs against the manifest
-- before this step. Run inside a read-only transaction.
set local plpgsql.check_asserts = on;

do $check$
declare
  v_table text;
  v_proc text;
  v_oid regprocedure;
begin
  foreach v_table in array array[
    'cueva_notification_settings', 'cueva_notification_preferences', 'cueva_notifications',
    'cueva_notification_deliveries', 'cueva_notification_attempts', 'cueva_notification_inbox',
    'cueva_push_subscriptions', 'cueva_notification_runs', 'cueva_notification_audit',
    'cueva_notification_admin_alerts', 'cueva_notification_push_deliveries', 'cueva_notification_push_attempts'
  ] loop
    assert coalesce((select relrowsecurity from pg_class
      where oid = to_regclass(format('public.%I', v_table))), false), 'Missing table or RLS: ' || v_table;
    assert not has_any_column_privilege('anon', format('public.%I', v_table), 'SELECT,INSERT,UPDATE,REFERENCES')
      and not has_table_privilege('anon', format('public.%I', v_table), 'DELETE,TRUNCATE'), 'Anonymous grant: ' || v_table;
  end loop;

  foreach v_table in array array[
    'cueva_notifications', 'cueva_notification_deliveries', 'cueva_notification_attempts',
    'cueva_push_subscriptions', 'cueva_notification_runs',
    'cueva_notification_push_deliveries', 'cueva_notification_push_attempts'
  ] loop
    assert not has_any_column_privilege('authenticated', format('public.%I', v_table), 'SELECT,INSERT,UPDATE,REFERENCES')
      and not has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE,TRUNCATE'), 'Operational grant: ' || v_table;
  end loop;

  foreach v_proc in array array[
    'cueva_notifications_worker_snapshot()', 'cueva_claim_notification_deliveries(integer,integer)',
    'cueva_finalize_notification_delivery(uuid,uuid,text,text,text)',
    'cueva_mark_notification_delivery_started(uuid,uuid)',
    'cueva_claim_notification_push_delivery(uuid,uuid,uuid,integer)',
    'cueva_mark_notification_push_started(uuid,uuid,uuid,uuid)',
    'cueva_finalize_notification_push_delivery(uuid,uuid,text,text,text)',
    'cueva_create_notification_inbox_guarded(uuid,uuid,uuid,uuid,text,text,bigint)',
    'cueva_mark_notification_delivery_started_with_balance(uuid,uuid)',
    'cueva_mark_notification_push_started_with_balance(uuid,uuid,uuid,uuid)'
  ] loop
    v_oid := to_regprocedure('public.' || v_proc);
    assert v_oid is not null, 'Missing worker RPC: ' || v_proc;
    assert has_function_privilege('service_role', v_oid::oid, 'EXECUTE')
      and not has_function_privilege('anon', v_oid::oid, 'EXECUTE')
      and not has_function_privilege('authenticated', v_oid::oid, 'EXECUTE'), 'Worker RPC grants: ' || v_proc;
  end loop;

  assert has_column_privilege('authenticated', 'public.cueva_notification_inbox', 'read_at', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.cueva_notification_inbox', 'user_id', 'UPDATE'),
    'Inbox read-state grant changed';
  assert (select count(*) from pg_policies where schemaname = 'public'
    and tablename = 'cueva_notification_inbox'
    and policyname in ('cueva_notification_inbox_read_own', 'cueva_notification_inbox_update_own')) = 2,
    'Inbox ownership policies missing';
  assert (select count(*) from public.cueva_notification_settings
    where send_time = time '12:00' and timezone = 'America/Argentina/Buenos_Aires') = 1,
    'Initial schedule mismatch';
end
$check$;

select 'PASS' as cueva_005_schema_postflight;
