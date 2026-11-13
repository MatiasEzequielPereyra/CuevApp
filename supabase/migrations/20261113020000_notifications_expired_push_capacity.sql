begin;

-- Expired browser subscriptions must not consume the student's active-device cap.
create or replace function cueva_private.register_push_subscription(
  p_student_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_expires_at timestamptz default null
)
returns table (outcome text, subscription_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_existing_id uuid;
  v_existing_student_id uuid;
  v_active_count integer;
  v_subscription_id uuid;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;

  if p_student_id is null
    or p_endpoint is null or p_endpoint not like 'https://%' or length(p_endpoint) > 2048
    or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{40,100}$'
    or p_auth_secret is null or p_auth_secret !~ '^[A-Za-z0-9_-]{16,100}$'
    or (p_expires_at is not null and p_expires_at <= clock_timestamp()) then
    raise exception 'Suscripción push inválida' using errcode = '22023';
  end if;

  -- This row lock is the per-student mutex. The following count and insert
  -- execute in order within the same transaction.
  select student.id into v_student_id
  from public.cueva_students student
  where student.id = p_student_id
  for update;
  if not found then
    return query select 'student_not_found'::text, null::uuid;
    return;
  end if;

  select subscription.id, subscription.student_id
  into v_existing_id, v_existing_student_id
  from public.cueva_push_subscriptions subscription
  where subscription.endpoint = p_endpoint
  for update;

  if found then
    if v_existing_student_id is distinct from p_student_id then
      return query select 'endpoint_in_use'::text, null::uuid;
      return;
    end if;

    update public.cueva_push_subscriptions
    set p256dh = p_p256dh,
        auth_secret = p_auth_secret,
        expires_at = p_expires_at,
        revoked_at = null,
        updated_at = clock_timestamp()
    where id = v_existing_id;

    return query select 'updated'::text, v_existing_id;
    return;
  end if;

  select count(*)::integer into v_active_count
  from public.cueva_push_subscriptions subscription
  where subscription.student_id = p_student_id
    and subscription.revoked_at is null
    and (subscription.expires_at is null or subscription.expires_at > clock_timestamp());

  if v_active_count >= 10 then
    return query select 'limit_reached'::text, null::uuid;
    return;
  end if;

  insert into public.cueva_push_subscriptions (
    student_id, endpoint, p256dh, auth_secret, expires_at
  ) values (
    p_student_id, p_endpoint, p_p256dh, p_auth_secret, p_expires_at
  )
  on conflict (endpoint) do nothing
  returning id into v_subscription_id;

  if v_subscription_id is null then
    -- A different student may concurrently claim the globally unique endpoint.
    select subscription.id, subscription.student_id
    into v_existing_id, v_existing_student_id
    from public.cueva_push_subscriptions subscription
    where subscription.endpoint = p_endpoint
    for update;

    if v_existing_student_id <> p_student_id then
      return query select 'endpoint_in_use'::text, null::uuid;
      return;
    end if;

    update public.cueva_push_subscriptions
    set p256dh = p_p256dh,
        auth_secret = p_auth_secret,
        expires_at = p_expires_at,
        revoked_at = null,
        updated_at = clock_timestamp()
    where id = v_existing_id;

    return query select 'updated'::text, v_existing_id;
    return;
  end if;

  return query select 'registered'::text, v_subscription_id;
end;
$$;

commit;
