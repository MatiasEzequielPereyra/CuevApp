begin;
alter table public.cueva_due_date_audit add column actor_email text;
update public.cueva_due_date_audit a set actor_email=u.email from auth.users u where u.id=a.actor;
create function cueva_private.set_due_audit_actor_email()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 select u.email into new.actor_email from auth.users u where u.id=new.actor;
 if new.actor_email is null then raise exception 'No se pudo identificar al administrador de la auditoría'; end if;
 return new;
end $$;
revoke all on function cueva_private.set_due_audit_actor_email() from public,anon,authenticated,service_role;
create trigger cueva_due_audit_actor_email before insert on public.cueva_due_date_audit
 for each row execute function cueva_private.set_due_audit_actor_email();
alter table public.cueva_due_date_audit alter column actor_email set not null;

create table public.cueva_due_date_attempts (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid not null,
 student_id text,
 actor uuid not null references auth.users(id),
 actor_email text not null,
 requested_due_day text,
 requested_reason text,
 effective_month text,
 scope text,
 error_code text not null,
 error_message text not null,
 recorded_at timestamptz not null default clock_timestamp(),
 check(length(error_code) between 1 and 5),
 check(length(error_message) between 1 and 300)
);
alter table public.cueva_due_date_attempts enable row level security;
revoke all on public.cueva_due_date_attempts from public,anon,authenticated,service_role;
grant select on public.cueva_due_date_attempts to authenticated;
create policy due_date_attempts_admin_read on public.cueva_due_date_attempts for select to authenticated using (
 (select cueva_private.ready_for_current_session())
 and exists(select 1 from public.cueva_profiles where user_id=(select auth.uid()) and role='admin')
);

create function cueva_private.billing_write_guarded(op uuid,p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result_id uuid; who uuid:=auth.uid(); error_code text; error_message text;
begin
 if not cueva_private.billing_admin() then
  raise exception 'Administrador y sesión habilitada requeridos' using errcode='42501';
 end if;
 begin
  result_id:=cueva_private.billing_write(op,p);
  return result_id;
 exception when others then
  get stacked diagnostics error_code=returned_sqlstate,error_message=message_text;
  if p is not null and jsonb_typeof(p)='object' and p->>'kind'='due_day' then
   insert into public.cueva_due_date_attempts(
    operation_id,student_id,actor,actor_email,requested_due_day,requested_reason,effective_month,scope,error_code,error_message
   ) values (
    op,left(p->>'student_id',64),who,(select u.email from auth.users u where u.id=who),
    left(p->>'due_day',8),left(p->>'reason',300),left(p->>'effective_month',16),left(p->>'scope',32),
    error_code,left(error_message,300)
   );
   return null;
  end if;
  raise;
 end;
end $$;
revoke all on function cueva_private.billing_write_guarded(uuid,jsonb) from public,anon,service_role;
grant execute on function cueva_private.billing_write_guarded(uuid,jsonb) to authenticated;

create or replace function public.cueva_billing_write(op uuid,p jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
 return cueva_private.billing_write_guarded(op,p);
end $$;
revoke all on function public.cueva_billing_write(uuid,jsonb) from public,anon,service_role;
grant execute on function public.cueva_billing_write(uuid,jsonb) to authenticated;
commit;
