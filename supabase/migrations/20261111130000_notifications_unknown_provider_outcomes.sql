begin;

alter table public.cueva_notification_deliveries
  add column provider_started_at timestamptz;
alter table public.cueva_notification_deliveries
  add constraint cueva_notification_deliveries_provider_started_check
    check (status = 'processing' or provider_started_at is null);

alter table public.cueva_notification_admin_alerts
  add column alert_type text not null default 'retries_exhausted'
    check (alert_type in ('retries_exhausted', 'provider_outcome_unknown'));
alter table public.cueva_notification_admin_alerts
  drop constraint cueva_notification_admin_alerts_attempt_count_check;
alter table public.cueva_notification_admin_alerts
  add constraint cueva_notification_admin_alerts_attempt_count_check
    check (attempt_count between 1 and 5);

create or replace function cueva_private.claim_notification_deliveries(
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

  for v_expired in
    select
      delivery.id,
      delivery.notification_id,
      delivery.attempt_count,
      delivery.channel,
      delivery.provider_started_at,
      delivery.last_attempt_at,
      notification.due_on,
      notification.status as notification_status
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
        coalesce(v_expired.last_attempt_at, v_now),
        case when v_expired.channel = 'email' and v_expired.provider_started_at is not null then 'unknown' else 'failed' end,
        case
          when v_expired.channel = 'email' and v_expired.provider_started_at is not null then 'email_lease_expired_unknown'
          when v_expired.channel = 'email' then 'email_lease_expired_before_provider'
          else 'lease_expired'
        end
      )
      on conflict on constraint cueva_notification_attempts_delivery_id_attempt_number_key do nothing;
    end if;

    update public.cueva_notification_deliveries delivery
    set
      status = case
        when v_expired.notification_status <> 'pending'
          or v_expired.due_on <= v_local_date then 'cancelled'
        when v_expired.channel = 'email' and v_expired.provider_started_at is not null then 'failed'
        when v_expired.attempt_count >= 5 then 'failed'
        else 'pending'
      end,
      next_attempt_at = case
        when v_expired.notification_status <> 'pending'
          or v_expired.due_on <= v_local_date
          or (v_expired.channel = 'email' and v_expired.provider_started_at is not null)
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
        when v_expired.notification_status = 'cancelled' then 'notification_cancelled'
        when v_expired.notification_status = 'completed' then 'notification_completed'
        when v_expired.due_on <= v_local_date then 'lease_expired_after_due_date'
        when v_expired.channel = 'email' and v_expired.provider_started_at is not null then 'email_lease_expired_unknown'
        when v_expired.channel = 'email' then 'email_lease_expired_before_provider'
        else 'lease_expired'
      end,
      lease_token = null,
      lease_expires_at = null,
      provider_started_at = null,
      updated_at = v_now
    where delivery.id = v_expired.id;

    -- Close the logical event only after every channel has reached a terminal state.
    update public.cueva_notifications notification
    set status = 'completed', updated_at = v_now
    where notification.id = v_expired.notification_id
      and notification.status = 'pending'
      and not exists (
        select 1
        from public.cueva_notification_deliveries remaining
        where remaining.notification_id = notification.id
          and remaining.status in ('pending', 'processing')
      );
  end loop;

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
      provider_started_at = null,
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

create function cueva_private.finalize_notification_delivery(
  p_delivery_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_provider_reference text default null,
  p_error_code text default null
)
returns table (
  finalized boolean,
  delivery_status text,
  attempt_number smallint,
  notification_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_local_date date;
  v_delivery public.cueva_notification_deliveries%rowtype;
  v_notification public.cueva_notifications%rowtype;
  v_delivery_status text;
  v_error_code text;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;

  if p_delivery_id is null or p_lease_token is null then
    raise exception 'Identificador de entrega y reserva son obligatorios' using errcode = '22023';
  end if;

  if p_outcome is null or p_outcome not in ('sent', 'failed', 'skipped', 'unknown') then
    raise exception 'Resultado de entrega inválido' using errcode = '22023';
  end if;

  if p_provider_reference is not null and length(p_provider_reference) > 200 then
    raise exception 'Referencia de proveedor inválida' using errcode = '22023';
  end if;

  if p_error_code is not null and length(p_error_code) > 80 then
    raise exception 'Código de error inválido' using errcode = '22023';
  end if;

  if p_outcome in ('failed', 'skipped', 'unknown')
    and (p_error_code is null or length(btrim(p_error_code)) = 0) then
    raise exception 'El resultado requiere un código de motivo' using errcode = '22023';
  end if;

  if p_outcome = 'sent' and p_error_code is not null then
    raise exception 'Un envío exitoso no admite código de error' using errcode = '22023';
  end if;

  select delivery.*
  into v_delivery
  from public.cueva_notification_deliveries delivery
  where delivery.id = p_delivery_id
  for update;

  if not found then
    raise exception 'Entrega inexistente' using errcode = 'P0002';
  end if;

  select notification.*
  into v_notification
  from public.cueva_notifications notification
  where notification.id = v_delivery.notification_id
  for update;

  -- Capture the decision time after both row locks have been acquired. A
  -- caller that waited on a lock must not finalize an already-expired lease.
  v_now := clock_timestamp();
  v_local_date := (v_now at time zone 'America/Argentina/Buenos_Aires')::date;

  if v_delivery.status <> 'processing'
    or v_delivery.lease_token is distinct from p_lease_token
    or v_delivery.lease_expires_at <= v_now then
    return query
      select false, v_delivery.status, v_delivery.attempt_count, v_notification.status;
    return;
  end if;

  if p_outcome = 'unknown' and v_delivery.channel <> 'email' then
    raise exception 'Resultado incierto solo permitido para correo' using errcode = '22023';
  end if;

  v_error_code := p_error_code;

  if p_outcome = 'sent' then
    v_delivery_status := 'sent';
  elsif v_notification.status <> 'pending' then
    v_delivery_status := 'cancelled';
    v_error_code := case
      when v_notification.status = 'cancelled' then 'notification_cancelled'
      else 'notification_completed'
    end;
  elsif v_delivery_status is null and v_notification.due_on <= v_local_date then
    v_delivery_status := 'cancelled';
    v_error_code := 'delivery_after_due_date';
  elsif p_outcome = 'unknown' then
    v_delivery_status := 'failed';
  elsif p_outcome = 'skipped' then
    v_delivery_status := 'skipped';
  elsif v_delivery.attempt_count >= 5 then
    v_delivery_status := 'failed';
  else
    v_delivery_status := 'pending';
  end if;

  insert into public.cueva_notification_attempts (
    delivery_id,
    attempt_number,
    attempted_at,
    outcome,
    error_code,
    provider_reference
  )
  values (
    v_delivery.id,
    v_delivery.attempt_count,
    coalesce(v_delivery.last_attempt_at, v_now),
    p_outcome,
    p_error_code,
    p_provider_reference
  );

  update public.cueva_notification_deliveries delivery
  set
    status = v_delivery_status,
    next_attempt_at = case
      when v_delivery_status = 'pending' then
        v_now + make_interval(mins => case v_delivery.attempt_count
          when 1 then 15
          when 2 then 30
          when 3 then 60
          else 180
        end)
      else delivery.next_attempt_at
    end,
    provider_reference = p_provider_reference,
    last_error_code = case
      when v_delivery_status = 'sent' then null
      else v_error_code
    end,
    lease_token = null,
    lease_expires_at = null,
    provider_started_at = null,
    updated_at = v_now
  where delivery.id = v_delivery.id
  returning delivery.status into v_delivery_status;

  update public.cueva_notifications notification
  set status = 'completed', updated_at = v_now
  where notification.id = v_notification.id
    and notification.status = 'pending'
    and not exists (
      select 1
      from public.cueva_notification_deliveries remaining
      where remaining.notification_id = notification.id
        and remaining.status in ('pending', 'processing')
    );

  select notification.status
  into v_notification.status
  from public.cueva_notifications notification
  where notification.id = v_notification.id;

  return query
    select true, v_delivery_status, v_delivery.attempt_count, v_notification.status;
end;
$$;



create function cueva_private.mark_notification_delivery_started(
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
  v_now timestamptz;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_delivery_id is null or p_lease_token is null then
    raise exception 'Identificador de entrega y reserva son obligatorios' using errcode = '22023';
  end if;
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

create function public.cueva_mark_notification_delivery_started(
  p_delivery_id uuid,
  p_lease_token uuid
)
returns table (started boolean)
language sql
security invoker
set search_path = ''
as $$
  select * from cueva_private.mark_notification_delivery_started(p_delivery_id,p_lease_token)
$$;
revoke all on function public.cueva_mark_notification_delivery_started(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.cueva_mark_notification_delivery_started(uuid,uuid)
  to service_role;

create or replace function cueva_private.create_notification_admin_alert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_notification public.cueva_notifications%rowtype;
  v_period public.cueva_periods%rowtype;
  v_student public.cueva_students%rowtype;
  v_local_date date;
  v_alert_type text;
begin
  if old.status = 'failed' or new.status <> 'failed' then return new; end if;
  if new.attempt_count <> 5 and coalesce(new.last_error_code,'') not in ('brevo_result_unknown','email_lease_expired_unknown') then return new; end if;
  v_alert_type := case when new.last_error_code in ('brevo_result_unknown','email_lease_expired_unknown') then 'provider_outcome_unknown' else 'retries_exhausted' end;
  select notification.* into v_notification from public.cueva_notifications notification where notification.id = new.notification_id;
  if not found or v_notification.status <> 'pending' then return new; end if;
  v_local_date := (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
  if v_notification.due_on <= v_local_date then return new; end if;
  select period.* into v_period from public.cueva_periods period where period.id = v_notification.period_id;
  if not found then return new; end if;
  select student.* into v_student from public.cueva_students student where student.id = v_period.student_id;
  if not found then return new; end if;
  insert into public.cueva_notification_admin_alerts (
    delivery_id,notification_id,student_id,student_name,period_month,reminder_days,channel,attempt_count,failed_at,alert_type
  ) values (
    new.id,new.notification_id,v_student.id,concat_ws(' ',v_student.first_name,v_student.last_name),
    v_period.month,v_notification.reminder_days,new.channel,new.attempt_count,clock_timestamp(),v_alert_type
  ) on conflict (delivery_id) do nothing;
  return new;
end;
$$;
revoke all on function cueva_private.create_notification_admin_alert() from public, anon, authenticated, service_role;

commit;
