begin;

-- Alumno: devuelve únicamente los ejercicios incluidos en su última rutina publicada.
-- No expone el catálogo general ni acepta un student_id suministrado por el cliente.
create function cueva_private.student_assigned_exercises()
returns table(id uuid, name text, description text, has_video boolean)
language sql stable security definer set search_path='' as $$
 select distinct on (e.id) e.id, e.name, e.description,
        (e.video_url is not null or e.video_path is not null) as has_video
 from public.cueva_routine_publications p
 cross join lateral jsonb_array_elements(cueva_private.plan_blocks(p.plan)) b
 cross join lateral jsonb_array_elements(b->'exercises') item
 join public.cueva_exercises e on e.id=(item->>'exercise_id')::uuid
 where cueva_private.routine_owner(p.student_id)
   and p.draft_revision=cueva_private.routine_latest(p.student_id)
 order by e.id, e.name
$$;
revoke all on function cueva_private.student_assigned_exercises() from public,anon,authenticated,service_role;
grant execute on function cueva_private.student_assigned_exercises() to authenticated;

create function public.cueva_student_assigned_exercises()
returns table(id uuid, name text, description text, has_video boolean)
language sql stable security invoker set search_path='' as $$
 select * from cueva_private.student_assigned_exercises()
$$;
revoke all on function public.cueva_student_assigned_exercises() from public,anon,authenticated,service_role;
grant execute on function public.cueva_student_assigned_exercises() to authenticated;

commit;
