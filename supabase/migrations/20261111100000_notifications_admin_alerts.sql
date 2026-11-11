begin;

-- Administrative operational alerts are distinct from the student inbox and
-- configuration audit. The UI receives only a concise, immutable snapshot.
create table public.cueva_notification_admin_alerts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null unique
    references public.cueva_notification_deliveries(id) on delete restrict,
  notification_id uuid not null
    references public.cueva_notifications(id) on delete restrict,
  student_id uuid not null
    references public.cueva_students(id) on delete restrict,
  student_name text not null
    check (length(btrim(student_name)) between 1 and 160),
  period_month date not null,
  reminder_days smallint not null check (reminder_days in (5, 1)),
  channel text not null check (channel in ('email', 'internal', 'push')),
  attempt_count smallint not null check (attempt_count = 5),
  failed_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp()
);

alter table public.cueva_notification_admin_alerts enable row level security;
revoke all on public.cueva_notification_admin_alerts
  from public, anon, authenticated, service_role;
grant select on public.cueva_notification_admin_alerts to authenticated;
grant select, insert on public.cueva_notification_admin_alerts to service_role;

create index cueva_notification_admin_alerts_recent_idx
  on public.cueva_notification_admin_alerts(failed_at desc, id);

create policy cueva_notification_admin_alerts_admin_read
  on public.cueva_notification_admin_alerts for select to authenticated
  using (
    (select cueva_private.ready_for_current_session())
    and exists (
      select 1
      from public.cueva_profiles
      where user_id = (select auth.uid())
        and role = 'admin'
    )
  );

-- This trigger is the single durable transition hook for both ordinary
-- finalize and expired-lease recovery. The unique delivery_id is a second
-- idempotency barrier; the trigger itself only handles the first transition.
create function cueva_private.create_notification_admin_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification public.cueva_notifications%rowtype;
  v_period public.cueva_periods%rowtype;
  v_student public.cueva_students%rowtype;
  v_local_date date;
begin
  if old.status = 'failed'
    or new.status <> 'failed'
    or new.attempt_count <> 5 then
    return new;
  end if;

  select notification.*
  into v_notification
  from public.cueva_notifications notification
  where notification.id = new.notification_id;

  if not found or v_notification.status <> 'pending' then
    return new;
  end if;

  v_local_date := (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
  if v_notification.due_on <= v_local_date then
    return new;
  end if;

  select period.*
  into v_period
  from public.cueva_periods period
  where period.id = v_notification.period_id;

  if not found then
    return new;
  end if;

  select student.*
  into v_student
  from public.cueva_students student
  where student.id = v_period.student_id;

  if not found then
    return new;
  end if;

  insert into public.cueva_notification_admin_alerts (
    delivery_id,
    notification_id,
    student_id,
    student_name,
    period_month,
    reminder_days,
    channel,
    attempt_count,
    failed_at
  )
  values (
    new.id,
    new.notification_id,
    v_student.id,
    concat_ws(' ', v_student.first_name, v_student.last_name),
    v_period.month,
    v_notification.reminder_days,
    new.channel,
    new.attempt_count,
    clock_timestamp()
  )
  on conflict (delivery_id) do nothing;

  return new;
end;
$$;

revoke all on function cueva_private.create_notification_admin_alert()
  from public, anon, authenticated, service_role;

create trigger cueva_notification_admin_alert_on_terminal_failure
  after update of status on public.cueva_notification_deliveries
  for each row
  when (old.status is distinct from new.status and new.status = 'failed')
  execute function cueva_private.create_notification_admin_alert();

commit;
