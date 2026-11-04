begin;
create function cueva_private.billing_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select cueva_private.ready_for_current_session() and exists(select 1 from public.cueva_profiles where user_id=auth.uid() and role='admin')
$$;
revoke all on function cueva_private.billing_admin() from public,anon,service_role;
grant execute on function cueva_private.billing_admin() to authenticated;
create table public.cueva_prices(id uuid primary key,effective_month date not null unique check(extract(day from effective_month)=1),cents bigint not null check(cents between 1 and 100000000000),actor uuid not null references auth.users(id),recorded_at timestamptz not null default now());
create table public.cueva_periods(id uuid primary key,student_id uuid not null references public.cueva_students(id),month date not null check(extract(day from month)=1),due_on date not null check(due_on between date '1900-01-01' and date '2100-12-31'),cents bigint not null check(cents>0),price_id uuid not null references public.cueva_prices(id),actor uuid not null references auth.users(id),recorded_at timestamptz not null default now(),unique(student_id,month));
create table public.cueva_payments(id uuid primary key,period_id uuid not null references public.cueva_periods(id),cents bigint not null check(cents>0),paid_on date not null check(paid_on between date '1900-01-01' and date '2100-12-31'),method text not null check(method in ('efectivo','transferencia','otro')),actor uuid not null references auth.users(id),recorded_at timestamptz not null default now());
create table public.cueva_reversals(id uuid primary key,payment_id uuid not null unique references public.cueva_payments(id),reason text not null check(length(btrim(reason)) between 3 and 300),actor uuid not null references auth.users(id),recorded_at timestamptz not null default now());
create table cueva_private.billing_operations(id uuid primary key,actor uuid not null,payload jsonb not null);
revoke all on cueva_private.billing_operations from public,anon,authenticated,service_role;
alter table cueva_private.billing_operations enable row level security;
alter table public.cueva_prices enable row level security;
alter table public.cueva_periods enable row level security;
alter table public.cueva_payments enable row level security;
alter table public.cueva_reversals enable row level security;
revoke all on public.cueva_prices,public.cueva_periods,public.cueva_payments,public.cueva_reversals from public,anon,authenticated,service_role;
grant select on public.cueva_prices,public.cueva_periods,public.cueva_payments,public.cueva_reversals to authenticated;
create policy prices_admin on public.cueva_prices for select to authenticated using ((select cueva_private.billing_admin()));
create policy periods_admin on public.cueva_periods for select to authenticated using ((select cueva_private.billing_admin()));
create policy payments_admin on public.cueva_payments for select to authenticated using ((select cueva_private.billing_admin()));
create policy reversals_admin on public.cueva_reversals for select to authenticated using ((select cueva_private.billing_admin()));
-- Narrow append-only writer: no table writes granted to API roles. Caller/session checked before definer writes.
create function cueva_private.billing_write(op uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); previous cueva_private.billing_operations; price public.cueva_prices; period public.cueva_periods; payment public.cueva_payments; amount bigint; paid bigint; month_date date; date_value date; student uuid;
begin
 if not cueva_private.billing_admin() then raise exception 'Administrador y sesión habilitada requeridos' using errcode='42501'; end if;
 if op is null or p is null or jsonb_typeof(p)<>'object' then raise exception 'Operación inválida'; end if;
 -- A single transaction-level lock serializes financial writes, including idempotency and balance reads.
 perform pg_advisory_xact_lock(903004001);
 select * into previous from cueva_private.billing_operations where id=op;
 if found then if previous.actor=who and previous.payload=p then return op; else raise exception 'Clave de operación reutilizada con datos distintos'; end if; end if;
 if p->>'kind' in ('price','payment') then
  if coalesce(p->>'cents','') !~ '^[0-9]{1,12}$' then raise exception 'Importe inválido'; end if;
  amount:=(p->>'cents')::bigint; if amount<1 or amount>100000000000 then raise exception 'Importe fuera de rango'; end if;
 end if;
 if p->>'kind' in ('price','period') then
  if coalesce(p->>'month','') !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'Mes inválido'; end if;
  month_date:=(p->>'month'||'-01')::date;
  if month_date<date '1900-01-01' or month_date>date '2100-12-01' then raise exception 'Mes fuera de rango'; end if;
 end if;
 if p->>'kind'='price' then
  if month_date<date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'El precio nuevo requiere un mes actual o posterior'; end if;
  insert into public.cueva_prices values(op,month_date,amount,who,now());
 elsif p->>'kind'='period' then
  student:=(p->>'student_id')::uuid;
  if not exists(select 1 from public.cueva_students where id=student) then raise exception 'Alumno inexistente'; end if;
  date_value:=(p->>'due_on')::date;
  if date_value is null then raise exception 'Vencimiento requerido'; end if;
  select * into price from public.cueva_prices where effective_month<=month_date order by effective_month desc limit 1;
  if not found then raise exception 'Configurá un precio general para ese mes'; end if;
  insert into public.cueva_periods values(op,student,month_date,date_value,price.cents,price.id,who,now());
 elsif p->>'kind'='payment' then
  select * into period from public.cueva_periods where id=(p->>'period_id')::uuid and student_id=(p->>'student_id')::uuid for update;
  if not found then raise exception 'El período no corresponde al alumno'; end if;
  select coalesce(sum(m.cents),0) into paid from public.cueva_payments m where m.period_id=period.id and not exists(select 1 from public.cueva_reversals r where r.payment_id=m.id);
  if amount>period.cents-paid then raise exception 'El importe supera el saldo. Anticipos y saldos a favor no están habilitados'; end if;
  date_value:=(p->>'paid_on')::date;
  insert into public.cueva_payments values(op,period.id,amount,date_value,p->>'method',who,now());
 elsif p->>'kind'='reverse' then
  select m.* into payment from public.cueva_payments m join public.cueva_periods t on t.id=m.period_id where m.id=(p->>'payment_id')::uuid and t.student_id=(p->>'student_id')::uuid for update of m;
  if not found then raise exception 'Pago no encontrado para ese alumno'; end if;
  insert into public.cueva_reversals values(op,payment.id,btrim(p->>'reason'),who,now());
 else raise exception 'Tipo de operación inválido'; end if;
 insert into cueva_private.billing_operations values(op,who,p);
 return op;
end $$;
revoke all on function cueva_private.billing_write(uuid,jsonb) from public,anon,service_role;
grant execute on function cueva_private.billing_write(uuid,jsonb) to authenticated;
create function public.cueva_billing_write(op uuid,p jsonb) returns uuid language sql security invoker set search_path='' as $$ select cueva_private.billing_write(op,p) $$;
revoke all on function public.cueva_billing_write(uuid,jsonb) from public,anon,service_role;
grant execute on function public.cueva_billing_write(uuid,jsonb) to authenticated;
-- Snapshot aggregates complete histories in PostgreSQL, avoiding Data API row limits and JS rounding.
create function public.cueva_billing_snapshot(student uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'prices',coalesce((select jsonb_agg(jsonb_build_object('month',effective_month,'cents',cents::text) order by effective_month desc) from public.cueva_prices),'[]'::jsonb),
 'periods',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'month',t.month,'due_on',t.due_on,'cents',t.cents::text,
 'paid',coalesce((select sum(m.cents) from public.cueva_payments m where m.period_id=t.id and not exists(select 1 from public.cueva_reversals r where r.payment_id=m.id)),0)::text,
 'payments',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'cents',m.cents::text,'paid_on',m.paid_on,'method',m.method,'actor',m.actor,'recorded_at',m.recorded_at,'reversal',(select jsonb_build_object('reason',r.reason,'actor',r.actor,'recorded_at',r.recorded_at) from public.cueva_reversals r where r.payment_id=m.id)) order by m.recorded_at) from public.cueva_payments m where m.period_id=t.id),'[]'::jsonb)) order by t.month desc) from public.cueva_periods t where t.student_id=student),'[]'::jsonb))
$$;
revoke all on function public.cueva_billing_snapshot(uuid) from public,anon,service_role;
grant execute on function public.cueva_billing_snapshot(uuid) to authenticated;
commit;
