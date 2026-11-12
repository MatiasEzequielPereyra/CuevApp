begin;

-- A logical push delivery fans out into independently leased device targets.
-- Parent delivery remains the channel-level retry coordinator.
create table public.cueva_notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.cueva_notification_deliveries(id) on delete restrict,
  notification_id uuid not null references public.cueva_notifications(id) on delete restrict,
  subscription_id uuid not null references public.cueva_push_subscriptions(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed','unknown','expired','cancelled')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default clock_timestamp(),
  last_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_started_at timestamptz,
  provider_reference text check (provider_reference is null or length(provider_reference) <= 200),
  last_error_code text check (last_error_code is null or length(last_error_code) <= 80),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (delivery_id, subscription_id),
  check (
    (status = 'processing' and lease_token is not null and lease_expires_at is not null)
    or (status <> 'processing' and lease_token is null and lease_expires_at is null)
  ),
  check (status = 'processing' or provider_started_at is null),
  check (status <> 'sent' or attempt_count > 0)
);
alter table public.cueva_notification_push_deliveries enable row level security;
revoke all on public.cueva_notification_push_deliveries from public, anon, authenticated, service_role;
create index cueva_notification_push_deliveries_due_idx
  on public.cueva_notification_push_deliveries(next_attempt_at, created_at)
  where status = 'pending';
create index cueva_notification_push_deliveries_expired_idx
  on public.cueva_notification_push_deliveries(lease_expires_at)
  where status = 'processing';

create table public.cueva_notification_push_attempts (
  id uuid primary key default gen_random_uuid(),
  push_delivery_id uuid not null references public.cueva_notification_push_deliveries(id) on delete restrict,
  attempt_number smallint not null check (attempt_number between 1 and 5),
  attempted_at timestamptz not null,
  outcome text not null check (outcome in ('sent','failed','unknown','expired')),
  error_code text check (error_code is null or length(error_code) <= 80),
  provider_reference text check (provider_reference is null or length(provider_reference) <= 200),
  recorded_at timestamptz not null default clock_timestamp(),
  unique (push_delivery_id, attempt_number)
);
alter table public.cueva_notification_push_attempts enable row level security;
revoke all on public.cueva_notification_push_attempts from public, anon, authenticated, service_role;

create function cueva_private.claim_notification_push_delivery(
  p_delivery_id uuid,
  p_parent_lease_token uuid,
  p_subscription_id uuid,
  p_lease_seconds integer default 120
)
returns table (
  claimed boolean,
  push_delivery_id uuid,
  push_lease_token uuid,
  attempt_number smallint,
  delivery_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_local_date date := (v_now at time zone 'America/Argentina/Buenos_Aires')::date;
  v_parent public.cueva_notification_deliveries%rowtype;
  v_notification public.cueva_notifications%rowtype;
  v_period public.cueva_periods%rowtype;
  v_subscription public.cueva_push_subscriptions%rowtype;
  v_child public.cueva_notification_push_deliveries%rowtype;
  v_push_lease uuid;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_delivery_id is null or p_parent_lease_token is null or p_subscription_id is null
    or p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception 'Parámetros de reserva push inválidos' using errcode = '22023';
  end if;

  select delivery.* into v_parent
  from public.cueva_notification_deliveries delivery
  where delivery.id = p_delivery_id
    and delivery.channel = 'push'
    and delivery.status = 'processing'
    and delivery.lease_token = p_parent_lease_token
    and delivery.lease_expires_at > v_now
  for key share;
  if not found then
    return query select false, null::uuid, null::uuid, null::smallint, 'stale'::text;
    return;
  end if;

  select notification.* into v_notification
  from public.cueva_notifications notification
  where notification.id = v_parent.notification_id;
  if not found or v_notification.status <> 'pending' or v_notification.due_on <= v_local_date then
    return query select false, null::uuid, null::uuid, null::smallint, 'cancelled'::text;
    return;
  end if;

  select period.* into v_period
  from public.cueva_periods period
  where period.id = v_notification.period_id;
  if not found then
    return query select false, null::uuid, null::uuid, null::smallint, 'cancelled'::text;
    return;
  end if;

  select subscription.* into v_subscription
  from public.cueva_push_subscriptions subscription
  where subscription.id = p_subscription_id
    and subscription.student_id = v_period.student_id
    and subscription.revoked_at is null
  for update;
  if not found then
    return query select false, null::uuid, null::uuid, null::smallint, 'expired'::text;
    return;
  end if;

  insert into public.cueva_notification_push_deliveries (
    delivery_id, notification_id, subscription_id, next_attempt_at
  ) values (
    p_delivery_id, v_notification.id, p_subscription_id, v_parent.last_attempt_at
  ) on conflict (delivery_id, subscription_id) do nothing;

  select child.* into v_child
  from public.cueva_notification_push_deliveries child
  where child.delivery_id = p_delivery_id and child.subscription_id = p_subscription_id
  for update;

  if v_subscription.expires_at is not null and v_subscription.expires_at <= v_now then
    update public.cueva_push_subscriptions
    set revoked_at = v_now, updated_at = v_now
    where id = p_subscription_id and revoked_at is null;
    update public.cueva_notification_push_deliveries
    set status = 'expired', last_error_code = 'push_subscription_expired',
        lease_token = null, lease_expires_at = null, provider_started_at = null, updated_at = v_now
    where id = v_child.id and status in ('pending','processing');
    return query select false, v_child.id, null::uuid, v_child.attempt_count, 'expired'::text;
    return;
  end if;

  if v_child.status = 'processing' and v_child.lease_expires_at <= v_now then
    insert into public.cueva_notification_push_attempts (
      push_delivery_id, attempt_number, attempted_at, outcome, error_code
    ) values (
      v_child.id, v_child.attempt_count, coalesce(v_child.last_attempt_at, v_now),
      case when v_child.provider_started_at is null then 'failed' else 'unknown' end,
      case when v_child.provider_started_at is null then 'push_lease_expired_before_provider' else 'push_lease_expired_unknown' end
    ) on conflict (push_delivery_id, attempt_number) do nothing;

    update public.cueva_notification_push_deliveries child
    set status = case
          when child.provider_started_at is not null then 'unknown'
          when child.attempt_count >= 5 then 'failed'
          else 'pending'
        end,
        next_attempt_at = case
          when child.provider_started_at is not null or child.attempt_count >= 5 then child.next_attempt_at
          else v_now + make_interval(mins => case child.attempt_count
            when 1 then 15 when 2 then 30 when 3 then 60 else 180 end)
        end,
        last_error_code = case
          when child.provider_started_at is null then 'push_lease_expired_before_provider'
          else 'push_lease_expired_unknown'
        end,
        lease_token = null, lease_expires_at = null, provider_started_at = null, updated_at = v_now
    where child.id = v_child.id
    returning child.* into v_child;

    if v_child.status <> 'pending' then
      return query select false, v_child.id, null::uuid, v_child.attempt_count, v_child.status;
      return;
    end if;
  end if;

  if v_child.status <> 'pending' then
    return query select false, v_child.id, null::uuid, v_child.attempt_count, v_child.status;
    return;
  end if;
  if v_child.next_attempt_at > v_now then
    return query select false, v_child.id, null::uuid, v_child.attempt_count, 'pending'::text;
    return;
  end if;
  if v_child.attempt_count >= 5 then
    update public.cueva_notification_push_deliveries
    set status = 'failed', last_error_code = coalesce(last_error_code, 'push_retries_exhausted'), updated_at = v_now
    where id = v_child.id;
    return query select false, v_child.id, null::uuid, v_child.attempt_count, 'failed'::text;
    return;
  end if;

  v_push_lease := gen_random_uuid();
  update public.cueva_notification_push_deliveries child
  set status = 'processing',
      attempt_count = child.attempt_count + 1,
      last_attempt_at = v_now,
      lease_token = v_push_lease,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      provider_started_at = null,
      updated_at = v_now
  where child.id = v_child.id
  returning child.* into v_child;

  return query select true, v_child.id, v_push_lease, v_child.attempt_count, 'processing'::text;
end;
$$;

create function public.cueva_claim_notification_push_delivery(
  p_delivery_id uuid, p_parent_lease_token uuid, p_subscription_id uuid, p_lease_seconds integer default 120
)
returns table (claimed boolean, push_delivery_id uuid, push_lease_token uuid, attempt_number smallint, delivery_status text)
language sql security invoker set search_path = ''
as $$ select * from cueva_private.claim_notification_push_delivery($1,$2,$3,$4) $$;
revoke all on function cueva_private.claim_notification_push_delivery(uuid,uuid,uuid,integer) from public, anon, authenticated, service_role;
revoke all on function public.cueva_claim_notification_push_delivery(uuid,uuid,uuid,integer) from public, anon, authenticated;
grant usage on schema cueva_private to service_role;
grant execute on function cueva_private.claim_notification_push_delivery(uuid,uuid,uuid,integer) to service_role;
grant execute on function public.cueva_claim_notification_push_delivery(uuid,uuid,uuid,integer) to service_role;

create function cueva_private.mark_notification_push_started(
  p_push_delivery_id uuid, p_push_lease_token uuid, p_delivery_id uuid, p_parent_lease_token uuid
)
returns table (started boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_child public.cueva_notification_push_deliveries%rowtype;
  v_parent public.cueva_notification_deliveries%rowtype;
  v_notification public.cueva_notifications%rowtype;
  v_period public.cueva_periods%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  select child.* into v_child from public.cueva_notification_push_deliveries child
  where child.id = p_push_delivery_id for update;
  if not found then return query select false; return; end if;
  select parent.* into v_parent from public.cueva_notification_deliveries parent
  where parent.id = p_delivery_id and parent.channel = 'push'
    and parent.status = 'processing' and parent.lease_token = p_parent_lease_token
    and parent.lease_expires_at > v_now for key share;
  if not found or v_child.delivery_id <> p_delivery_id or v_child.status <> 'processing'
    or v_child.lease_token is distinct from p_push_lease_token or v_child.lease_expires_at <= v_now then
    return query select false; return;
  end if;
  select notification.* into v_notification from public.cueva_notifications notification
  where notification.id = v_child.notification_id;
  select period.* into v_period from public.cueva_periods period
  where period.id = v_notification.period_id;
  if v_notification.status <> 'pending'
    or v_notification.due_on <= (v_now at time zone 'America/Argentina/Buenos_Aires')::date
    or not exists (
      select 1 from public.cueva_notification_preferences preference
      where preference.student_id = v_period.student_id and preference.push_enabled
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
create function public.cueva_mark_notification_push_started(
  p_push_delivery_id uuid, p_push_lease_token uuid, p_delivery_id uuid, p_parent_lease_token uuid
)
returns table (started boolean)
language sql security invoker set search_path = ''
as $$ select * from cueva_private.mark_notification_push_started($1,$2,$3,$4) $$;
revoke all on function cueva_private.mark_notification_push_started(uuid,uuid,uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.cueva_mark_notification_push_started(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function cueva_private.mark_notification_push_started(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.cueva_mark_notification_push_started(uuid,uuid,uuid,uuid) to service_role;

create function cueva_private.finalize_notification_push_delivery(
  p_push_delivery_id uuid, p_push_lease_token uuid, p_outcome text,
  p_provider_reference text default null, p_error_code text default null
)
returns table (finalized boolean, delivery_status text, attempt_number smallint)
language plpgsql security definer set search_path = ''
as $$
declare
  v_child public.cueva_notification_push_deliveries%rowtype;
  v_notification public.cueva_notifications%rowtype;
  v_period public.cueva_periods%rowtype;
  v_now timestamptz;
  v_local_date date;
  v_status text;
  v_error text := p_error_code;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_push_delivery_id is null or p_push_lease_token is null
    or p_outcome not in ('sent','failed','unknown','expired')
    or (p_outcome <> 'sent' and (p_error_code is null or length(btrim(p_error_code)) = 0))
    or (p_outcome = 'sent' and p_error_code is not null)
    or (p_provider_reference is not null and length(p_provider_reference) > 200)
    or (p_error_code is not null and length(p_error_code) > 80) then
    raise exception 'Resultado de entrega push inválido' using errcode = '22023';
  end if;
  select child.* into v_child from public.cueva_notification_push_deliveries child
  where child.id = p_push_delivery_id for update;
  if not found then raise exception 'Entrega push inexistente' using errcode = 'P0002'; end if;
  v_now := clock_timestamp();
  if v_child.status <> 'processing' or v_child.lease_token is distinct from p_push_lease_token
    or v_child.lease_expires_at <= v_now then
    return query select false, v_child.status, v_child.attempt_count; return;
  end if;
  select notification.* into v_notification from public.cueva_notifications notification
  where notification.id = v_child.notification_id;
  select period.* into v_period from public.cueva_periods period
  where period.id = v_notification.period_id;
  v_local_date := (v_now at time zone 'America/Argentina/Buenos_Aires')::date;

  if p_outcome = 'sent' then
    v_status := 'sent';
  elsif p_outcome = 'unknown' then
    v_status := 'unknown';
  elsif p_outcome = 'expired' then
    v_status := 'expired';
  elsif v_notification.status <> 'pending' or v_notification.due_on <= v_local_date
    or not exists (
      select 1 from public.cueva_notification_preferences preference
      where preference.student_id = v_period.student_id and preference.push_enabled
    ) then
    v_status := 'cancelled';
    v_error := 'push_target_no_longer_eligible';
  elsif v_child.attempt_count >= 5 then
    v_status := 'failed';
  else
    v_status := 'pending';
  end if;

  insert into public.cueva_notification_push_attempts (
    push_delivery_id, attempt_number, attempted_at, outcome, error_code, provider_reference
  ) values (
    v_child.id, v_child.attempt_count, coalesce(v_child.last_attempt_at, v_now),
    p_outcome, p_error_code, p_provider_reference
  );

  update public.cueva_notification_push_deliveries child
  set status = v_status,
      next_attempt_at = case when v_status = 'pending'
        then v_now + make_interval(mins => case v_child.attempt_count
          when 1 then 15 when 2 then 30 when 3 then 60 else 180 end)
        else child.next_attempt_at end,
      provider_reference = p_provider_reference,
      last_error_code = case when v_status = 'sent' then null else v_error end,
      lease_token = null, lease_expires_at = null, provider_started_at = null, updated_at = v_now
  where child.id = v_child.id;

  if p_outcome = 'expired' then
    update public.cueva_push_subscriptions
    set revoked_at = v_now, updated_at = v_now
    where id = v_child.subscription_id and revoked_at is null;
  end if;

  return query select true, v_status, v_child.attempt_count;
end;
$$;

create function public.cueva_finalize_notification_push_delivery(
  p_push_delivery_id uuid, p_push_lease_token uuid, p_outcome text,
  p_provider_reference text default null, p_error_code text default null
)
returns table (finalized boolean, delivery_status text, attempt_number smallint)
language sql security invoker set search_path = ''
as $$ select * from cueva_private.finalize_notification_push_delivery($1,$2,$3,$4,$5) $$;
revoke all on function cueva_private.finalize_notification_push_delivery(uuid,uuid,text,text,text) from public, anon, authenticated, service_role;
revoke all on function public.cueva_finalize_notification_push_delivery(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function cueva_private.finalize_notification_push_delivery(uuid,uuid,text,text,text) to service_role;
grant execute on function public.cueva_finalize_notification_push_delivery(uuid,uuid,text,text,text) to service_role;

create function cueva_private.create_notification_push_unknown_alert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_parent public.cueva_notification_deliveries%rowtype;
  v_notification public.cueva_notifications%rowtype;
  v_period public.cueva_periods%rowtype;
  v_student public.cueva_students%rowtype;
  v_attempt smallint;
begin
  if old.status = 'unknown' or new.status <> 'unknown' then return new; end if;
  select parent.* into v_parent from public.cueva_notification_deliveries parent where parent.id = new.delivery_id;
  if not found then return new; end if;
  select notification.* into v_notification from public.cueva_notifications notification where notification.id = new.notification_id;
  if not found then return new; end if;
  select period.* into v_period from public.cueva_periods period where period.id = v_notification.period_id;
  if not found then return new; end if;
  select student.* into v_student from public.cueva_students student where student.id = v_period.student_id;
  if not found then return new; end if;
  v_attempt := greatest(1, least(5, v_parent.attempt_count));
  insert into public.cueva_notification_admin_alerts (
    delivery_id, notification_id, student_id, student_name, period_month,
    reminder_days, channel, attempt_count, failed_at, alert_type
  ) values (
    v_parent.id, v_notification.id, v_student.id,
    concat_ws(' ', v_student.first_name, v_student.last_name), v_period.month,
    v_notification.reminder_days, 'push', v_attempt, clock_timestamp(),
    'provider_outcome_unknown'
  ) on conflict (delivery_id) do nothing;
  return new;
end;
$$;
revoke all on function cueva_private.create_notification_push_unknown_alert() from public, anon, authenticated, service_role;
create trigger cueva_notification_push_unknown_admin_alert
  after update of status on public.cueva_notification_push_deliveries
  for each row when (old.status is distinct from new.status and new.status = 'unknown')
  execute function cueva_private.create_notification_push_unknown_alert();

-- Channel-level uncertainty is now also valid for Push; the device-level
-- ledger remains the source of which individual endpoints are uncertain.
create or replace function cueva_private.finalize_notification_delivery(
  p_delivery_id uuid, p_lease_token uuid, p_outcome text,
  p_provider_reference text default null, p_error_code text default null
)
returns table (finalized boolean, delivery_status text, attempt_number smallint, notification_status text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz;
  v_local_date date;
  v_delivery public.cueva_notification_deliveries%rowtype;
  v_notification public.cueva_notifications%rowtype;
  v_delivery_status text;
  v_error_code text;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_delivery_id is null or p_lease_token is null then
    raise exception 'Identificador de entrega y reserva son obligatorios' using errcode = '22023';
  end if;
  if p_outcome is null or p_outcome not in ('sent','failed','skipped','unknown') then
    raise exception 'Resultado de entrega inválido' using errcode = '22023';
  end if;
  if p_provider_reference is not null and length(p_provider_reference) > 200 then
    raise exception 'Referencia de proveedor inválida' using errcode = '22023';
  end if;
  if p_error_code is not null and length(p_error_code) > 80 then
    raise exception 'Código de error inválido' using errcode = '22023';
  end if;
  if p_outcome in ('failed','skipped','unknown')
    and (p_error_code is null or length(btrim(p_error_code)) = 0) then
    raise exception 'El resultado requiere un código de motivo' using errcode = '22023';
  end if;
  if p_outcome = 'sent' and p_error_code is not null then
    raise exception 'Un envío exitoso no admite código de error' using errcode = '22023';
  end if;
  select delivery.* into v_delivery from public.cueva_notification_deliveries delivery
  where delivery.id = p_delivery_id for update;
  if not found then raise exception 'Entrega inexistente' using errcode = 'P0002'; end if;
  select notification.* into v_notification from public.cueva_notifications notification
  where notification.id = v_delivery.notification_id for update;
  v_now := clock_timestamp();
  v_local_date := (v_now at time zone 'America/Argentina/Buenos_Aires')::date;
  if v_delivery.status <> 'processing' or v_delivery.lease_token is distinct from p_lease_token
    or v_delivery.lease_expires_at <= v_now then
    return query select false, v_delivery.status, v_delivery.attempt_count, v_notification.status; return;
  end if;
  if p_outcome = 'unknown' and v_delivery.channel not in ('email','push') then
    raise exception 'Resultado incierto no permitido para este canal' using errcode = '22023';
  end if;
  v_error_code := p_error_code;
  if p_outcome = 'sent' then
    v_delivery_status := 'sent';
  elsif p_outcome = 'unknown' then
    v_delivery_status := 'failed';
  elsif v_notification.status <> 'pending' then
    v_delivery_status := 'cancelled';
    v_error_code := case when v_notification.status = 'cancelled' then 'notification_cancelled' else 'notification_completed' end;
  elsif v_notification.due_on <= v_local_date then
    v_delivery_status := 'cancelled';
    v_error_code := 'delivery_after_due_date';
  elsif p_outcome = 'skipped' then
    v_delivery_status := 'skipped';
  elsif v_delivery.attempt_count >= 5 then
    v_delivery_status := 'failed';
  else
    v_delivery_status := 'pending';
  end if;
  insert into public.cueva_notification_attempts (
    delivery_id, attempt_number, attempted_at, outcome, error_code, provider_reference
  ) values (
    v_delivery.id, v_delivery.attempt_count, coalesce(v_delivery.last_attempt_at, v_now),
    p_outcome, p_error_code, p_provider_reference
  );
  update public.cueva_notification_deliveries delivery
  set status = v_delivery_status,
      next_attempt_at = case when v_delivery_status = 'pending'
        then v_now + make_interval(mins => case v_delivery.attempt_count
          when 1 then 15 when 2 then 30 when 3 then 60 else 180 end)
        else delivery.next_attempt_at end,
      provider_reference = p_provider_reference,
      last_error_code = case when v_delivery_status = 'sent' then null else v_error_code end,
      lease_token = null, lease_expires_at = null, provider_started_at = null, updated_at = v_now
  where delivery.id = v_delivery.id returning delivery.status into v_delivery_status;
  update public.cueva_notifications notification
  set status = 'completed', updated_at = v_now
  where notification.id = v_notification.id and notification.status = 'pending'
    and not exists (
      select 1 from public.cueva_notification_deliveries remaining
      where remaining.notification_id = notification.id and remaining.status in ('pending','processing')
    );
  select notification.status into v_notification.status
  from public.cueva_notifications notification where notification.id = v_notification.id;
  return query select true, v_delivery_status, v_delivery.attempt_count, v_notification.status;
end;
$$;

commit;
