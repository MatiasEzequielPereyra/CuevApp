begin;

-- CUEVA-005 notification persistence. This migration creates application
-- storage and narrowly scoped RPCs only; it does not install extensions,
-- create hosted cron jobs, or provision secrets.

create table public.cueva_notification_settings (
  singleton boolean primary key default true check (singleton),
  send_time time without time zone not null default time '12:00',
  timezone text not null default 'America/Argentina/Buenos_Aires'
    check (timezone = 'America/Argentina/Buenos_Aires'),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id)
);
alter table public.cueva_notification_settings enable row level security;
revoke all on public.cueva_notification_settings from public, anon, authenticated, service_role;
grant select on public.cueva_notification_settings to authenticated;
insert into public.cueva_notification_settings(singleton) values (true);

create table public.cueva_notification_preferences (
  student_id uuid primary key references public.cueva_students(id) on delete cascade,
  push_enabled boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.cueva_notification_preferences enable row level security;
revoke all on public.cueva_notification_preferences from public, anon, authenticated, service_role;
grant select on public.cueva_notification_preferences to authenticated;
grant update (push_enabled) on public.cueva_notification_preferences to authenticated;

insert into public.cueva_notification_preferences(student_id)
select s.id from public.cueva_students s
on conflict (student_id) do nothing;

create function cueva_private.seed_notification_preferences()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.cueva_notification_preferences(student_id)
  values (new.id)
  on conflict (student_id) do nothing;
  return new;
end;
$$;
revoke all on function cueva_private.seed_notification_preferences() from public, anon, authenticated, service_role;
create trigger cueva_students_seed_notification_preferences
  after insert on public.cueva_students
  for each row execute function cueva_private.seed_notification_preferences();

create function cueva_private.touch_notification_preference()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function cueva_private.touch_notification_preference() from public, anon, authenticated, service_role;
create trigger cueva_notification_preferences_touch
  before update of push_enabled on public.cueva_notification_preferences
  for each row execute function cueva_private.touch_notification_preference();

create table public.cueva_notifications (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.cueva_periods(id) on delete restrict,
  reminder_days smallint not null check (reminder_days in (5, 1)),
  due_on date not null check (due_on between date '1900-01-01' and date '2100-12-31'),
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'completed')),
  cancellation_reason text check (
    cancellation_reason is null or length(btrim(cancellation_reason)) between 3 and 300
  ),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (period_id, reminder_days, due_on),
  check ((status = 'cancelled') = (cancellation_reason is not null))
);
alter table public.cueva_notifications enable row level security;
revoke all on public.cueva_notifications from public, anon, authenticated, service_role;

create index cueva_notifications_pending_schedule_idx
  on public.cueva_notifications(scheduled_at, created_at)
  where status = 'pending';

create table public.cueva_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.cueva_notifications(id) on delete restrict,
  channel text not null check (channel in ('email', 'internal', 'push')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null,
  last_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_reference text check (provider_reference is null or length(provider_reference) <= 200),
  last_error_code text check (last_error_code is null or length(last_error_code) <= 80),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (notification_id, channel),
  check ((status = 'processing') = (lease_token is not null and lease_expires_at is not null)),
  check (status <> 'sent' or attempt_count > 0)
);
alter table public.cueva_notification_deliveries enable row level security;
revoke all on public.cueva_notification_deliveries from public, anon, authenticated, service_role;

create index cueva_notification_deliveries_due_idx
  on public.cueva_notification_deliveries(next_attempt_at, created_at)
  where status = 'pending';

create index cueva_notification_deliveries_expired_lease_idx
  on public.cueva_notification_deliveries(lease_expires_at)
  where status = 'processing';

create table public.cueva_notification_attempts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.cueva_notification_deliveries(id) on delete restrict,
  attempt_number smallint not null check (attempt_number between 1 and 5),
  attempted_at timestamptz not null default clock_timestamp(),
  outcome text not null check (outcome in ('sent', 'failed', 'unknown', 'skipped')),
  error_code text check (error_code is null or length(error_code) <= 80),
  provider_reference text check (provider_reference is null or length(provider_reference) <= 200),
  unique (delivery_id, attempt_number)
);
alter table public.cueva_notification_attempts enable row level security;
revoke all on public.cueva_notification_attempts from public, anon, authenticated, service_role;

create table public.cueva_notification_inbox (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null unique references public.cueva_notification_deliveries(id) on delete restrict,
  notification_id uuid not null references public.cueva_notifications(id) on delete restrict,
  student_id uuid not null references public.cueva_students(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 120),
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz
);
alter table public.cueva_notification_inbox enable row level security;
revoke all on public.cueva_notification_inbox from public, anon, authenticated, service_role;
grant select on public.cueva_notification_inbox to authenticated;
grant update (read_at) on public.cueva_notification_inbox to authenticated;
create index cueva_notification_inbox_unread_idx
  on public.cueva_notification_inbox(user_id, created_at desc)
  where read_at is null;

create table public.cueva_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.cueva_students(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) <= 2048),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{40,100}$'),
  auth_secret text not null check (auth_secret ~ '^[A-Za-z0-9_-]{16,100}$'),
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz
);
alter table public.cueva_push_subscriptions enable row level security;
revoke all on public.cueva_push_subscriptions from public, anon, authenticated, service_role;
create index cueva_push_subscriptions_active_idx
  on public.cueva_push_subscriptions(student_id)
  where revoked_at is null;

create table public.cueva_notification_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  outcome text not null default 'running'
    check (outcome in ('running', 'completed', 'partial', 'failed')),
  is_recovery boolean not null default false,
  recovery_reason text check (recovery_reason is null or length(recovery_reason) <= 300),
  processed_count integer not null default 0 check (processed_count >= 0),
  error_code text check (error_code is null or length(error_code) <= 80),
  check ((outcome = 'running') = (finished_at is null))
);
alter table public.cueva_notification_runs enable row level security;
revoke all on public.cueva_notification_runs from public, anon, authenticated, service_role;

create table public.cueva_notification_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('schedule_changed', 'recovery_decision')),
  old_send_time time without time zone,
  new_send_time time without time zone,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  recorded_at timestamptz not null default clock_timestamp(),
  check (
    (action = 'schedule_changed' and old_send_time is not null and new_send_time is not null)
    or action = 'recovery_decision'
  )
);
alter table public.cueva_notification_audit enable row level security;
revoke all on public.cueva_notification_audit from public, anon, authenticated, service_role;
grant select on public.cueva_notification_audit to authenticated;

-- The worker receives only the financial fields required to compose reminders.
-- It never receives the payment ledger or reversal history.
create function cueva_private.notifications_worker_snapshot()
returns table (
  period_id uuid,
  student_id uuid,
  student_name text,
  destination_email text,
  student_user_id uuid,
  period_month date,
  due_on date,
  amount_cents bigint,
  paid_cents bigint,
  balance_cents bigint,
  student_active boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    s.id,
    concat_ws(' ', s.first_name, s.last_name),
    s.email,
    case when profile.role = 'alumno' then invitation.user_id else null end,
    p.month,
    p.due_on,
    p.cents,
    coalesce(sum(payment.cents), 0)::bigint,
    (p.cents - coalesce(sum(payment.cents), 0))::bigint,
    s.active
  from public.cueva_periods p
  join public.cueva_students s on s.id = p.student_id
  left join public.cueva_payments payment
    on payment.period_id = p.id
    and not exists (
      select 1 from public.cueva_reversals reversal
      where reversal.payment_id = payment.id
    )
  left join public.cueva_student_invitations invitation
    on invitation.student_id = s.id
  left join public.cueva_profiles profile
    on profile.user_id = invitation.user_id and profile.role = 'alumno'
  group by p.id, s.id, invitation.user_id, profile.role;
end;
$$;
revoke all on function cueva_private.notifications_worker_snapshot() from public, anon, authenticated, service_role;
grant usage on schema cueva_private to service_role;
grant execute on function cueva_private.notifications_worker_snapshot() to service_role;

create function public.cueva_notifications_worker_snapshot()
returns table (
  period_id uuid,
  student_id uuid,
  student_name text,
  destination_email text,
  student_user_id uuid,
  period_month date,
  due_on date,
  amount_cents bigint,
  paid_cents bigint,
  balance_cents bigint,
  student_active boolean
)
language sql stable security invoker set search_path = ''
as $$
  select * from cueva_private.notifications_worker_snapshot()
$$;
revoke all on function public.cueva_notifications_worker_snapshot() from public, anon, authenticated, service_role;
grant execute on function public.cueva_notifications_worker_snapshot() to service_role;

-- A student may change only the push preference for the account linked to
-- their own invitation. Email and internal notifications have no opt-out.
create policy cueva_notification_preferences_read_own
  on public.cueva_notification_preferences for select to authenticated
  using (
    (select cueva_private.ready_for_current_session())
    and exists (
      select 1 from public.cueva_student_invitations invitation
      join public.cueva_profiles profile on profile.user_id = invitation.user_id
      where invitation.student_id = cueva_notification_preferences.student_id
        and invitation.user_id = (select auth.uid())
        and profile.role = 'alumno'
    )
  );
create policy cueva_notification_preferences_update_own
  on public.cueva_notification_preferences for update to authenticated
  using (
    (select cueva_private.ready_for_current_session())
    and exists (
      select 1 from public.cueva_student_invitations invitation
      join public.cueva_profiles profile on profile.user_id = invitation.user_id
      where invitation.student_id = cueva_notification_preferences.student_id
        and invitation.user_id = (select auth.uid())
        and profile.role = 'alumno'
    )
  )
  with check (
    (select cueva_private.ready_for_current_session())
    and exists (
      select 1 from public.cueva_student_invitations invitation
      join public.cueva_profiles profile on profile.user_id = invitation.user_id
      where invitation.student_id = cueva_notification_preferences.student_id
        and invitation.user_id = (select auth.uid())
        and profile.role = 'alumno'
    )
  );

create policy cueva_notification_inbox_read_own
  on public.cueva_notification_inbox for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select cueva_private.ready_for_current_session())
  );
create policy cueva_notification_inbox_update_own
  on public.cueva_notification_inbox for update to authenticated
  using (
    user_id = (select auth.uid())
    and (select cueva_private.ready_for_current_session())
  )
  with check (
    user_id = (select auth.uid())
    and (select cueva_private.ready_for_current_session())
  );

create policy cueva_notification_settings_admin_read
  on public.cueva_notification_settings for select to authenticated
  using (
    (select cueva_private.ready_for_current_session())
    and exists (
      select 1 from public.cueva_profiles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );
create policy cueva_notification_audit_admin_read
  on public.cueva_notification_audit for select to authenticated
  using (
    (select cueva_private.ready_for_current_session())
    and exists (
      select 1 from public.cueva_profiles
      where user_id = (select auth.uid()) and role = 'admin'
    )
  );

create function cueva_private.update_notification_schedule(p_send_time time without time zone)
returns time without time zone
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  previous_time time without time zone;
begin
  if actor is null
     or not cueva_private.ready_for_current_session()
     or not exists (
       select 1 from public.cueva_profiles
       where user_id = actor and role = 'admin'
     ) then
    raise exception 'Administrador y sesión habilitada requeridos' using errcode = '42501';
  end if;
  if p_send_time is null then
    raise exception 'Horario inválido' using errcode = '22023';
  end if;

  select send_time into previous_time
  from public.cueva_notification_settings
  where singleton = true
  for update;

  if not found then
    raise exception 'Configuración de notificaciones inexistente';
  end if;

  update public.cueva_notification_settings
  set send_time = p_send_time, updated_at = clock_timestamp(), updated_by = actor
  where singleton = true;

  update public.cueva_notifications notification
  set scheduled_at =
    ((notification.due_on - notification.reminder_days)::timestamp + p_send_time)
      at time zone 'America/Argentina/Buenos_Aires',
      updated_at = clock_timestamp()
  where notification.status = 'pending'
    and exists (
      select 1 from public.cueva_notification_deliveries delivery
      where delivery.notification_id = notification.id
        and delivery.status = 'pending'
        and delivery.attempt_count = 0
    );

  update public.cueva_notification_deliveries delivery
  set next_attempt_at = notification.scheduled_at,
      updated_at = clock_timestamp()
  from public.cueva_notifications notification
  where delivery.notification_id = notification.id
    and notification.status = 'pending'
    and delivery.status = 'pending'
    and delivery.attempt_count = 0;

  insert into public.cueva_notification_audit(actor_id, action, old_send_time, new_send_time)
  values (actor, 'schedule_changed', previous_time, p_send_time);

  return p_send_time;
end;
$$;
revoke all on function cueva_private.update_notification_schedule(time without time zone)
  from public, anon, service_role;
grant usage on schema cueva_private to authenticated;
grant execute on function cueva_private.update_notification_schedule(time without time zone)
  to authenticated;

create function public.cueva_update_notification_schedule(p_send_time time without time zone)
returns time without time zone
language sql security invoker set search_path = ''
as $$
  select cueva_private.update_notification_schedule(p_send_time)
$$;
revoke all on function public.cueva_update_notification_schedule(time without time zone)
  from public, anon, service_role;
grant execute on function public.cueva_update_notification_schedule(time without time zone)
  to authenticated;

-- Operational tables are available only to the server-side worker. RLS remains
-- enabled as defense in depth; no browser role receives direct access.
grant select, insert, update on public.cueva_notifications to service_role;
grant select, insert, update on public.cueva_notification_deliveries to service_role;
grant select, insert on public.cueva_notification_attempts to service_role;
grant select, insert on public.cueva_notification_inbox to service_role;
grant select, insert, update on public.cueva_push_subscriptions to service_role;
grant select, insert, update on public.cueva_notification_runs to service_role;
grant select, insert on public.cueva_notification_audit to service_role;

commit;
