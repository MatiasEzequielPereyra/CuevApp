-- Hosted-schema compatibility contract for CUEVA-005.
-- Snapshot source: read-only catalog inspection of CuevApp Supabase Hosted on
-- 2026-11-13. This fixture intentionally contains no production data.
-- It validates the deployed pre-notifications schema contract after replaying
-- the repository's historical baseline migrations in an isolated local stack.

do $$
declare
  required_column record;
  required_columns constant text[][] := array[
    array['cueva_students', 'id'],
    array['cueva_students', 'first_name'],
    array['cueva_students', 'last_name'],
    array['cueva_students', 'email'],
    array['cueva_students', 'joined_on'],
    array['cueva_students', 'active'],
    array['cueva_periods', 'id'],
    array['cueva_periods', 'student_id'],
    array['cueva_periods', 'month'],
    array['cueva_periods', 'due_on'],
    array['cueva_periods', 'cents'],
    array['cueva_periods', 'price_id'],
    array['cueva_payments', 'id'],
    array['cueva_payments', 'period_id'],
    array['cueva_payments', 'cents'],
    array['cueva_payments', 'paid_on'],
    array['cueva_reversals', 'payment_id'],
    array['cueva_profiles', 'user_id'],
    array['cueva_profiles', 'role'],
    array['cueva_student_invitations', 'student_id'],
    array['cueva_student_invitations', 'user_id'],
    array['cueva_due_schedules', 'student_id'],
    array['cueva_due_schedules', 'due_day'],
    array['cueva_due_date_audit', 'student_id'],
    array['cueva_payment_receipts', 'period_id']
  ];
  protected_table text;
begin
  assert to_regnamespace('cueva_private') is not null,
    'missing cueva_private schema';
  assert to_regclass('public.cueva_prices') is not null,
    'missing cueva_prices dependency';

  foreach required_column slice 1 in array required_columns loop
    assert exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = required_column[1]
        and c.column_name = required_column[2]
    ), format('missing required column public.%s.%s',
      required_column[1], required_column[2]);
  end loop;

  assert to_regprocedure('cueva_private.ready_for_current_session()') is not null,
    'missing current-session authorization function';
  assert to_regprocedure('cueva_private.billing_admin()') is not null,
    'missing billing administrator authorization function';
  assert to_regprocedure('cueva_private.receipt_student()') is not null,
    'missing receipt student authorization function';

  assert exists (
    select 1 from pg_constraint
    where conrelid = 'public.cueva_periods'::regclass
      and conname = 'cueva_periods_student_id_month_key'
      and contype = 'u'
  ), 'period student/month uniqueness contract changed';
  assert exists (
    select 1 from pg_constraint
    where conrelid = 'public.cueva_reversals'::regclass
      and conname = 'cueva_reversals_payment_id_key'
      and contype = 'u'
  ), 'payment reversal uniqueness contract changed';

  foreach protected_table in array array[
    'cueva_students',
    'cueva_periods',
    'cueva_payments',
    'cueva_reversals',
    'cueva_profiles',
    'cueva_student_invitations',
    'cueva_due_schedules',
    'cueva_due_date_audit',
    'cueva_payment_receipts'
  ] loop
    assert coalesce((
      select c.relrowsecurity
      from pg_class c
      where c.oid = format('public.%I', protected_table)::regclass
    ), false), format('RLS is not enabled on public.%s', protected_table);
  end loop;

  assert exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cueva_due_schedules'
      and policyname = 'due_schedules_admin_read'
  ), 'missing due-schedule administrator read policy';
  assert exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cueva_due_date_audit'
      and policyname = 'due_date_audit_admin_read'
  ), 'missing due-date audit administrator read policy';

  assert to_regclass('public.cueva_notifications') is null,
    'notification schema already exists before CUEVA-005 migrations';
  assert to_regclass('public.cueva_notification_deliveries') is null,
    'notification delivery table already exists before CUEVA-005 migrations';
end;
$$;
