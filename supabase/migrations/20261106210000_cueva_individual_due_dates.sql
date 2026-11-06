begin;

-- A schedule is effective from a calendar month onward. Keeping its history
-- separate from cueva_students.joined_on avoids changing the student's signup date.
create table public.cueva_due_schedules (
 id uuid primary key,
 student_id uuid not null references public.cueva_students(id),
 due_day smallint not null check (due_day between 1 and 31),
 effective_month date not null check (extract(day from effective_month)=1),
 actor uuid not null references auth.users(id),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(student_id,effective_month)
);
alter table public.cueva_due_schedules enable row level security;
revoke all on public.cueva_due_schedules from public,anon,authenticated,service_role;
grant select on public.cueva_due_schedules to authenticated;
create policy due_schedules_admin_read on public.cueva_due_schedules
 for select to authenticated using (
  (select cueva_private.ready_for_current_session())
  and exists(select 1 from public.cueva_profiles where user_id=(select auth.uid()) and role='admin')
);

create table public.cueva_due_date_audit (
 id uuid primary key,
 student_id uuid not null references public.cueva_students(id),
 actor uuid not null references auth.users(id),
 old_due_day smallint not null check(old_due_day between 1 and 31),
 new_due_day smallint not null check(new_due_day between 1 and 31),
 effective_month date not null check(extract(day from effective_month)=1),
 scope text not null check(scope in ('current_period','next_period')),
 reason text not null check(length(btrim(reason)) between 3 and 300),
 result text not null check(result in ('applied')),
 recorded_at timestamptz not null default clock_timestamp()
);
alter table public.cueva_due_date_audit enable row level security;
revoke all on public.cueva_due_date_audit from public,anon,authenticated,service_role;
grant select on public.cueva_due_date_audit to authenticated;
create policy due_date_audit_admin_read on public.cueva_due_date_audit
 for select to authenticated using (
  (select cueva_private.ready_for_current_session())
  and exists(select 1 from public.cueva_profiles where user_id=(select auth.uid()) and role='admin')
);

-- The day is retained independently of month-end clamping.
create function cueva_private.monthly_due_date(p_day smallint,p_month date)
returns date language plpgsql immutable strict security invoker set search_path='' as $$
declare first_day date; last_day integer;
begin
 if p_day not between 1 and 31 or extract(day from p_month)<>1
 then raise exception 'Referencia de vencimiento inválida' using errcode='22023'; end if;
 first_day:=p_month;
 last_day:=extract(day from (first_day+interval '1 month - 1 day'))::integer;
 return make_date(extract(year from first_day)::integer,extract(month from first_day)::integer,least(p_day,last_day));
end $$;
revoke all on function cueva_private.monthly_due_date(smallint,date) from public,anon,authenticated,service_role;

-- Seed existing students from joined_on, without modifying that source date.
insert into public.cueva_due_schedules(id,student_id,due_day,effective_month,actor)
select gen_random_uuid(),s.id,extract(day from s.joined_on)::smallint,
       date_trunc('month',s.joined_on)::date,s.id
from public.cueva_students s
where not exists(select 1 from public.cueva_due_schedules d where d.student_id=s.id);

create function cueva_private.seed_student_due_schedule()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.cueva_due_schedules(id,student_id,due_day,effective_month,actor)
 values(gen_random_uuid(),new.id,extract(day from new.joined_on)::smallint,
        date_trunc('month',new.joined_on)::date,auth.uid());
 return new;
end $$;
revoke all on function cueva_private.seed_student_due_schedule() from public,anon,authenticated,service_role;
create trigger cueva_students_seed_due_schedule
 after insert on public.cueva_students
 for each row execute function cueva_private.seed_student_due_schedule();

-- Extend the existing idempotent financial writer in place. All prior branches
-- retain their original validation, locking, grants, and ledger behavior.
create or replace function cueva_private.billing_write(op uuid,p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 who uuid:=auth.uid();
 previous cueva_private.billing_operations;
 price public.cueva_prices;
 period public.cueva_periods;
 payment public.cueva_payments;
 amount bigint;
 paid bigint;
 month_date date;
 date_value date;
 student uuid;
 schedule public.cueva_due_schedules;
 old_day smallint;
 new_day smallint;
 effective date;
 scope_value text;
 reason_value text;
begin
 if not cueva_private.billing_admin() then raise exception 'Administrador y sesión habilitada requeridos' using errcode='42501'; end if;
 if op is null or p is null or jsonb_typeof(p)<>'object' then raise exception 'Operación inválida'; end if;
 perform pg_advisory_xact_lock(903004001);
 select * into previous from cueva_private.billing_operations where id=op;
 if found then
  if previous.actor=who and previous.payload=p then return op;
  else raise exception 'Clave de operación reutilizada con datos distintos'; end if;
 end if;

 if p->>'kind' in ('price','payment') then
  if coalesce(p->>'cents','') !~ '^[0-9]{1,12}$' then raise exception 'Importe inválido'; end if;
  amount:=(p->>'cents')::bigint;
  if amount<1 or amount>100000000000 then raise exception 'Importe fuera de rango'; end if;
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
  select d.* into schedule from public.cueva_due_schedules d
   where d.student_id=student and d.effective_month<=month_date
   order by d.effective_month desc limit 1;
  if not found then raise exception 'No existe una regla de vencimiento para ese mes'; end if;
  date_value:=cueva_private.monthly_due_date(schedule.due_day,month_date);
  select * into price from public.cueva_prices where effective_month<=month_date order by effective_month desc limit 1;
  if not found then raise exception 'Configurá un precio general para ese mes'; end if;
  insert into public.cueva_periods values(op,student,month_date,date_value,price.cents,price.id,who,now());

 elsif p->>'kind'='due_day' then
  student:=(p->>'student_id')::uuid;
  if student is null or not exists(select 1 from public.cueva_students where id=student) then raise exception 'Alumno inexistente'; end if;
  if coalesce(p->>'due_day','') !~ '^(0?[1-9]|[12][0-9]|3[01])$' then raise exception 'Día de vencimiento inválido' using errcode='22023'; end if;
  new_day:=(p->>'due_day')::smallint;
  if coalesce(p->>'effective_month','') !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'Mes de vigencia inválido' using errcode='22023'; end if;
  effective:=(p->>'effective_month'||'-01')::date;
  if effective<date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date
     or effective>date '2100-12-01' then raise exception 'Mes de vigencia fuera de rango' using errcode='22023'; end if;
  scope_value:=p->>'scope';
  if scope_value not in ('current_period','next_period') then raise exception 'Alcance inválido' using errcode='22023'; end if;
  if (scope_value='current_period' and effective<>date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date)
     or (scope_value='next_period' and effective<=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date)
  then raise exception 'El alcance no coincide con el mes de vigencia' using errcode='22023'; end if;
  reason_value=btrim(coalesce(p->>'reason',''));
  if length(reason_value) not between 3 and 300 then raise exception 'Indicá un motivo de entre 3 y 300 caracteres' using errcode='22023'; end if;
  select d.due_day into old_day from public.cueva_due_schedules d
   where d.student_id=student and d.effective_month<effective
   order by d.effective_month desc limit 1;
  if old_day is null then raise exception 'No existe una regla anterior para ese alumno'; end if;
  select t.* into period from public.cueva_periods t where t.student_id=student and t.month=effective for update;
  if found then
   select coalesce(sum(m.cents),0) into paid from public.cueva_payments m
    where m.period_id=period.id and not exists(select 1 from public.cueva_reversals r where r.payment_id=m.id);
   if paid>=period.cents then raise exception 'No se puede cambiar el vencimiento de un período totalmente pagado' using errcode='P0001'; end if;
   update public.cueva_periods set due_on=cueva_private.monthly_due_date(new_day,effective) where id=period.id;
  end if;
  insert into public.cueva_due_schedules(id,student_id,due_day,effective_month,actor)
   values(op,student,new_day,effective,who);
  insert into public.cueva_due_date_audit(id,student_id,actor,old_due_day,new_due_day,effective_month,scope,reason,result)
   values(op,student,who,old_day,new_day,effective,scope_value,reason_value,'applied');

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

 else
  raise exception 'Tipo de operación inválido';
 end if;
 insert into cueva_private.billing_operations values(op,who,p);
 return op;
end $$;
revoke all on function cueva_private.billing_write(uuid,jsonb) from public,anon,service_role;
grant execute on function cueva_private.billing_write(uuid,jsonb) to authenticated;

commit;
