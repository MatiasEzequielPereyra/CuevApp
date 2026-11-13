begin;

-- Return the balance captured by the same transaction that records the
-- provider-start boundary. Billing writes use the same advisory lock, so the
-- payload can be rebuilt from this exact serialized balance before dispatch.
create function cueva_private.mark_notification_delivery_started_with_balance(
  p_delivery_id uuid,
  p_lease_token uuid
)
returns table (started boolean, balance_cents text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started boolean;
  v_notification_id uuid;
  v_guard record;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;

  select result.started into v_started
  from cueva_private.mark_notification_delivery_started(p_delivery_id, p_lease_token) result;
  if not coalesce(v_started, false) then
    return query select false, null::text;
    return;
  end if;

  select delivery.notification_id into v_notification_id
  from public.cueva_notification_deliveries delivery
  where delivery.id = p_delivery_id;
  if not found then
    return query select false, null::text;
    return;
  end if;

  select * into v_guard
  from cueva_private.guard_notification_period(v_notification_id);
  if not v_guard.eligible then
    return query select false, v_guard.balance_cents;
    return;
  end if;

  return query select true, v_guard.balance_cents;
end;
$$;
revoke all on function cueva_private.mark_notification_delivery_started_with_balance(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.mark_notification_delivery_started_with_balance(uuid,uuid)
  to service_role;

create function public.cueva_mark_notification_delivery_started_with_balance(
  p_delivery_id uuid,
  p_lease_token uuid
)
returns table (started boolean, balance_cents text)
language sql
security invoker
set search_path = ''
as $$
  select * from cueva_private.mark_notification_delivery_started_with_balance($1,$2)
$$;
revoke all on function public.cueva_mark_notification_delivery_started_with_balance(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.cueva_mark_notification_delivery_started_with_balance(uuid,uuid)
  to service_role;

create function cueva_private.mark_notification_push_started_with_balance(
  p_push_delivery_id uuid,
  p_push_lease_token uuid,
  p_delivery_id uuid,
  p_parent_lease_token uuid
)
returns table (started boolean, balance_cents text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started boolean;
  v_notification_id uuid;
  v_guard record;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;

  select result.started into v_started
  from cueva_private.mark_notification_push_started(
    p_push_delivery_id, p_push_lease_token, p_delivery_id, p_parent_lease_token
  ) result;
  if not coalesce(v_started, false) then
    return query select false, null::text;
    return;
  end if;

  select child.notification_id into v_notification_id
  from public.cueva_notification_push_deliveries child
  where child.id = p_push_delivery_id and child.delivery_id = p_delivery_id;
  if not found then
    return query select false, null::text;
    return;
  end if;

  select * into v_guard
  from cueva_private.guard_notification_period(v_notification_id);
  if not v_guard.eligible then
    return query select false, v_guard.balance_cents;
    return;
  end if;

  return query select true, v_guard.balance_cents;
end;
$$;
revoke all on function cueva_private.mark_notification_push_started_with_balance(uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.mark_notification_push_started_with_balance(uuid,uuid,uuid,uuid)
  to service_role;

create function public.cueva_mark_notification_push_started_with_balance(
  p_push_delivery_id uuid,
  p_push_lease_token uuid,
  p_delivery_id uuid,
  p_parent_lease_token uuid
)
returns table (started boolean, balance_cents text)
language sql
security invoker
set search_path = ''
as $$
  select * from cueva_private.mark_notification_push_started_with_balance($1,$2,$3,$4)
$$;
revoke all on function public.cueva_mark_notification_push_started_with_balance(uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.cueva_mark_notification_push_started_with_balance(uuid,uuid,uuid,uuid)
  to service_role;

commit;
