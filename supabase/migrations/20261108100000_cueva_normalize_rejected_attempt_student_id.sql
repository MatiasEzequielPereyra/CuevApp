begin;

-- Repair historical UUID-shaped values so existing attempts remain visible
-- and continue protecting their student records.
update public.cueva_due_date_attempts
set student_id=(student_id::uuid)::text
where coalesce(student_id,'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and student_id is distinct from (student_id::uuid)::text;

-- Keep valid UUIDs canonical while preserving malformed input for diagnostics.
create or replace function cueva_private.billing_write_guarded(op uuid,p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 result_id uuid;
 who uuid:=auth.uid();
 error_code text;
 error_message text;
 previous_attempt public.cueva_due_date_attempts;
 expected_day smallint;
 current_day smallint;
 student uuid;
 effective date;
begin
 if not cueva_private.billing_admin() then
  raise exception 'Administrador y sesión habilitada requeridos' using errcode='42501';
 end if;

 perform pg_advisory_xact_lock(903004001);

 if op is not null then
  -- Successful operations take precedence over any legacy rejected-attempt
  -- row created by the earlier wrapper bug. This preserves the canonical
  -- result even if both records exist from a pre-fix environment.
  if exists(select 1 from cueva_private.billing_operations where id=op) then
   return cueva_private.billing_write(op,p);
  end if;

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
  if p->>'kind'='due_day' then
   if coalesce(p->>'expected_old_due_day','') !~ '^(0?[1-9]|[12][0-9]|3[01])$' then
    raise exception 'Falta el día anterior esperado para confirmar el cambio' using errcode='22023';
   end if;
   if coalesce(p->>'student_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(p->>'effective_month','') !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Referencia de vencimiento inválida' using errcode='22023';
   end if;
   student:=(p->>'student_id')::uuid;
   effective:=(p->>'effective_month'||'-01')::date;
   expected_day:=(p->>'expected_old_due_day')::smallint;
   select d.due_day into current_day
    from public.cueva_due_schedules d
    where d.student_id=student and d.effective_month<=effective
    order by d.effective_month desc,d.recorded_at desc,d.id desc
    limit 1;
   if current_day is null then
    raise exception 'No existe una regla anterior para ese alumno' using errcode='P0001';
   end if;
   if current_day<>expected_day then
    raise exception 'El vencimiento cambió desde que abriste la vista previa. Actualizá los datos y revisá el nuevo valor.' using errcode='P0001';
   end if;
   if p->>'scope'='current_period' and p->'confirm_current_period' is distinct from 'true'::jsonb then
    raise exception 'Confirmá explícitamente el cambio del período actual' using errcode='22023';
   end if;
  end if;

  result_id:=cueva_private.billing_write(op,p);
  return result_id;
 exception when others then
  get stacked diagnostics error_code=returned_sqlstate,error_message=message_text;

  -- billing_write can reject a reused key after finding an earlier successful
  -- operation. Such a conflict is not a new due-date attempt and must not
  -- poison the original key or block its legitimate retry.
  if op is not null and exists(select 1 from cueva_private.billing_operations where id=op) then
   raise exception using errcode=error_code,message=error_message;
  end if;

  if op is not null and p is not null and jsonb_typeof(p)='object' and p->>'kind'='due_day' then
   insert into public.cueva_due_date_attempts(
    operation_id,student_id,actor,actor_email,requested_due_day,requested_reason,
    effective_month,scope,error_code,error_message,payload
   ) values (
    op,
    case
     when coalesce(p->>'student_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((p->>'student_id')::uuid)::text
     else left(p->>'student_id',64)
    end,
    who,(select u.email from auth.users u where u.id=who),
    left(p->>'due_day',8),left(p->>'reason',300),left(p->>'effective_month',16),
    left(p->>'scope',32),error_code,left(error_message,300),p
   );
   return null;
  end if;
  raise;
 end;
end $$;


commit;
