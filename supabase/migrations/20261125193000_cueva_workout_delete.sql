begin;

-- Students may delete only their own workout entry. Child sets are removed
-- through the existing ON DELETE CASCADE constraint; revision protects against
-- deleting a row that changed after its history item was rendered.
create function cueva_private.workout_delete(p_id uuid, p_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $workout_delete$
declare
  v_entry public.cueva_workout_entries;
begin
  if p_id is null or p_revision is null or p_revision < 1 then
    raise exception 'Registro inválido' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(903004001);
  select * into v_entry
  from public.cueva_workout_entries
  where id = p_id
  for update;

  if not found or not cueva_private.routine_owner(v_entry.student_id) then
    raise exception 'No tenés permiso para eliminar este registro' using errcode = '42501';
  end if;
  if v_entry.revision <> p_revision then
    raise exception 'El registro cambió. Actualizá el historial antes de eliminarlo.' using errcode = '40001';
  end if;

  delete from public.cueva_workout_entries where id = p_id;
  return jsonb_build_object('deleted', true, 'exercise_id', v_entry.exercise_id);
end;
$workout_delete$;

revoke all on function cueva_private.workout_delete(uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.workout_delete(uuid,integer) to authenticated;

create function public.cueva_workout_delete(p_id uuid, p_revision integer)
returns jsonb
language sql
security invoker
set search_path = ''
as $workout_delete_public$
  select cueva_private.workout_delete(p_id,p_revision)
$workout_delete_public$;

revoke all on function public.cueva_workout_delete(uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.cueva_workout_delete(uuid,integer) to authenticated;

commit;
