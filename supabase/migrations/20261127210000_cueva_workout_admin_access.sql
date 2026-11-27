begin;

-- Administrative access is scoped to an explicit student and is never inferred
-- from email or from the currently authenticated user's own workout ownership.
create table public.cueva_workout_admin_audit (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  student_id uuid not null references public.cueva_students(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action = 'update'),
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index cueva_workout_admin_audit_entry_idx
  on public.cueva_workout_admin_audit(entry_id, created_at desc);
alter table public.cueva_workout_admin_audit enable row level security;
revoke all on public.cueva_workout_admin_audit from public, anon, authenticated, service_role;

create function cueva_private.workout_history_admin(
  p_student_id uuid, p_exercise_id uuid, p_limit integer default 3, p_offset integer default 0
) returns jsonb
language plpgsql security definer set search_path = ''
as $history_admin$
declare
  v_entries jsonb;
  v_last_weight numeric;
  v_last_duration integer;
  v_has_more boolean;
begin
  if not cueva_private.routine_admin() then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_student_id is null or p_exercise_id is null
    or p_limit is null or p_limit not between 1 and 50
    or p_offset is null or p_offset not between 0 and 100000
    or not exists(select 1 from public.cueva_students s where s.id=p_student_id)
  then raise exception 'Consulta de historial inválida' using errcode = '22023'; end if;

  select coalesce(e.quick_weight_kg,(
    select s.weight_kg from public.cueva_workout_sets s
    where s.entry_id=e.id order by s.set_number desc limit 1
  )) into v_last_weight
  from public.cueva_workout_entries e
  where e.student_id=p_student_id and e.exercise_id=p_exercise_id and e.tracking_mode='weight'
  order by e.performed_at desc,e.created_at desc,e.id desc limit 1;

  select coalesce(e.quick_duration_seconds,(
    select s.duration_seconds from public.cueva_workout_sets s
    where s.entry_id=e.id order by s.set_number desc limit 1
  )) into v_last_duration
  from public.cueva_workout_entries e
  where e.student_id=p_student_id and e.exercise_id=p_exercise_id and e.tracking_mode='time'
  order by e.performed_at desc,e.created_at desc,e.id desc limit 1;

  select exists(
    select 1 from public.cueva_workout_entries e
    where e.student_id=p_student_id and e.exercise_id=p_exercise_id
    order by e.performed_at desc,e.created_at desc,e.id desc
    offset (p_offset+p_limit) limit 1
  ) into v_has_more;

  select coalesce(jsonb_agg(q.entry_json order by q.performed_at desc,q.created_at desc,q.id desc),'[]'::jsonb)
    into v_entries
  from (
    select e.id,e.performed_at,e.created_at,jsonb_build_object(
      'id',e.id,'revision',e.revision,'performed_at',e.performed_at,'updated_at',e.updated_at,
      'mode',e.entry_mode,'tracking_mode',e.tracking_mode,'weight_kg',e.quick_weight_kg,
      'duration_seconds',e.quick_duration_seconds,
      'sets',coalesce((select jsonb_agg(jsonb_build_object(
        'set_number',s.set_number,'reps',s.reps,'weight_kg',s.weight_kg,
        'duration_seconds',s.duration_seconds) order by s.set_number)
        from public.cueva_workout_sets s where s.entry_id=e.id),'[]'::jsonb)
    ) entry_json
    from public.cueva_workout_entries e
    where e.student_id=p_student_id and e.exercise_id=p_exercise_id
    order by e.performed_at desc,e.created_at desc,e.id desc
    limit p_limit offset p_offset
  ) q;

  return jsonb_build_object('last_weight_kg',v_last_weight,'last_duration_seconds',v_last_duration,
    'entries',v_entries,'has_more',v_has_more);
end;
$history_admin$;
revoke all on function cueva_private.workout_history_admin(uuid,uuid,integer,integer)
  from public,anon,authenticated,service_role;
grant execute on function cueva_private.workout_history_admin(uuid,uuid,integer,integer) to authenticated;

create function public.cueva_workout_history_admin(
  p_student_id uuid,p_exercise_id uuid,p_limit integer default 3,p_offset integer default 0
) returns jsonb language sql security invoker set search_path = ''
as $history_admin_public$
  select cueva_private.workout_history_admin(p_student_id,p_exercise_id,p_limit,p_offset)
$history_admin_public$;
revoke all on function public.cueva_workout_history_admin(uuid,uuid,integer,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.cueva_workout_history_admin(uuid,uuid,integer,integer) to authenticated;

create function cueva_private.workout_history_admin_batch(p_student_id uuid,p_exercise_ids uuid[])
returns jsonb language plpgsql security definer set search_path = ''
as $history_admin_batch$
declare v_result jsonb := '{}'::jsonb; v_id uuid;
begin
  if not cueva_private.routine_admin() then raise exception 'Acceso restringido' using errcode='42501'; end if;
  if p_student_id is null or p_exercise_ids is null
    or cardinality(p_exercise_ids) not between 1 and 100
    or array_position(p_exercise_ids,null) is not null then
    raise exception 'Lista de ejercicios inválida' using errcode='22023';
  end if;
  foreach v_id in array p_exercise_ids loop
    v_result := v_result || jsonb_build_object(v_id::text,
      cueva_private.workout_history_admin(p_student_id,v_id,1,0));
  end loop;
  return v_result;
end;
$history_admin_batch$;
revoke all on function cueva_private.workout_history_admin_batch(uuid,uuid[])
  from public,anon,authenticated,service_role;
grant execute on function cueva_private.workout_history_admin_batch(uuid,uuid[]) to authenticated;

create function public.cueva_workout_history_admin_batch(p_student_id uuid,p_exercise_ids uuid[])
returns jsonb language sql security invoker set search_path = ''
as $history_admin_batch_public$
  select cueva_private.workout_history_admin_batch(p_student_id,p_exercise_ids)
$history_admin_batch_public$;
revoke all on function public.cueva_workout_history_admin_batch(uuid,uuid[])
  from public,anon,authenticated,service_role;
grant execute on function public.cueva_workout_history_admin_batch(uuid,uuid[]) to authenticated;

-- Admin edits are version-checked, student-scoped and audited atomically.
-- No create/delete capability is added for administrators.
create function cueva_private.workout_update_admin(
  p_student_id uuid,p_id uuid,p_revision integer,p_mode text,p_tracking_mode text,
  p_weight_kg numeric,p_duration_seconds integer,p_sets jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $update_admin$
declare
  v_entry public.cueva_workout_entries;
  v_before jsonb;
  v_after jsonb;
  v_set jsonb;
  v_n integer := 0;
  v_sets jsonb := '[]'::jsonb;
begin
  if not cueva_private.routine_admin() then raise exception 'Acceso restringido' using errcode='42501'; end if;
  if p_student_id is null or p_id is null or p_revision is null or p_revision < 1 or p_revision >= 2147483647
    or p_mode is null or p_mode not in ('quick','sets')
    or p_tracking_mode is null or p_tracking_mode not in ('weight','time')
    or p_sets is null or jsonb_typeof(p_sets) is distinct from 'array'
  then raise exception 'Actualización inválida' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(903004001);
  select * into v_entry from public.cueva_workout_entries where id=p_id for update;
  if not found or v_entry.student_id <> p_student_id then
    raise exception 'No tenés permiso para editar este registro' using errcode='42501';
  end if;
  if v_entry.tracking_mode <> p_tracking_mode then
    raise exception 'El tipo de registro no coincide' using errcode='22023';
  end if;

  if p_mode='quick' then
    if jsonb_array_length(p_sets)<>0
      or (p_tracking_mode='weight' and (p_weight_kg is null or p_weight_kg not between 0 and 2000
        or round(p_weight_kg,2)<>p_weight_kg or p_duration_seconds is not null))
      or (p_tracking_mode='time' and (p_duration_seconds is null or p_duration_seconds not between 1 and 86400
        or p_weight_kg is not null)) then
      raise exception 'Valor rápido inválido' using errcode='22023';
    end if;
  else
    if p_weight_kg is not null or p_duration_seconds is not null
      or jsonb_array_length(p_sets) not between 1 and 30 then
      raise exception 'Detalle de series inválido' using errcode='22023';
    end if;
    for v_set in select value from jsonb_array_elements(p_sets) loop
      v_n:=v_n+1;
      if p_tracking_mode='weight' then
        if jsonb_typeof(v_set->'reps') is distinct from 'number'
          or jsonb_typeof(v_set->'weight_kg') is distinct from 'number'
          or (v_set-'reps'-'weight_kg')<>'{}'::jsonb
          or (v_set->>'reps')::numeric<>trunc((v_set->>'reps')::numeric)
          or (v_set->>'reps')::integer not between 1 and 1000
          or (v_set->>'weight_kg')::numeric not between 0 and 2000
          or round((v_set->>'weight_kg')::numeric,2)<>(v_set->>'weight_kg')::numeric then
          raise exception 'Serie inválida' using errcode='22023';
        end if;
      else
        if jsonb_typeof(v_set->'duration_seconds') is distinct from 'number'
          or (v_set-'duration_seconds')<>'{}'::jsonb
          or (v_set->>'duration_seconds')::numeric<>trunc((v_set->>'duration_seconds')::numeric)
          or (v_set->>'duration_seconds')::integer not between 1 and 86400 then
          raise exception 'Duración de serie inválida' using errcode='22023';
        end if;
      end if;
    end loop;
  end if;

  select coalesce(jsonb_agg(
    case when v_entry.tracking_mode='weight'
      then jsonb_build_object('reps',s.reps,'weight_kg',s.weight_kg)
      else jsonb_build_object('duration_seconds',s.duration_seconds) end order by s.set_number
  ),'[]'::jsonb) into v_sets
  from public.cueva_workout_sets s where s.entry_id=p_id;

  -- An HTTP retry after a committed edit is safe and does not create a second audit event.
  if v_entry.revision=p_revision+1 and v_entry.entry_mode=p_mode
    and v_entry.quick_weight_kg is not distinct from p_weight_kg
    and v_entry.quick_duration_seconds is not distinct from p_duration_seconds
    and (p_mode<>'sets' or v_sets=p_sets) then
    return jsonb_build_object('entry',to_jsonb(v_entry),'sets',v_sets);
  end if;

  select jsonb_build_object('entry',to_jsonb(e),'sets',coalesce((
    select jsonb_agg(to_jsonb(s) order by s.set_number) from public.cueva_workout_sets s where s.entry_id=e.id
  ),'[]'::jsonb)) into v_before from public.cueva_workout_entries e where e.id=p_id;

  if v_entry.revision<>p_revision then
    raise exception 'El registro cambió. Actualizá el historial antes de editarlo.' using errcode='40001';
  end if;

  update public.cueva_workout_entries set entry_mode=p_mode,
    quick_weight_kg=case when p_mode='quick' and p_tracking_mode='weight' then p_weight_kg end,
    quick_duration_seconds=case when p_mode='quick' and p_tracking_mode='time' then p_duration_seconds end,
    revision=revision+1,updated_at=clock_timestamp()
  where id=p_id returning * into v_entry;
  delete from public.cueva_workout_sets where entry_id=p_id;
  v_n:=0;
  if p_mode='sets' then
    for v_set in select value from jsonb_array_elements(p_sets) loop
      v_n:=v_n+1;
      if p_tracking_mode='weight' then
        insert into public.cueva_workout_sets(entry_id,set_number,reps,weight_kg)
        values(p_id,v_n,(v_set->>'reps')::integer,(v_set->>'weight_kg')::numeric);
      else
        insert into public.cueva_workout_sets(entry_id,set_number,duration_seconds)
        values(p_id,v_n,(v_set->>'duration_seconds')::integer);
      end if;
    end loop;
  end if;

  select jsonb_build_object('entry',to_jsonb(e),'sets',coalesce((
    select jsonb_agg(to_jsonb(s) order by s.set_number) from public.cueva_workout_sets s where s.entry_id=e.id
  ),'[]'::jsonb)) into v_after from public.cueva_workout_entries e where e.id=p_id;

  insert into public.cueva_workout_admin_audit(entry_id,student_id,actor_user_id,action,before_state,after_state)
  values(p_id,p_student_id,auth.uid(),'update',v_before,v_after);

  select coalesce(jsonb_agg(case when v_entry.tracking_mode='weight'
    then jsonb_build_object('reps',s.reps,'weight_kg',s.weight_kg)
    else jsonb_build_object('duration_seconds',s.duration_seconds) end order by s.set_number),'[]'::jsonb)
    into v_sets from public.cueva_workout_sets s where s.entry_id=p_id;
  return jsonb_build_object('entry',to_jsonb(v_entry),'sets',v_sets);
end;
$update_admin$;
revoke all on function cueva_private.workout_update_admin(uuid,uuid,integer,text,text,numeric,integer,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function cueva_private.workout_update_admin(uuid,uuid,integer,text,text,numeric,integer,jsonb)
  to authenticated;

create function public.cueva_workout_update_admin(
  p_student_id uuid,p_id uuid,p_revision integer,p_mode text,p_tracking_mode text,
  p_weight_kg numeric,p_duration_seconds integer,p_sets jsonb
) returns jsonb language sql security invoker set search_path = ''
as $update_admin_public$
  select cueva_private.workout_update_admin(p_student_id,p_id,p_revision,p_mode,p_tracking_mode,
    p_weight_kg,p_duration_seconds,p_sets)
$update_admin_public$;
revoke all on function public.cueva_workout_update_admin(uuid,uuid,integer,text,text,numeric,integer,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.cueva_workout_update_admin(uuid,uuid,integer,text,text,numeric,integer,jsonb)
  to authenticated;

commit;
