-- CANDIDATE ONLY. Do not apply remotely before independent audit and real tests.
create schema if not exists cueva_private;
revoke all on schema cueva_private from public, anon, authenticated;

create table cueva_private.access_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generation bigint not null default 1 check (generation > 0),
  ready boolean not null default false,
  allowed_session uuid,
  nonce_hash text,
  session_not_before timestamptz not null default clock_timestamp(),
  operation_id uuid,
  operation_kind text check (operation_kind in ('activate','reset')),
  check ((operation_id is null) = (operation_kind is null))
);
alter table cueva_private.access_state enable row level security;
revoke all on cueva_private.access_state from public, anon, authenticated, service_role;

-- RLS helper: both the account gate and the actual session must remain valid.
create function cueva_private.ready_for_current_session()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from cueva_private.access_state s
    join auth.sessions a on a.user_id = s.user_id
    where s.user_id = auth.uid() and s.ready and s.operation_id is null
      and a.created_at >= s.session_not_before
      and a.id = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'session_id','')::uuid
  )
$$;
revoke all on function cueva_private.ready_for_current_session() from public, anon, authenticated;
grant usage on schema cueva_private to authenticated;
grant execute on function cueva_private.ready_for_current_session() to authenticated;

create function cueva_private.preflight(p_generation bigint, p_nonce_hash text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from cueva_private.access_state s
    where s.generation = p_generation and s.nonce_hash = p_nonce_hash
      and s.nonce_hash is not null and not s.ready
      and s.allowed_session is null and s.operation_id is null)
$$;
revoke all on function cueva_private.preflight(bigint,text) from public, anon, authenticated;
grant usage on schema cueva_private to service_role;
grant execute on function cueva_private.preflight(bigint,text) to service_role;
create function public.cueva_preflight(p_generation bigint, p_nonce_hash text)
returns boolean language sql security invoker set search_path = ''
as $$ select cueva_private.preflight(p_generation,p_nonce_hash) $$;
revoke all on function public.cueva_preflight(bigint,text) from public, anon, authenticated;
grant execute on function public.cueva_preflight(bigint,text) to service_role;

create table public.cueva_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','alumno'))
);
alter table public.cueva_profiles enable row level security;
revoke all on public.cueva_profiles from public, anon, authenticated;
grant select on public.cueva_profiles to authenticated;
grant select on public.cueva_profiles to service_role;
create policy cueva_profile_own on public.cueva_profiles for select to authenticated
  using (user_id = (select auth.uid()) and (select cueva_private.ready_for_current_session()));

create function cueva_private.prepare_invitation(p_user uuid, p_nonce_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_changed integer;
begin
  if p_nonce_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  insert into cueva_private.access_state(user_id, nonce_hash) values (p_user,p_nonce_hash)
    on conflict (user_id) do nothing;
  get diagnostics v_changed = row_count;
  if v_changed = 1 then
    insert into public.cueva_profiles(user_id,role) values (p_user,'alumno');
  end if;
  return v_changed = 1;
end $$;

-- Recovery capability may be installed only while the reset operation owns the gate.
create function cueva_private.prepare_recovery(p_user uuid, p_operation uuid, p_generation bigint, p_nonce_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_changed integer;
begin
  if p_nonce_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  update cueva_private.access_state set nonce_hash = p_nonce_hash
    where user_id = p_user and operation_id = p_operation and generation = p_generation
      and operation_kind = 'reset' and nonce_hash is null and not ready;
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end $$;

-- Establishment is restricted to verified invite or recovery flows, never login.
-- The server must verify token type, user, and session with Auth before calling.
create function cueva_private.bind_session(p_user uuid, p_generation bigint, p_session uuid, p_nonce_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_changed integer;
begin
  update cueva_private.access_state s set allowed_session = p_session, nonce_hash = null
    where s.user_id = p_user and s.generation = p_generation and not s.ready
      and s.operation_id is null and s.allowed_session is null
      and s.nonce_hash is not null and s.nonce_hash = p_nonce_hash
      and exists (select 1 from auth.sessions a where a.id = p_session and a.user_id = p_user
        and a.created_at >= s.session_not_before);
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end $$;

-- Never expire or automatically reassign an in-flight operation. A crash may
-- require trusted manual recovery after all previous Auth requests are quiescent.
create function cueva_private.begin_operation(p_user uuid, p_operation uuid, p_kind text, p_session uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_generation bigint;
begin
  if p_user is null or p_operation is null or p_kind not in ('activate','reset') then return null; end if;
  update cueva_private.access_state
    set ready = false,
        allowed_session = case when p_kind = 'reset' then null else allowed_session end,
        nonce_hash = case when p_kind = 'reset' then null else nonce_hash end,
        session_not_before = case when p_kind = 'reset' then clock_timestamp() else session_not_before end,
        generation = generation + case when p_kind = 'reset' then 1 else 0 end,
        operation_id = p_operation, operation_kind = p_kind
    where user_id = p_user and operation_id is null
      and (p_kind = 'reset' or (not ready and allowed_session = p_session and exists
        (select 1 from auth.sessions a where a.id = p_session and a.user_id = p_user)))
    returning generation into v_generation;
  return v_generation;
end $$;

create function cueva_private.finish_operation(p_user uuid, p_operation uuid, p_generation bigint, p_session uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_changed integer;
begin
  update cueva_private.access_state s
    set ready = (s.operation_kind = 'activate'), operation_id = null, operation_kind = null, allowed_session = null
    where s.user_id = p_user and s.operation_id = p_operation and s.generation = p_generation
      and (s.operation_kind = 'reset' or (s.allowed_session = p_session and exists
        (select 1 from auth.sessions a where a.id = p_session and a.user_id = p_user)));
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end $$;

revoke all on function cueva_private.begin_operation(uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function cueva_private.prepare_invitation(uuid,text) from public, anon, authenticated;
revoke all on function cueva_private.prepare_recovery(uuid,uuid,bigint,text) from public, anon, authenticated;
revoke all on function cueva_private.finish_operation(uuid,uuid,bigint,uuid) from public, anon, authenticated;
revoke all on function cueva_private.bind_session(uuid,bigint,uuid,text) from public, anon, authenticated;
grant usage on schema cueva_private to service_role;
grant execute on function cueva_private.prepare_invitation(uuid,text) to service_role;
grant execute on function cueva_private.prepare_recovery(uuid,uuid,bigint,text) to service_role;
grant execute on function cueva_private.begin_operation(uuid,uuid,text,uuid) to service_role;
grant execute on function cueva_private.finish_operation(uuid,uuid,bigint,uuid) to service_role;
grant execute on function cueva_private.bind_session(uuid,bigint,uuid,text) to service_role;

-- PostgREST exposes these invoker wrappers, not the private schema. Their caller
-- must be the server-only service role; the service role is a trusted authority.
create function public.cueva_begin_operation(p_user uuid, p_operation uuid, p_kind text, p_session uuid)
returns bigint language sql security invoker set search_path = ''
as $$ select cueva_private.begin_operation(p_user,p_operation,p_kind,p_session) $$;
create function public.cueva_prepare_invitation(p_user uuid, p_nonce_hash text)
returns boolean language sql security invoker set search_path = ''
as $$ select cueva_private.prepare_invitation(p_user,p_nonce_hash) $$;
create function public.cueva_prepare_recovery(p_user uuid, p_operation uuid, p_generation bigint, p_nonce_hash text)
returns boolean language sql security invoker set search_path = ''
as $$ select cueva_private.prepare_recovery(p_user,p_operation,p_generation,p_nonce_hash) $$;
create function public.cueva_finish_operation(p_user uuid, p_operation uuid, p_generation bigint, p_session uuid)
returns boolean language sql security invoker set search_path = ''
as $$ select cueva_private.finish_operation(p_user,p_operation,p_generation,p_session) $$;
create function public.cueva_bind_session(p_user uuid, p_generation bigint, p_session uuid, p_nonce_hash text)
returns boolean language sql security invoker set search_path = ''
as $$ select cueva_private.bind_session(p_user,p_generation,p_session,p_nonce_hash) $$;
revoke all on function public.cueva_begin_operation(uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.cueva_prepare_invitation(uuid,text) from public, anon, authenticated;
revoke all on function public.cueva_prepare_recovery(uuid,uuid,bigint,text) from public, anon, authenticated;
revoke all on function public.cueva_finish_operation(uuid,uuid,bigint,uuid) from public, anon, authenticated;
revoke all on function public.cueva_bind_session(uuid,bigint,uuid,text) from public, anon, authenticated;
grant execute on function public.cueva_begin_operation(uuid,uuid,text,uuid) to service_role;
grant execute on function public.cueva_prepare_invitation(uuid,text) to service_role;
grant execute on function public.cueva_prepare_recovery(uuid,uuid,bigint,text) to service_role;
grant execute on function public.cueva_finish_operation(uuid,uuid,bigint,uuid) to service_role;
grant execute on function public.cueva_bind_session(uuid,bigint,uuid,text) to service_role;
