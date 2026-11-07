\set ON_ERROR_STOP on

-- Run after membership.sql on the same disposable PostgreSQL instance.
-- Model the Storage metadata/grants here. File bytes and HTTP are tested separately.
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean not null,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (bucket_id text references storage.buckets(id), name text, primary key(bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon, service_role;
grant select, insert, update, delete on storage.objects to authenticated, anon;
\ir ../migrations/20261107100100_cueva_payment_receipts.sql

begin;
insert into auth.users (id) select md5(k)::uuid from unnest(array['receipt-a','receipt-b','receipt-admin']) as keys(k);
insert into auth.sessions select md5(id::text || '-session')::uuid, id, now() from auth.users;
insert into cueva_private.access_state (user_id,ready,session_not_before)
select id,true,now() from auth.users;
insert into public.cueva_profiles
select id, case when id = md5('receipt-admin')::uuid then 'admin' else 'alumno' end from auth.users;

insert into public.cueva_students (id,first_name,last_name,email,joined_on,active)
values (md5('receipt-student-a')::uuid,'Ficha','A','a@example.test','2026-01-01',true),
       (md5('receipt-student-b')::uuid,'Ficha','B','b@example.test','2026-01-01',true);
insert into public.cueva_student_invitations (student_id,email,user_id,state,lease,requested_by)
select md5('receipt-student-' || k)::uuid,k || '@example.test',md5('receipt-' || k)::uuid,'sent',gen_random_uuid(),md5('receipt-admin')::uuid
from unnest(array['a','b']) as keys(k);
insert into public.cueva_prices (id,effective_month,cents,actor)
values (md5('receipt-price')::uuid,'2026-01-01',10000,md5('receipt-admin')::uuid);
insert into public.cueva_periods (id,student_id,month,due_on,cents,price_id,actor)
select md5('receipt-period-' || k)::uuid,md5('receipt-student-' || owner)::uuid,
  (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') + delta)::date,
  (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') + delta + interval '10 days')::date,
  10000,md5('receipt-price')::uuid,md5('receipt-admin')::uuid
from (values ('a','a',interval '0 month'),('settle','a',interval '-1 month'),
  ('race','a',interval '-2 month'),('b','b',interval '0 month')) as periods(k,owner,delta);

insert into storage.objects (bucket_id,name)
select 'cueva-payment-receipts',
  md5('receipt-a')::uuid::text || '/' || md5('receipt-period-' || period)::uuid::text || '/' ||
  md5('receipt-file-' || file)::uuid::text || '.png'
from (values ('a','partial'),('a','reject'),('a','full'),('settle','settle'),('race','race1'),('race','race2')) as fixtures(period,file);
commit;

set plpgsql.check_asserts = on;
-- Reusable claims for the actual role/session gates.
create function pg_temp.claims(k text) returns text language sql as $$
  select jsonb_build_object('sub',md5(k)::uuid,'session_id',md5(md5(k)::uuid::text || '-session')::uuid)::text
$$;
create function pg_temp.submit_sql(period text, file text) returns text language sql as $$
  select format('select public.cueva_receipt_submit(%L,%L,%L,%L,%L,16,%L)',
    md5('receipt-a')::uuid, md5(md5('receipt-a')::uuid::text || '-session')::uuid,
    md5('receipt-period-' || period)::uuid, md5('receipt-file-' || file)::uuid, 'image/png', repeat('a',64))
$$;

begin;
set local role service_role;
do $$
declare submitted uuid;
begin
  execute pg_temp.submit_sql('a','partial') into submitted;
  assert submitted = md5('receipt-file-partial')::uuid, 'submitted receipt';
  execute pg_temp.submit_sql('a','partial') into submitted;
  assert submitted = md5('receipt-file-partial')::uuid, 'identical retry returns same receipt';
  begin
    execute pg_temp.submit_sql('a','full');
    raise exception 'duplicate pending accepted';
  exception when unique_violation then null;
  end;
  begin
    perform public.cueva_receipt_submit(md5('receipt-a')::uuid,gen_random_uuid(),
      md5('receipt-period-a')::uuid,md5('receipt-file-partial')::uuid,'image/png',16,repeat('a',64));
    raise exception 'invalid session accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    execute pg_temp.submit_sql('settle','missing');
    raise exception 'missing object accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claims',pg_temp.claims('receipt-a'),true);
do $$
begin
  assert (select count(id) from public.cueva_payment_receipts) = 1, 'same operation creates one receipt';
  assert public.cueva_membership_snapshot() #>> '{current,balance}' = '10000', 'pending does not credit money';
  assert (select count(*) from storage.objects) = 1, 'staged objects remain unreadable';
  begin
    perform public.cueva_receipt_submit(md5('receipt-a')::uuid,gen_random_uuid(),
      md5('receipt-period-a')::uuid,gen_random_uuid(),'image/png',16,repeat('a',64));
    raise exception 'student bypassed byte validation';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects values ('cueva-payment-receipts','direct-write');
    raise exception 'student bypassed signed upload';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cueva_receipt_review(md5('receipt-file-partial')::uuid,gen_random_uuid(),
      'approve','4000',current_date,'transferencia',null,null);
    raise exception 'student approved own receipt';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims',pg_temp.claims('receipt-b'),true);
do $$
begin
  assert not exists (select id from public.cueva_payment_receipts), 'other member receipt hidden';
  assert not exists (select 1 from storage.objects), 'other member file hidden';
  assert not (public.cueva_receipt_periods()::text like '%' || md5('receipt-period-a')::uuid::text || '%'), 'other member period hidden';
  begin
    perform public.cueva_receipt_prepare(md5('receipt-period-a')::uuid,gen_random_uuid(),'image/png',16,repeat('a',64));
    raise exception 'cross-member upload accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role anon;
do $$
begin
  assert not exists (select 1 from storage.objects), 'anonymous file hidden';
  begin
    perform public.cueva_receipt_periods();
    raise exception 'anonymous metadata access';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claims',pg_temp.claims('receipt-admin'),true);
do $$
declare
  receipt uuid := md5('receipt-file-partial')::uuid;
  op uuid := md5('receipt-payment-partial')::uuid;
  today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  assert (select count(*) from storage.objects) = 1, 'admin can open associated file';
  assert public.cueva_receipt_review(receipt,op,'approve','4000',today,'debito',null,null) = 'approved', 'partial approval';
  assert public.cueva_receipt_review(receipt,op,'approve','4000',today,'debito',null,null) = 'approved', 'approval retry';
  assert (select count(*) from public.cueva_payments) = 1, 'one payment after approval retry';
  assert (select cents from public.cueva_payments where id=op) = 4000, 'exact cents';
  assert (select payment_id from public.cueva_payment_receipts where id=receipt) = op, 'receipt links to real payment';
  begin
    perform public.cueva_receipt_review(receipt,op,'approve','4001',today,'debito',null,null);
    raise exception 'changed approval retry accepted';
  exception when serialization_failure then null;
  end;
end $$;

set local role service_role;
do $$ begin execute pg_temp.submit_sql('a','reject'); end $$;
set local role authenticated;
do $$
declare receipt uuid := md5('receipt-file-reject')::uuid;
begin
  assert public.cueva_receipt_review(receipt,md5('receipt-rejection')::uuid,'reject',null,null,null,null,'No se lee la fecha') = 'rejected', 'reject';
  assert public.cueva_receipt_review(receipt,md5('receipt-rejection')::uuid,'reject',null,null,null,null,'No se lee la fecha') = 'rejected', 'reject retry';
  assert (select count(*) from public.cueva_payments) = 1, 'reject never credits';
end $$;

select set_config('request.jwt.claims',pg_temp.claims('receipt-a'),true);
do $$ begin
  assert (select rejection_reason from public.cueva_payment_receipts where id=md5('receipt-file-reject')::uuid)
    = 'No se lee la fecha', 'rejection reason visible to owner';
  assert public.cueva_membership_snapshot() #>> '{current,balance}' = '6000', 'partial balance exact';
end $$;

set local role service_role;
do $$ begin execute pg_temp.submit_sql('a','full'); execute pg_temp.submit_sql('settle','settle'); end $$;
set local role authenticated;
select set_config('request.jwt.claims',pg_temp.claims('receipt-admin'),true);
do $$
declare
  receipt uuid := md5('receipt-file-full')::uuid;
  op uuid := md5('receipt-payment-full')::uuid;
  today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  begin
    perform public.cueva_receipt_review(receipt,op,'approve','6001',today,'credito',null,null);
    raise exception 'overpayment accepted' using errcode='XX000';
  exception when raise_exception then null;
  end;
  assert (select state from public.cueva_payment_receipts where id=receipt) = 'pending', 'failed approval rolls back';
  begin
    perform public.cueva_receipt_review(receipt,op,'approve','6000',today,'otro',null,null);
    raise exception 'missing other method detail accepted';
  exception when invalid_parameter_value then null;
  end;
  assert public.cueva_receipt_review(receipt,op,'approve','6000',today,'otro','Billetera',null) = 'approved', 'full approval';
  assert (select count(*) from public.cueva_payments) = 2, 'two approved receipts, two payments';
  perform public.cueva_billing_write(md5('receipt-manual-payment')::uuid,jsonb_build_object('kind','payment',
    'student_id',md5('receipt-student-a')::uuid,'period_id',md5('receipt-period-settle')::uuid,
    'cents','10000','paid_on',today,'method','transferencia'));
  assert (select state from public.cueva_payment_receipts where id=md5('receipt-file-settle')::uuid) = 'superseded', 'manual settlement closes pending receipt';
  assert public.cueva_receipt_review(md5('receipt-file-settle')::uuid,gen_random_uuid(),'approve','10000',today,'efectivo',null,null) = 'superseded', 'late review remains without effect';
  assert (select count(*) from public.cueva_payments) = 3, 'late approval creates no extra payment';
end $$;
select set_config('request.jwt.claims',pg_temp.claims('receipt-a'),true);
do $$ begin
  assert public.cueva_membership_snapshot() #>> '{current,balance}' = '0', 'paid balance exact';
  begin
    perform public.cueva_receipt_prepare(md5('receipt-period-a')::uuid,gen_random_uuid(),'image/png',16,repeat('a',64));
    raise exception 'paid period accepted' using errcode='XX000';
  exception when raise_exception then null;
  end;
end $$;
commit;

-- Run two actual concurrent sessions after the fixtures are visible to both.
create extension dblink;
select dblink_connect('receipt_one','dbname=' || current_database());
select dblink_connect('receipt_two','dbname=' || current_database());
select dblink_exec('receipt_one','set role service_role');
select dblink_exec('receipt_two','set role service_role');
begin;
select pg_advisory_xact_lock(903004001);
select dblink_send_query('receipt_one',pg_temp.submit_sql('race','race1'));
select dblink_send_query('receipt_two',pg_temp.submit_sql('race','race2'));
commit;
create temp table receipt_race_results as
  select * from dblink_get_result('receipt_one',false) as result(id uuid)
  union all select * from dblink_get_result('receipt_two',false) as result(id uuid);
do $$ begin
  assert (select count(*) from receipt_race_results) = 1, 'concurrent uploads yield exactly one receipt';
  assert (select count(*) from public.cueva_payment_receipts
    where period_id=md5('receipt-period-race')::uuid and state='pending') = 1, 'one pending after race';
  assert (select not public and file_size_limit = 10485760 from storage.buckets
    where id='cueva-payment-receipts'), 'private bucket and size limit';
end $$;
select dblink_disconnect('receipt_one');
select dblink_disconnect('receipt_two');
\echo 'Payment receipt database checks passed.'
