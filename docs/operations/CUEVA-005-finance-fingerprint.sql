-- Compare read-only before and after. No business data in the result.
select
  encode(sha256(convert_to(pg_get_functiondef('cueva_private.billing_write(uuid,jsonb)'::regprocedure), 'UTF8')), 'hex') as billing_writer,
  encode(sha256(convert_to(pg_get_functiondef('public.cueva_billing_write(uuid,jsonb)'::regprocedure), 'UTF8')), 'hex') as billing_wrapper,
  encode(sha256(convert_to((
    select jsonb_agg(to_jsonb(p) order by tablename, policyname)::text
    from pg_policies p
    where schemaname = 'public'
      and tablename in ('cueva_due_schedules', 'cueva_due_date_audit', 'cueva_payment_receipts')
  ), 'UTF8')), 'hex') as protected_policies,
  strpos(regexp_replace(pg_get_functiondef('cueva_private.billing_write(uuid,jsonb)'::regprocedure),
    '[[:space:]]', '', 'g'), 'pg_advisory_xact_lock(903004001)') > 0 as shared_payment_lock;
