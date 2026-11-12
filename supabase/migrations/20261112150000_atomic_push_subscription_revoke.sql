begin;

-- Keep push subscription storage inaccessible to API roles. Revocation is
-- performed through this narrowly scoped service-role RPC instead of direct
-- table grants.
create function cueva_private.revoke_push_subscription(
  p_student_id uuid,
  p_endpoint text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;

  if p_student_id is null
    or p_endpoint is null
    or p_endpoint not like 'https://%'
    or length(p_endpoint) > 2048 then
    raise exception 'Dispositivo inválido' using errcode = '22023';
  end if;

  update public.cueva_push_subscriptions
  set revoked_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where student_id = p_student_id
    and endpoint = p_endpoint
    and revoked_at is null;

  if found then
    return 'removed';
  end if;
  return 'not_found';
end;
$$;

revoke all on function cueva_private.revoke_push_subscription(uuid,text)
  from public, anon, authenticated, service_role;
grant usage on schema cueva_private to service_role;
grant execute on function cueva_private.revoke_push_subscription(uuid,text)
  to service_role;

create function public.cueva_revoke_push_subscription(
  p_student_id uuid,
  p_endpoint text
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select cueva_private.revoke_push_subscription($1,$2)
$$;

revoke all on function public.cueva_revoke_push_subscription(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.cueva_revoke_push_subscription(uuid,text)
  to service_role;

commit;
