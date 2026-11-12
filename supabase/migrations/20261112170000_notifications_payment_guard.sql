begin;

-- Payment and reversal writes already serialize through this transaction lock.
-- Notification provider-start and inbox creation use the same lock so their
-- eligibility decision has a single database ordering with financial writes.
create function cueva_private.guard_notification_period(p_notification_id uuid)
returns table (eligible boolean, balance_cents text, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification public.cueva_notifications%rowtype;
  v_period public.cueva_periods%rowtype;
  v_student_active boolean;
  v_balance bigint;
  v_now timestamptz;
  v_reason text;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_notification_id is null then
    raise exception 'Notificación requerida' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(903004001);

  select notification.* into v_notification
  from public.cueva_notifications notification
  where notification.id = p_notification_id;
  if not found then
    return query select false, null::text, 'notification_missing'::text;
    return;
  end if;

  select period.* into v_period
  from public.cueva_periods period
  where period.id = v_notification.period_id
  for update;
  if not found then
    return query select false, null::text, 'period_missing'::text;
    return;
  end if;

  select notification.* into v_notification
  from public.cueva_notifications notification
  where notification.id = p_notification_id
  for update;

  select student.active into v_student_active
  from public.cueva_students student
  where student.id = v_period.student_id;

  select v_period.cents - coalesce(sum(payment.cents), 0)::bigint
  into v_balance
  from public.cueva_payments payment
  where payment.period_id = v_period.id
    and not exists (
      select 1 from public.cueva_reversals reversal
      where reversal.payment_id = payment.id
    );

  v_now := clock_timestamp();
  if v_notification.status <> 'pending' then
    v_reason := 'notification_not_pending';
  elsif not coalesce(v_student_active, false) then
    v_reason := 'student_inactive';
  elsif v_notification.due_on <= (v_now at time zone 'America/Argentina/Buenos_Aires')::date then
    v_reason := 'due_date_passed';
  elsif v_balance <= 0 then
    v_reason := 'balance_zero';
  end if;

  if v_reason is not null then
    if v_notification.status = 'pending' then
      update public.cueva_notifications
      set status = 'cancelled',
          cancellation_reason = v_reason,
          updated_at = v_now
      where id = p_notification_id and status = 'pending';

      -- Do not interrupt an external request that already crossed its
      -- provider-start boundary. Its result remains reconcilable.
      update public.cueva_notification_deliveries
      set status = 'cancelled',
          last_error_code = v_reason,
          lease_token = null,
          lease_expires_at = null,
          provider_started_at = null,
          updated_at = v_now
      where notification_id = p_notification_id
        and status in ('pending','processing')
        and provider_started_at is null;
    end if;
    return query select false, v_balance::text, v_reason;
    return;
  end if;

  return query select true, v_balance::text, null::text;
end;
$$;
revoke all on function cueva_private.guard_notification_period(uuid)
  from public, anon, authenticated, service_role;

create or replace function cueva_private.mark_notification_delivery_started(
  p_delivery_id uuid,
  p_lease_token uuid
)
returns table (started boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.cueva_notification_deliveries%rowtype;
  v_notification_id uuid;
  v_guard record;
  v_now timestamptz;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_delivery_id is null or p_lease_token is null then
    raise exception 'Identificador de entrega y reserva son obligatorios' using errcode = '22023';
  end if;

  select delivery.notification_id into v_notification_id
  from public.cueva_notification_deliveries delivery
  where delivery.id = p_delivery_id;
  if not found then return query select false; return; end if;

  select * into v_guard
  from cueva_private.guard_notification_period(v_notification_id);
  if not v_guard.eligible then return query select false; return; end if;

  select delivery.* into v_delivery
  from public.cueva_notification_deliveries delivery
  where delivery.id = p_delivery_id
  for update;
  if not found then return query select false; return; end if;

  v_now := clock_timestamp();
  if v_delivery.channel <> 'email'
    or v_delivery.status <> 'processing'
    or v_delivery.lease_token is distinct from p_lease_token
    or v_delivery.lease_expires_at <= v_now then
    return query select false;
    return;
  end if;

  update public.cueva_notification_deliveries
  set provider_started_at = coalesce(provider_started_at, v_now), updated_at = v_now
  where id = p_delivery_id;
  return query select true;
end;
$$;
revoke all on function cueva_private.mark_notification_delivery_started(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.mark_notification_delivery_started(uuid,uuid)
  to service_role;

create or replace function cueva_private.mark_notification_push_started(
  p_push_delivery_id uuid,
  p_push_lease_token uuid,
  p_delivery_id uuid,
  p_parent_lease_token uuid
)
returns table (started boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child public.cueva_notification_push_deliveries%rowtype;
  v_parent public.cueva_notification_deliveries%rowtype;
  v_notification_id uuid;
  v_guard record;
  v_now timestamptz;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_push_delivery_id is null or p_push_lease_token is null
    or p_delivery_id is null or p_parent_lease_token is null then
    raise exception 'Identificadores y reservas push son obligatorios' using errcode = '22023';
  end if;

  select child.notification_id into v_notification_id
  from public.cueva_notification_push_deliveries child
  where child.id = p_push_delivery_id and child.delivery_id = p_delivery_id;
  if not found then return query select false; return; end if;

  select * into v_guard
  from cueva_private.guard_notification_period(v_notification_id);
  if not v_guard.eligible then return query select false; return; end if;

  v_now := clock_timestamp();
  select parent.* into v_parent
  from public.cueva_notification_deliveries parent
  where parent.id = p_delivery_id and parent.channel = 'push'
    and parent.status = 'processing' and parent.lease_token = p_parent_lease_token
    and parent.lease_expires_at > v_now
  for key share;
  if not found then return query select false; return; end if;

  select child.* into v_child
  from public.cueva_notification_push_deliveries child
  where child.id = p_push_delivery_id
  for update;
  if not found or v_child.delivery_id <> p_delivery_id or v_child.status <> 'processing'
    or v_child.lease_token is distinct from p_push_lease_token
    or v_child.lease_expires_at <= v_now then
    return query select false; return;
  end if;

  if exists (
      select 1 from public.cueva_notification_preferences preference
      where preference.student_id = (
        select period.student_id from public.cueva_periods period
        join public.cueva_notifications notification on notification.period_id = period.id
        where notification.id = v_notification_id
      ) and preference.push_enabled = false
    )
    or not exists (
      select 1 from public.cueva_push_subscriptions subscription
      where subscription.id = v_child.subscription_id and subscription.revoked_at is null
        and (subscription.expires_at is null or subscription.expires_at > v_now)
    ) then
    update public.cueva_notification_push_deliveries
    set status = 'cancelled', last_error_code = 'push_target_no_longer_eligible',
        lease_token = null, lease_expires_at = null, provider_started_at = null, updated_at = v_now
    where id = v_child.id;
    return query select false; return;
  end if;

  update public.cueva_notification_push_deliveries
  set provider_started_at = coalesce(provider_started_at, v_now), updated_at = v_now
  where id = v_child.id;
  return query select true;
end;
$$;
revoke all on function cueva_private.mark_notification_push_started(uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.mark_notification_push_started(uuid,uuid,uuid,uuid)
  to service_role;

create function cueva_private.create_notification_inbox_guarded(
  p_delivery_id uuid,
  p_lease_token uuid,
  p_student_id uuid,
  p_user_id uuid,
  p_title text,
  p_body text,
  p_expected_balance_cents bigint
)
returns table (created boolean, balance_cents text, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.cueva_notification_deliveries%rowtype;
  v_notification_id uuid;
  v_guard record;
  v_inserted integer;
  v_now timestamptz;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_delivery_id is null or p_lease_token is null or p_student_id is null or p_user_id is null
    or p_title is null or length(btrim(p_title)) not between 1 and 120
    or p_body is null or length(btrim(p_body)) not between 1 and 1000
    or p_expected_balance_cents is null or p_expected_balance_cents <= 0 then
    raise exception 'Contenido o identidad de bandeja inválidos' using errcode = '22023';
  end if;

  select delivery.notification_id into v_notification_id
  from public.cueva_notification_deliveries delivery
  where delivery.id = p_delivery_id and delivery.channel = 'internal';
  if not found then
    return query select false, null::text, 'delivery_missing'::text;
    return;
  end if;

  select * into v_guard
  from cueva_private.guard_notification_period(v_notification_id);
  if not v_guard.eligible then
    return query select false, v_guard.balance_cents, v_guard.reason;
    return;
  end if;
  if v_guard.balance_cents::bigint <> p_expected_balance_cents then
    return query select false, v_guard.balance_cents, 'balance_changed'::text;
    return;
  end if;

  select delivery.* into v_delivery
  from public.cueva_notification_deliveries delivery
  where delivery.id = p_delivery_id
  for update;
  v_now := clock_timestamp();
  if not found or v_delivery.status <> 'processing'
    or v_delivery.lease_token is distinct from p_lease_token
    or v_delivery.lease_expires_at <= v_now then
    return query select false, v_guard.balance_cents, 'lease_stale'::text;
    return;
  end if;

  insert into public.cueva_notification_inbox (
    delivery_id, notification_id, student_id, user_id, title, body
  ) values (
    p_delivery_id, v_notification_id, p_student_id, p_user_id, p_title, p_body
  ) on conflict (delivery_id) do nothing;
  get diagnostics v_inserted = row_count;

  -- Existing row means an earlier idempotent call already created this inbox
  -- item; do not replace its content or create a duplicate.
  return query select true, v_guard.balance_cents, null::text;
end;
$$;
revoke all on function cueva_private.create_notification_inbox_guarded(uuid,uuid,uuid,uuid,text,text,bigint)
  from public, anon, authenticated, service_role;

create function public.cueva_create_notification_inbox_guarded(
  p_delivery_id uuid,
  p_lease_token uuid,
  p_student_id uuid,
  p_user_id uuid,
  p_title text,
  p_body text,
  p_expected_balance_cents bigint
)
returns table (created boolean, balance_cents text, reason text)
language sql
security invoker
set search_path = ''
as $$
  select * from cueva_private.create_notification_inbox_guarded(
    $1,$2,$3,$4,$5,$6,$7
  )
$$;
revoke all on function public.cueva_create_notification_inbox_guarded(uuid,uuid,uuid,uuid,text,text,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.cueva_create_notification_inbox_guarded(uuid,uuid,uuid,uuid,text,text,bigint)
  to service_role;

commit;
