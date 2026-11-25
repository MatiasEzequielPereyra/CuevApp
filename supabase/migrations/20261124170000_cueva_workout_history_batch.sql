begin;
create or replace function cueva_private.workout_history(p_exercise_id uuid, p_limit integer default 30, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = ''
as $history$
declare v_student uuid; v_last_weight numeric; v_last_duration integer; v_entries jsonb; v_has_more boolean;
begin
  if p_exercise_id is null or p_limit is null or p_offset is null or p_limit not between 1 and 50 or p_offset not between 0 and 100000 then
    raise exception 'Consulta de historial inválida' using errcode = '22023';
  end if;
  select s.id into v_student from public.cueva_students s where cueva_private.routine_owner(s.id) limit 1;
  if v_student is null then raise exception 'Acceso restringido' using errcode = '42501'; end if;
  select coalesce(e.quick_weight_kg,(select s.weight_kg from public.cueva_workout_sets s where s.entry_id=e.id order by s.set_number desc limit 1))
    into v_last_weight from public.cueva_workout_entries e
    where e.student_id=v_student and e.exercise_id=p_exercise_id and e.tracking_mode='weight'
    order by e.performed_at desc,e.created_at desc,e.id desc limit 1;
  select coalesce(e.quick_duration_seconds,(select s.duration_seconds from public.cueva_workout_sets s where s.entry_id=e.id order by s.set_number desc limit 1))
    into v_last_duration from public.cueva_workout_entries e
    where e.student_id=v_student and e.exercise_id=p_exercise_id and e.tracking_mode='time'
    order by e.performed_at desc,e.created_at desc,e.id desc limit 1;
  select exists(select 1 from public.cueva_workout_entries e where e.student_id=v_student and e.exercise_id=p_exercise_id
    order by e.performed_at desc,e.created_at desc,e.id desc offset (p_offset+p_limit) limit 1) into v_has_more;
  select coalesce(jsonb_agg(row_data.entry_json order by row_data.performed_at desc,row_data.created_at desc,row_data.id desc),'[]'::jsonb)
    into v_entries
  from (
    select e.id,e.performed_at,e.created_at,jsonb_build_object(
      'id',e.id,'performed_at',e.performed_at,'updated_at',e.updated_at,'revision',e.revision,
      'mode',e.entry_mode,'tracking_mode',e.tracking_mode,'weight_kg',e.quick_weight_kg,
      'duration_seconds',e.quick_duration_seconds,
      'sets',coalesce((select jsonb_agg(jsonb_build_object('set_number',s.set_number,'reps',s.reps,
        'weight_kg',s.weight_kg,'duration_seconds',s.duration_seconds) order by s.set_number)
        from public.cueva_workout_sets s where s.entry_id=e.id),'[]'::jsonb)
    ) as entry_json
    from public.cueva_workout_entries e where e.student_id=v_student and e.exercise_id=p_exercise_id
    order by e.performed_at desc,e.created_at desc,e.id desc limit p_limit offset p_offset
  ) row_data;
  return jsonb_build_object('last_weight_kg',v_last_weight,'last_duration_seconds',v_last_duration,'entries',v_entries,'has_more',v_has_more);
end;
$history$;

create function cueva_private.workout_history_batch(p_exercise_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = ''
as $history_batch$
declare v_student uuid; v_result jsonb;
begin
  if p_exercise_ids is null or cardinality(p_exercise_ids) not between 1 and 100
    or array_position(p_exercise_ids,null) is not null then
    raise exception 'Lista de ejercicios inválida' using errcode = '22023';
  end if;
  select s.id into v_student from public.cueva_students s where cueva_private.routine_owner(s.id) limit 1;
  if v_student is null then raise exception 'Acceso restringido' using errcode = '42501'; end if;
  with requested as (
    select distinct exercise_id from unnest(p_exercise_ids) as input(exercise_id)
  ),
  ranked_entries as (
    select e.*,row_number() over(partition by e.exercise_id order by e.performed_at desc,e.created_at desc,e.id desc) as entry_rank,
      count(*) over(partition by e.exercise_id) as entry_count
    from public.cueva_workout_entries e join requested r on r.exercise_id=e.exercise_id
    where e.student_id=v_student
  ),
  ranked_modes as (
    select e.exercise_id,e.tracking_mode,
      coalesce(e.quick_weight_kg,last_set.weight_kg) as last_weight_kg,
      coalesce(e.quick_duration_seconds,last_set.duration_seconds) as last_duration_seconds,
      row_number() over(partition by e.exercise_id,e.tracking_mode order by e.performed_at desc,e.created_at desc,e.id desc) as mode_rank
    from public.cueva_workout_entries e join requested r on r.exercise_id=e.exercise_id
    left join lateral (
      select s.weight_kg,s.duration_seconds from public.cueva_workout_sets s
      where s.entry_id=e.id order by s.set_number desc limit 1
    ) last_set on true
    where e.student_id=v_student
  ),
  latest_modes as (
    select exercise_id,tracking_mode,last_weight_kg,last_duration_seconds from ranked_modes where mode_rank=1
  ),
  mode_summaries as (
    select exercise_id,
      max(last_weight_kg) filter(where tracking_mode='weight') as last_weight_kg,
      max(last_duration_seconds) filter(where tracking_mode='time') as last_duration_seconds
    from latest_modes group by exercise_id
  ),
  latest_entries as (
    select e.exercise_id,e.entry_count,e.performed_at,e.created_at,e.id as entry_id,jsonb_build_object(
      'id',e.id,'performed_at',e.performed_at,'updated_at',e.updated_at,'revision',e.revision,
      'mode',e.entry_mode,'tracking_mode',e.tracking_mode,'weight_kg',e.quick_weight_kg,
      'duration_seconds',e.quick_duration_seconds,
      'sets',coalesce((select jsonb_agg(jsonb_build_object('set_number',s.set_number,'reps',s.reps,
        'weight_kg',s.weight_kg,'duration_seconds',s.duration_seconds) order by s.set_number)
        from public.cueva_workout_sets s where s.entry_id=e.id),'[]'::jsonb)
    ) as entry_json
    from ranked_entries e where e.entry_rank=1
  ),
  assembled as (
    select r.exercise_id,m.last_weight_kg,m.last_duration_seconds,
      coalesce(jsonb_agg(e.entry_json order by e.performed_at desc,e.created_at desc,e.entry_id desc)
        filter(where e.entry_json is not null),'[]'::jsonb) as entries,
      coalesce(bool_or(e.entry_count>1),false) as has_more
    from requested r left join mode_summaries m on m.exercise_id=r.exercise_id
      left join latest_entries e on e.exercise_id=r.exercise_id
    group by r.exercise_id,m.last_weight_kg,m.last_duration_seconds
  )
  select coalesce(jsonb_object_agg(exercise_id::text,jsonb_build_object(
    'last_weight_kg',last_weight_kg,'last_duration_seconds',last_duration_seconds,'entries',entries,'has_more',has_more
  )),'{}'::jsonb) into v_result from assembled;
  return v_result;
end;
$history_batch$;

revoke all on function cueva_private.workout_history_batch(uuid[]) from public,anon,authenticated,service_role;
grant execute on function cueva_private.workout_history_batch(uuid[]) to authenticated;
create function public.cueva_workout_history_batch(p_exercise_ids uuid[]) returns jsonb
language sql security invoker set search_path = ''
as $history_batch_public$ select cueva_private.workout_history_batch(p_exercise_ids) $history_batch_public$;
revoke all on function public.cueva_workout_history_batch(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.cueva_workout_history_batch(uuid[]) to authenticated;
commit;
