begin;

-- Atomically recover expired reservations and claim due channel deliveries.
-- This function reserves work only; provider calls and their outcomes remain
-- outside the transaction and must be recorded by a separate worker operation.
create function cueva_private.claim_notification_deliveries(
  p_batch_size integer default 25,
  p_lease_seconds integer default 300
)
returns table (
  delivery_id uuid,
  notification_id uuid,
  channel text,
  attempt_number smallint,
  lease_token uuid,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_local_date date := (v_now at time zone 'America/Argentina/Buenos_Aires')::date;
  v_expired record;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;

  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 100 then
    raise exception 'Tamaño de lote inválido' using errcode = '22023';
  end if;

  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'Duración de reserva inválida' using errcode = '22023';
  end if;

  -- A timed-out reservation has an unknown provider outcome. Preserve that
  -- fact in the append-only attempt ledger before releasing or exhausting it.
  for v_expired in
    select
      delivery.id,
      delivery.attempt_count,
      notification.due_on
    from public.cueva_notification_deliveries delivery
    join public.cueva_notifications notification
      on notification.id = delivery.notification_id
    where delivery.status = 'processing'
      and delivery.lease_expires_at <= v_now
    order by delivery.lease_expires_at, delivery.created_at
    for update of delivery skip locked
    limit p_batch_size
  loop
    if v_expired.attempt_count > 0 then
      insert into public.cueva_notification_attempts (
        delivery_id,
        attempt_number,
        attempted_at,
        outcome,
        error_code
      )
      values (
        v_expired.id,
        v_expired.attempt_count,
        v_now,
        'unknown',
        'lease_expired'
      )
      on conflict on constraint cueva_notification_attempts_delivery_id_attempt_number_key do nothing;
    end if;

    update public.cueva_notification_deliveries delivery
    set
      status = case
        when v_expired.due_on <= v_local_date then 'cancelled'
        when v_expired.attempt_count >= 5 then 'failed'
        else 'pending'
      end,
      next_attempt_at = case
        when v_expired.due_on <= v_local_date
          or v_expired.attempt_count >= 5
          then delivery.next_attempt_at
        else v_now + make_interval(mins => case v_expired.attempt_count
          when 1 then 15
          when 2 then 30
          when 3 then 60
          else 180
        end)
      end,
      last_error_code = case
        when v_expired.due_on <= v_local_date then 'lease_expired_after_due_date'
        else 'lease_expired'
      end,
      lease_token = null,
      lease_expires_at = null,
      updated_at = v_now
    where delivery.id = v_expired.id;
  end loop;

  -- SKIP LOCKED lets concurrent workers reserve different rows without
  -- waiting on one another. Incrementing attempt_count and assigning the
  -- lease happen in the same UPDATE/transaction as selecting the row.
  return query
  with candidates as (
    select delivery.id
    from public.cueva_notification_deliveries delivery
    join public.cueva_notifications notification
      on notification.id = delivery.notification_id
    where delivery.status = 'pending'
      and delivery.attempt_count < 5
      and delivery.next_attempt_at <= v_now
      and notification.status = 'pending'
      and notification.scheduled_at <= v_now
      and notification.due_on > v_local_date
    order by delivery.next_attempt_at, delivery.created_at, delivery.id
    for update of delivery skip locked
    limit p_batch_size
  ),
  claimed as (
    update public.cueva_notification_deliveries delivery
    set
      status = 'processing',
      attempt_count = delivery.attempt_count + 1,
      last_attempt_at = v_now,
      lease_token = gen_random_uuid(),
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      updated_at = v_now
    from candidates
    where delivery.id = candidates.id
    returning
      delivery.id,
      delivery.notification_id,
      delivery.channel,
      delivery.attempt_count,
      delivery.lease_token,
      delivery.lease_expires_at
  )
  select
    claimed.id,
    claimed.notification_id,
    claimed.channel,
    claimed.attempt_count,
    claimed.lease_token,
    claimed.lease_expires_at
  from claimed;
end;
$$;

revoke all on function cueva_private.claim_notification_deliveries(integer, integer)
  from public, anon, authenticated, service_role;
grant usage on schema cueva_private to service_role;
grant execute on function cueva_private.claim_notification_deliveries(integer, integer)
  to service_role;

create function public.cueva_claim_notification_deliveries(
  p_batch_size integer default 25,
  p_lease_seconds integer default 300
)
returns table (
  delivery_id uuid,
  notification_id uuid,
  channel text,
  attempt_number smallint,
  lease_token uuid,
  lease_expires_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from cueva_private.claim_notification_deliveries(p_batch_size, p_lease_seconds)
$$;

revoke all on function public.cueva_claim_notification_deliveries(integer, integer)
  from public, anon, authenticated;
grant execute on function public.cueva_claim_notification_deliveries(integer, integer)
  to service_role;

commit;
