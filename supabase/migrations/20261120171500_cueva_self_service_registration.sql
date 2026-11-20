begin;

-- Self-registration is available only to a verified Auth user in its own
-- real Supabase session. Existing students are never claimed by email.
-- No direct grants or RLS policy changes are introduced on student data.
alter table public.cueva_student_invitations
  drop constraint cueva_student_invitations_state_check;
alter table public.cueva_student_invitations
  add constraint cueva_student_invitations_state_check
  check (state in ('blocked','processing','sent','review','failed','self_registered'));

create function cueva_private.complete_self_registration(p_user uuid, p_session uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_user;
  v_email text;
  v_first text;
  v_last text;
  v_student uuid;
  v_session_created timestamptz;
  v_user auth.users%rowtype;
begin
  if v_user_id is null or p_session is null then return 'unauthenticated'; end if;

  -- Lock the Auth user so two simultaneous confirmation callbacks cannot
  -- create two separate student records for the same identity.
  select * into v_user from auth.users where id = v_user_id for update;
  if not found or v_user.email_confirmed_at is null
    or v_user.confirmation_sent_at is null then
    return 'unverified';
  end if;

  select created_at into v_session_created
    from auth.sessions where id = p_session and user_id = v_user_id;
  if v_session_created is null then return 'unauthenticated'; end if;

  -- Never overwrite or activate an invited, administrative, recovering
  -- or otherwise existing user/account (including a pending gate).
  if exists(select 1 from public.cueva_profiles where user_id = v_user_id)
    or exists(select 1 from cueva_private.access_state where user_id = v_user_id)
    or exists(select 1 from public.cueva_student_invitations where user_id = v_user_id) then
    return 'existing';
  end if;

  v_email := lower(btrim(v_user.email));
  if v_email is null or length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return 'invalid';
  end if;

  -- Email verification alone does NOT authorize taking over an existing
  -- student file with its private membership, payments and routines.
  if exists(select 1 from public.cueva_students where email = v_email) then
    return 'needs_review';
  end if;

  -- Auth metadata is user-controlled and may only supply non-privileged
  -- display names. It never determines roles, access or student linkage.
  v_first := btrim(coalesce(v_user.raw_user_meta_data ->> 'first_name', ''));
  v_last := btrim(coalesce(v_user.raw_user_meta_data ->> 'last_name', ''));
  if length(v_first) not between 1 and 80
    or length(v_last) not between 1 and 80 then
    return 'invalid';
  end if;

  v_student := gen_random_uuid();
  insert into public.cueva_students
    (id, first_name, last_name, email, dni, joined_on, active)
  values
    (v_student, v_first, v_last, v_email, null,
      (now() at time zone 'America/Argentina/Buenos_Aires')::date, false);

  -- Reuse the established UUID-based ownership path for routines and dues,
  -- without sending or synthesizing an administrative invitation.
  insert into public.cueva_student_invitations
    (student_id, email, user_id, state, lease, requested_by, finished_at)
  values
    (v_student, v_email, v_user_id, 'self_registered',
      gen_random_uuid(), v_user_id, now());

  insert into public.cueva_profiles (user_id, role)
    values (v_user_id, 'alumno');

  -- The authenticated confirmation session must remain valid and no
  -- prior/foreign session may acquire a ready gate via this function.
  insert into cueva_private.access_state
    (user_id, ready, session_not_before)
  values (v_user_id, true, v_session_created);

  return 'created';
exception when unique_violation then
  -- Unique conflicts roll back this function's writes. No email/UUID
  -- guessing and no automatic adoption of an existing student file.
  return 'needs_review';
end;
$$;

revoke all on function cueva_private.complete_self_registration(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.complete_self_registration(uuid,uuid)
  to service_role;

-- The only REST-accessible wrapper is INVOKER and available to the
-- server-side service key. Public and authenticated clients cannot call it.
create function public.cueva_complete_self_registration(p_user uuid, p_session uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select cueva_private.complete_self_registration(p_user, p_session)
$$;
revoke all on function public.cueva_complete_self_registration(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.cueva_complete_self_registration(uuid,uuid)
  to service_role;

commit;
