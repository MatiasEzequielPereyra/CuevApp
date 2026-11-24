begin;

-- Include both structured-plan exercises and UUID-linked free-text mentions
-- in the student's video availability lookup.
create or replace function cueva_private.my_routine_video_ids() returns uuid[]
language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(distinct available.exercise_id), array[]::uuid[])
  from (
    select e.id as exercise_id
    from public.cueva_routine_publications p
    cross join lateral jsonb_array_elements(cueva_private.plan_blocks(p.plan)) b
    cross join lateral jsonb_array_elements(b->'exercises') item
    join public.cueva_exercises e on e.id = (item->>'exercise_id')::uuid
    where cueva_private.routine_owner(p.student_id)
      and p.draft_revision = cueva_private.routine_latest(p.student_id)
      and (e.video_url is not null or e.video_path is not null)

    union

    select mentioned.id as exercise_id
    from cueva_private.student_mentioned_exercises() mentioned
    join public.cueva_exercises e on e.id = mentioned.id
    where e.video_url is not null or e.video_path is not null
  ) available
$$;

revoke all on function cueva_private.my_routine_video_ids() from public, anon, authenticated, service_role;
grant execute on function cueva_private.my_routine_video_ids() to authenticated;

commit;
