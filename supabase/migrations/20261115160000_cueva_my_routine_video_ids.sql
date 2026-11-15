begin;

-- Availability only. Playback still requires the existing resource and Storage checks.
create function cueva_private.my_routine_video_ids() returns uuid[]
language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(distinct e.id), array[]::uuid[])
  from public.cueva_routine_publications p
  cross join lateral jsonb_array_elements(cueva_private.plan_blocks(p.plan)) b
  cross join lateral jsonb_array_elements(b->'exercises') item
  join public.cueva_exercises e on e.id = (item->>'exercise_id')::uuid
  where cueva_private.routine_owner(p.student_id)
    and p.draft_revision = cueva_private.routine_latest(p.student_id)
    and (e.video_url is not null or e.video_path is not null)
$$;
revoke all on function cueva_private.my_routine_video_ids() from public, anon, authenticated, service_role;
grant execute on function cueva_private.my_routine_video_ids() to authenticated;

create function public.cueva_my_routine_video_ids() returns uuid[]
language sql stable security invoker set search_path='' as $$
  select cueva_private.my_routine_video_ids()
$$;
revoke all on function public.cueva_my_routine_video_ids() from public, anon, authenticated, service_role;
grant execute on function public.cueva_my_routine_video_ids() to authenticated;

commit;
