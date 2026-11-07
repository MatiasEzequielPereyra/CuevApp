\set ON_ERROR_STOP on

-- Run only on a fresh disposable database. Emulate the Supabase roles and
-- claims at the database boundary, then apply the actual product migrations.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz
);
create table auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null
);
create function auth.uid() returns uuid language sql stable as $$
  select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;

\ir ../migrations/20261102151526_cueva_product_access.sql
\ir ../migrations/20261104090000_cueva_students.sql
\ir ../migrations/20261104093000_cueva_billing.sql
\ir ../migrations/20261104120000_cueva_student_invitations.sql
\ir ../migrations/20261107100000_cueva_membership_read.sql

begin;
set local plpgsql.check_asserts = on;
insert into auth.users (id) select md5(k)::uuid
from unnest(array['a', 'b', 'empty', 'unbound', 'admin']) as key(k);
insert into auth.sessions
select md5('session' || id)::uuid, id, now() from auth.users;
insert into cueva_private.access_state (user_id, ready, session_not_before)
select id, true, now() from auth.users;
insert into public.cueva_profiles
select id, case when id = md5('admin')::uuid then 'admin' else 'alumno' end from auth.users;

insert into public.cueva_students (id, first_name, last_name, email, joined_on, active)
select md5('student' || k)::uuid, 'Ficha', k, k || '@example.test', date '2025-01-01', k <> 'b'
from unnest(array['a', 'b', 'empty']) as key(k);
insert into public.cueva_student_invitations (student_id, email, user_id, state, lease, requested_by)
select md5('student' || k)::uuid, k || '@example.test', md5(k)::uuid, 'sent', gen_random_uuid(), md5('admin')::uuid
from unnest(array['a', 'b', 'empty']) as key(k);

insert into public.cueva_prices (id, effective_month, cents, actor)
values (md5('price')::uuid, date '2025-01-01', 10000, md5('admin')::uuid);
with clock as (
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date as today
), dates as (
  select today, date_trunc('month', today::timestamp)::date as month from clock
)
insert into public.cueva_periods (id, student_id, month, due_on, cents, price_id, actor)
select md5(p.key)::uuid, md5('student' || p.student)::uuid,
  (dates.month + p.delta)::date, (dates.today + p.delta)::date,
  p.cents, md5('price')::uuid, md5('admin')::uuid
from dates cross join (values
  ('a-current', 'a', interval '0 month', 10000),
  ('a-past', 'a', interval '-1 month', 10000),
  ('b-current', 'b', interval '0 month', 9900),
  ('a-future', 'a', interval '1 month', 55000)
) as p(key, student, delta, cents);

insert into public.cueva_payments (id, period_id, cents, paid_on, method, actor)
select md5(m.key)::uuid, md5(m.period)::uuid, m.cents,
  (now() at time zone 'America/Argentina/Buenos_Aires')::date - m.days_ago,
  'transferencia', md5('admin')::uuid
from (values
  ('a-partial-1', 'a-current', 3000, 2),
  ('a-partial-2', 'a-current', 1000, 1),
  ('a-reversed', 'a-current', 2000, 0),
  ('a-full', 'a-past', 10000, 32),
  ('b-partial', 'b-current', 7700, 0)
) as m(key, period, cents, days_ago);
insert into public.cueva_reversals (id, payment_id, reason, actor)
values (gen_random_uuid(), md5('a-reversed')::uuid, 'fixture', md5('admin')::uuid);

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', md5('a')::uuid, 'session_id', md5('session' || md5('a')::uuid)::uuid
)::text, true);
do $$
declare snapshot jsonb := public.cueva_membership_snapshot();
begin
  assert (snapshot->>'active')::boolean, 'active membership';
  assert snapshot #>> '{current,cents}' = '10000', 'current amount isolated to member A';
  assert snapshot #>> '{current,due_on}' =
    ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text, 'real due date';
  assert snapshot #>> '{current,paid}' = '4000', 'partial payments exclude reversals';
  assert snapshot #>> '{current,balance}' = '6000', 'exact balance in cents';
  assert snapshot #>> '{current,status}' = 'pending', 'due today is pending';
  assert jsonb_array_length(snapshot #> '{current,payments}') = 2, 'only confirmed payments';
  assert snapshot->>'last_paid_on' =
    ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 1)::text, 'last confirmed date';
  assert jsonb_array_length(snapshot->'history') = 1, 'future period excluded';
  assert snapshot #>> '{history,0,status}' = 'paid', 'historical full payment';
  assert not exists(select 1 from public.cueva_periods), 'no direct ledger access';
  assert snapshot::text not like '%actor%', 'no admin identity in payload';
end;
$$;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', md5('b')::uuid, 'session_id', md5('session' || md5('b')::uuid)::uuid
)::text, true);
do $$
declare snapshot jsonb := public.cueva_membership_snapshot();
begin
  assert not (snapshot->>'active')::boolean, 'inactive membership can see own balance';
  assert snapshot #>> '{current,balance}' = '2200', 'member B isolated';
  assert jsonb_array_length(snapshot->'history') = 0, 'no member A history';
end;
$$;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', md5('empty')::uuid, 'session_id', md5('session' || md5('empty')::uuid)::uuid
)::text, true);
do $$
declare snapshot jsonb := public.cueva_membership_snapshot();
begin
  assert snapshot->'current' = 'null'::jsonb, 'missing period is explicit';
  assert snapshot->'last_paid_on' = 'null'::jsonb, 'no payment is explicit';
  assert snapshot->'history' = '[]'::jsonb, 'empty history';
end;
$$;

do $$
declare identity text;
begin
  foreach identity in array array['unbound', 'admin', 'wrong-session'] loop
    perform set_config('request.jwt.claims', jsonb_build_object(
      'sub', md5(case when identity = 'wrong-session' then 'a' else identity end)::uuid,
      'session_id', md5('session' || md5(identity)::uuid)::uuid
    )::text, true);
    begin
      perform public.cueva_membership_snapshot();
      raise exception 'unexpected access for %', identity;
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;

reset role;
set local role anon;
do $$
begin
  perform public.cueva_membership_snapshot();
  raise exception 'unexpected anonymous access';
exception when insufficient_privilege then null;
end;
$$;
rollback;
