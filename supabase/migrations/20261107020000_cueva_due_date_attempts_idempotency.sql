begin;

-- A rejected due-day operation is an idempotent result too. Keep its original
-- payload and actor so a retry can return the same rejection without adding
-- another audit row, while preventing operation-key reuse with different data.
alter table public.cueva_due_date_attempts
  add column payload jsonb;

alter table public.cueva_due_date_attempts
  add constraint cueva_due_date_attempts_operation_id_key unique (operation_id);

create or replace function cueva_private.billing_write_guarded(op uuid,p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 result_id uuid;
 who uuid:=auth.uid();
 error_code text;
 error_message text;
 previous_attempt public.cueva_due_date_attempts;
begin
 if not cueva_private.billing_admin() then
  raise exception 'Administrador y sesión habilitada requeridos' using errcode='42501';
 end if;

 -- Serialize with billing_write's existing transaction-wide writer lock.
 -- Re-entrant acquisition in the same transaction is safe and closes the
 -- check-then-insert race between concurrent retries of the same operation.
 perform pg_advisory_xact_lock(903004001);

 if op is not null then
  select * into previous_attempt
   from public.cueva_due_date_attempts
   where operation_id=op;
  if found then
   if previous_attempt.actor=who
      and previous_attempt.payload is not null
      and previous_attempt.payload=p then
    return null;
   end if;
   raise exception 'Clave de operación reutilizada con datos distintos o no verificables'
    using errcode='23505';
  end if;
 end if;

 begin
  result_id:=cueva_private.billing_write(op,p);
  return result_id;
 exception when others then
  get stacked diagnostics error_code=returned_sqlstate,error_message=message_text;
  if op is not null and p is not null and jsonb_typeof(p)='object' and p->>'kind'='due_day' then
   insert into public.cueva_due_date_attempts(
    operation_id,student_id,actor,actor_email,requested_due_day,requested_reason,
    effective_month,scope,error_code,error_message,payload
   ) values (
    op,left(p->>'student_id',64),who,(select u.email from auth.users u where u.id=who),
    left(p->>'due_day',8),left(p->>'reason',300),left(p->>'effective_month',16),
    left(p->>'scope',32),error_code,left(error_message,300),p
   );
   return null;
  end if;
  raise;
 end;
end $$;

commit;
