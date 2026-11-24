begin;

-- A student may resolve a video resource when the exercise is referenced by
-- UUID in their latest published free-text routine, just as for block plans.
create or replace function cueva_private.exercise_allowed(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select cueva_private.routine_admin()
    or exists(
      select 1
      from public.cueva_routine_publications p
      cross join lateral jsonb_array_elements(cueva_private.plan_blocks(p.plan)) b
      cross join lateral jsonb_array_elements(b->'exercises') item
      where cueva_private.routine_owner(p.student_id)
        and p.draft_revision = cueva_private.routine_latest(p.student_id)
        and (item->>'exercise_id')::uuid = p_id
    )
    or exists(
      select 1
      from public.cueva_routine_text_publications document
      join public.cueva_routine_publications publication
        on publication.id = document.publication_id
      cross join lateral jsonb_array_elements(document.mentions) mention
      where document.format = 'text'
        and cueva_private.routine_owner(document.student_id)
        and publication.draft_revision = cueva_private.routine_latest(document.student_id)
        and (mention->>'exercise_id')::uuid = p_id
    )
$$;

revoke all on function cueva_private.exercise_allowed(uuid) from public, anon, authenticated, service_role;
grant execute on function cueva_private.exercise_allowed(uuid) to authenticated;

commit;
