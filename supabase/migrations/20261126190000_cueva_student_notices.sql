begin;

-- Operational notices have no billing period. Keep the billing ledger intact.
create table cueva_private.student_notices (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid unique references public.cueva_routine_publications(id) on delete restrict,
  actor uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table cueva_private.student_notice_push (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references cueva_private.student_notices(id) on delete restrict,
  subscription_id uuid not null references public.cueva_push_subscriptions(id) on delete cascade,
  student_id uuid not null,
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending','sending','accepted','failed','unknown','expired','cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  lease uuid,
  lease_until timestamptz,
  finished_at timestamptz,
  unique (notice_id, subscription_id),
  check ((status = 'sending') = (lease is not null and lease_until is not null))
);
create index student_notice_push_pending on cueva_private.student_notice_push(next_attempt_at,id) where status='pending';
create index student_notice_push_leases on cueva_private.student_notice_push(lease_until) where status='sending';

alter table cueva_private.student_notices enable row level security;
alter table cueva_private.student_notice_push enable row level security;
revoke all on cueva_private.student_notices, cueva_private.student_notice_push from public, anon, authenticated, service_role;

create view cueva_private.student_notice_recipients as
  select i.student_id, i.user_id
  from public.cueva_student_invitations i
  join public.cueva_profiles p on p.user_id=i.user_id and p.role='alumno'
  join cueva_private.access_state a on a.user_id=i.user_id and a.ready and a.operation_id is null
  where i.state in ('sent','self_registered');
revoke all on cueva_private.student_notice_recipients from public, anon, authenticated, service_role;

alter table public.cueva_notification_inbox
  alter column delivery_id drop not null,
  alter column notification_id drop not null,
  add column student_notice_id uuid references cueva_private.student_notices(id) on delete restrict,
  add constraint notification_inbox_source check (
    (student_notice_id is null and delivery_id is not null and notification_id is not null)
    or (student_notice_id is not null and delivery_id is null and notification_id is null)
  ),
  add constraint notification_inbox_notice_student unique (student_notice_id, student_id);

create or replace function cueva_private.validate_notification_inbox()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.student_notice_id is not null then
    if exists (
      select 1 from cueva_private.student_notices n
      join cueva_private.student_notice_recipients r on r.student_id=new.student_id and r.user_id=new.user_id
      left join public.cueva_routine_publications p on p.id=n.publication_id
      where n.id=new.student_notice_id and (n.publication_id is null or p.student_id=r.student_id)
        and n.title=new.title and n.body=new.body
    ) then return new; end if;
  elsif exists (
    select 1
    from public.cueva_notification_deliveries delivery
    join public.cueva_student_invitations invitation
      on invitation.student_id = new.student_id and invitation.user_id = new.user_id
    join public.cueva_notifications notification on notification.id = delivery.notification_id
    where delivery.id = new.delivery_id and delivery.channel = 'internal'
      and delivery.notification_id = new.notification_id
      and notification.period_id in (
        select period.id from public.cueva_periods period
        where period.id = notification.period_id and period.student_id = new.student_id
      )
  ) then return new;
  end if;
  raise exception 'Bandeja interna no coincide con la entrega y el alumno' using errcode = '23514';
end;
$$;
drop trigger cueva_notification_inbox_validate on public.cueva_notification_inbox;
create trigger cueva_notification_inbox_validate
  before insert or update of delivery_id, notification_id, student_notice_id, student_id, user_id
  on public.cueva_notification_inbox for each row execute function cueva_private.validate_notification_inbox();

create function cueva_private.queue_student_notice(p_notice uuid, p_student uuid)
returns void language sql set search_path = '' as $$
  with inbox as (
    insert into public.cueva_notification_inbox(student_notice_id,student_id,user_id,title,body)
    select n.id,r.student_id,r.user_id,n.title,n.body
    from cueva_private.student_notices n
    cross join cueva_private.student_notice_recipients r
    where n.id=p_notice and (p_student is null or r.student_id=p_student)
    returning student_notice_id,student_id,user_id
  )
  insert into cueva_private.student_notice_push(notice_id,subscription_id,student_id,user_id)
  select i.student_notice_id,s.id,i.student_id,i.user_id
  from inbox i
  join public.cueva_notification_preferences p on p.student_id=i.student_id and p.push_enabled
  join public.cueva_push_subscriptions s on s.student_id=i.student_id and s.revoked_at is null
    and (s.expires_at is null or s.expires_at>now());
$$;

-- New publication rows are immutable and independently idempotent; drafts never fire this trigger.
create function cueva_private.notice_new_routine()
returns trigger language plpgsql security definer set search_path = '' as $$
declare notice uuid;
begin
  if not exists (select 1 from cueva_private.student_notice_recipients where student_id=new.student_id) then return new; end if;
  insert into cueva_private.student_notices(publication_id,actor,title,body)
  values(new.id,new.published_by,'Tu rutina fue actualizada','Abrí Mi rutina para ver el plan que publicó el gimnasio.')
  returning id into notice;
  perform cueva_private.queue_student_notice(notice,new.student_id);
  return new;
end;
$$;
create trigger notice_new_routine after insert on public.cueva_routine_publications
  for each row execute function cueva_private.notice_new_routine();

create function public.cueva_send_student_broadcast(p_request_id uuid, p_title text, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare inserted uuid;
begin
  if not cueva_private.routine_admin() then raise exception 'Acceso restringido' using errcode='42501'; end if;
  if p_request_id is null or p_title is null or p_body is null or char_length(btrim(p_title)) not between 1 and 120
    or char_length(btrim(p_body)) not between 1 and 500 or p_title !~ '[^[:space:]]' or p_body !~ '[^[:space:]]' then
    raise exception 'Comunicado inválido' using errcode='22023';
  end if;
  insert into cueva_private.student_notices(id,actor,title,body) values(p_request_id,auth.uid(),btrim(p_title),btrim(p_body))
  on conflict (id) do nothing returning id into inserted;
  if inserted is not null then
    perform cueva_private.queue_student_notice(inserted,null);
  elsif not exists (select 1 from cueva_private.student_notices n where n.id=p_request_id and n.actor=auth.uid()
    and n.publication_id is null and n.title=btrim(p_title) and n.body=btrim(p_body)) then
    raise exception 'Identificador de comunicado en uso' using errcode='23505';
  end if;
  return jsonb_build_object('recipients',(select count(*) from public.cueva_notification_inbox where student_notice_id=p_request_id),
    'devices',(select count(*) from cueva_private.student_notice_push where notice_id=p_request_id));
end;
$$;

create function public.cueva_claim_student_notice_push()
returns table(job_id uuid, job_lease uuid, message_id uuid, title text, body text, routine boolean, endpoint text, p256dh text, auth_secret text)
language plpgsql security definer set search_path = '' as $$
begin
  -- An interrupted send may already have reached the provider. Never send it again.
  update cueva_private.student_notice_push set status='unknown',lease=null,lease_until=null,finished_at=now()
  where status='sending' and lease_until<=now();
  update cueva_private.student_notice_push j set status='cancelled',finished_at=now()
  where j.status='pending' and not exists (
    select 1 from cueva_private.student_notice_recipients r
    join public.cueva_notification_preferences p on p.student_id=r.student_id and p.push_enabled
    join public.cueva_push_subscriptions s on s.id=j.subscription_id and s.student_id=r.student_id
      and s.revoked_at is null and (s.expires_at is null or s.expires_at>now())
    where r.student_id=j.student_id and r.user_id=j.user_id
  );
  return query
  with candidates as (
    select j.id from cueva_private.student_notice_push j
    join cueva_private.student_notice_recipients r on r.student_id=j.student_id and r.user_id=j.user_id
    join public.cueva_notification_preferences p on p.student_id=r.student_id and p.push_enabled
    join public.cueva_push_subscriptions s on s.id=j.subscription_id and s.student_id=r.student_id
      and s.revoked_at is null and (s.expires_at is null or s.expires_at>now())
    where j.status='pending' and j.next_attempt_at<=now()
    order by j.next_attempt_at,j.id limit 16 for update of j skip locked
  ), claimed as (
    update cueva_private.student_notice_push j
      set status='sending',lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempt_count=j.attempt_count+1
      from candidates c where j.id=c.id returning j.*
  )
  select j.id,j.lease,n.id,n.title,n.body,n.publication_id is not null,s.endpoint,s.p256dh,s.auth_secret
  from claimed j join cueva_private.student_notices n on n.id=j.notice_id
  join public.cueva_push_subscriptions s on s.id=j.subscription_id;
end;
$$;

create function public.cueva_finish_student_notice_push(p_job uuid, p_lease uuid, p_result text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed uuid;
begin
  if p_result is null or p_result not in ('accepted','failed','unknown','expired','rate_limited') then
    raise exception 'Resultado no admitido' using errcode='22023';
  end if;
  update cueva_private.student_notice_push
  set status=case when p_result='rate_limited' and attempt_count<3 then 'pending'
                  when p_result='rate_limited' then 'failed' else p_result end,
      next_attempt_at=now()+interval '2 minutes',lease=null,lease_until=null,
      finished_at=case when p_result='rate_limited' and attempt_count<3 then null else now() end
  where id=p_job and lease=p_lease and status='sending' and lease_until>now() returning id into changed;
  return changed is not null;
end;
$$;

revoke all on function cueva_private.queue_student_notice(uuid,uuid), cueva_private.notice_new_routine() from public, anon, authenticated, service_role;
revoke all on function public.cueva_send_student_broadcast(uuid,text,text), public.cueva_claim_student_notice_push(),
  public.cueva_finish_student_notice_push(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.cueva_send_student_broadcast(uuid,text,text) to authenticated;
grant execute on function public.cueva_claim_student_notice_push(), public.cueva_finish_student_notice_push(uuid,uuid,text) to service_role;

commit;
