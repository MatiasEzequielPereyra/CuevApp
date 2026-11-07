\set ON_ERROR_STOP on
set plpgsql.check_asserts = on;

-- Synthetic fixtures in an isolated Supabase database only. Seed before the
-- upgrade in that job and after a full migration run in the fresh job.
create function pg_temp.fixture_id(label text) returns uuid
language sql immutable as $$ select md5('003b-receipts:' || label)::uuid $$;
create function pg_temp.fixture_month() returns date
language sql stable as $$ select date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date $$;
create function pg_temp.fixture_today() returns date
language sql stable as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;
create function pg_temp.fixture_admin() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', pg_temp.fixture_id('admin')::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', pg_temp.fixture_id('admin'), 'role', 'authenticated', 'session_id', pg_temp.fixture_id('session')
  )::text, true);
end $$;

begin;
\if :seed
insert into auth.users(id,aud,role,email,created_at,updated_at)
values (pg_temp.fixture_id('admin'),'authenticated','authenticated','003b-ledger-admin@example.test',now(),now()),
       (pg_temp.fixture_id('member'),'authenticated','authenticated','003b-ledger-member@example.test',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at)
values (pg_temp.fixture_id('session'),pg_temp.fixture_id('admin'),now(),now());
insert into public.cueva_profiles(user_id,role)
values (pg_temp.fixture_id('admin'),'admin'), (pg_temp.fixture_id('member'),'alumno');
insert into cueva_private.access_state(user_id,ready,session_not_before)
values (pg_temp.fixture_id('admin'),true,now()-interval '1 minute');
insert into public.cueva_students(id,first_name,last_name,email,joined_on)
values (pg_temp.fixture_id('student'),'Fixture','Comprobantes','003b-ledger-member@example.test',date '2020-01-31');
insert into public.cueva_prices(id,effective_month,cents,actor)
values (pg_temp.fixture_id('price'),date '2020-01-01',10000,pg_temp.fixture_id('admin'));
insert into public.cueva_periods(id,student_id,month,due_on,cents,price_id,actor)
select pg_temp.fixture_id('period-' || label),pg_temp.fixture_id('student'),month,month+10,
  10000,pg_temp.fixture_id('price'),pg_temp.fixture_id('admin')
from (values ('current',pg_temp.fixture_month()),('history',(pg_temp.fixture_month()-interval '1 month')::date)) as periods(label,month);
-- The separate Storage workflow covers signed uploads and file bytes. Here
-- we start at the persisted pending receipt consumed by the review RPC.
insert into public.cueva_payment_receipts(id,student_id,period_id,submitted_by,object_path,media_type,file_size,file_hash)
select pg_temp.fixture_id('receipt-' || label),pg_temp.fixture_id('student'),pg_temp.fixture_id('period-' || label),
  pg_temp.fixture_id('member'),'fixture/' || label || '.pdf','application/pdf',128,repeat('a',64)
from (values ('current'),('history')) as receipts(label);

select pg_temp.fixture_admin();
set local role authenticated;
do $$
begin
  assert public.cueva_receipt_review(pg_temp.fixture_id('receipt-history'),pg_temp.fixture_id('pay-history'),
    'approve','4000',pg_temp.fixture_today(),'credito',null,null) = 'approved', 'historical receipt approved during fixture setup';
end $$;
commit;
\echo PASS: seeded an approved receipt with a 4000-cent credit payment and a pending receipt.
\else
do $$
begin
  assert (select due_on = pg_temp.fixture_month()+10 from public.cueva_periods where id=pg_temp.fixture_id('period-current')),
    'migration leaves the existing due date intact';
  assert (select state = 'pending' and payment_id is null from public.cueva_payment_receipts where id=pg_temp.fixture_id('receipt-current')),
    'existing receipt is still pending';
  assert exists (
    select 1 from public.cueva_payment_receipts r join public.cueva_payments p on p.id=r.payment_id
    join cueva_private.billing_operations op on op.id=p.id
    where r.id=pg_temp.fixture_id('receipt-history') and r.state='approved'
      and p.cents=4000 and p.method='credito' and op.payload->>'receipt_id'=r.id::text
  ), 'historical receipt, payment, and ledger payload survive';
end $$;

select pg_temp.fixture_admin();
set local role authenticated;
do $$
declare
  due_payload jsonb := jsonb_build_object('kind','due_day','student_id',pg_temp.fixture_id('student'),
    'due_day','20','expected_old_due_day','31','effective_month',to_char(pg_temp.fixture_month(),'YYYY-MM'),
    'scope','current_period','confirm_current_period',true,'reason','Integrated migration fixture');
begin
  assert public.cueva_billing_write(pg_temp.fixture_id('change-due'),due_payload) = pg_temp.fixture_id('change-due'),
    'admin can change the current due date';
  assert public.cueva_billing_write(pg_temp.fixture_id('change-due'),due_payload) = pg_temp.fixture_id('change-due'),
    'due date retry is idempotent';
  assert (select due_on = pg_temp.fixture_month()+19 from public.cueva_periods where id=pg_temp.fixture_id('period-current')),
    'due date updated to the 20th';
  assert public.cueva_receipt_review(pg_temp.fixture_id('receipt-current'),pg_temp.fixture_id('pay-current'),
    'approve','10000',pg_temp.fixture_today(),'debito',null,null) = 'approved', 'pending receipt uses updated ledger';
  assert public.cueva_receipt_review(pg_temp.fixture_id('receipt-current'),pg_temp.fixture_id('pay-current'),
    'approve','10000',pg_temp.fixture_today(),'debito',null,null) = 'approved', 'approval retry is idempotent';
end $$;
reset role;

do $$
begin
  assert exists (
    select 1 from public.cueva_payment_receipts r join public.cueva_payments p on p.id=r.payment_id
    join cueva_private.billing_operations op on op.id=p.id
    where r.id=pg_temp.fixture_id('receipt-current') and r.state='approved' and r.resolved_by=pg_temp.fixture_id('admin')
      and p.cents=10000 and p.method='debito' and p.actor=pg_temp.fixture_id('admin')
      and p.period_id=pg_temp.fixture_id('period-current') and op.payload->>'receipt_id'=r.id::text
  ), 'approved receipt, payment, actor, and ledger payload agree';
  assert (select count(*) from public.cueva_payments where period_id=pg_temp.fixture_id('period-current'))=1,
    'one payment after replay';
  assert (select count(*) from public.cueva_due_date_audit
    where student_id=pg_temp.fixture_id('student') and old_due_day=31 and new_due_day=20
      and actor=pg_temp.fixture_id('admin'))=1, 'one due date audit event after replay';
  assert (select due_on = pg_temp.fixture_month()+19 and cents=10000 from public.cueva_periods where id=pg_temp.fixture_id('period-current')),
    'payment preserves the revised due date and original price';
  assert (select due_on = (pg_temp.fixture_month()-interval '1 month')::date+10
    from public.cueva_periods where id=pg_temp.fixture_id('period-history')), 'historical due date is unchanged';
end $$;
commit;
\echo PASS: existing receipt and payment history preserved, current due date changed with one audit event, pending receipt approved by the updated ledger with one payment.
\endif
