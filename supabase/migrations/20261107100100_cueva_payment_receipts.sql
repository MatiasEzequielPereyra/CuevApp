begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cueva-payment-receipts', 'cueva-payment-receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'application/pdf']);

-- Extend the accepted methods without rewriting old payments or their writer.
alter table public.cueva_payments drop constraint cueva_payments_method_check;
alter table public.cueva_payments add constraint cueva_payments_method_check
  check (method in ('efectivo', 'transferencia', 'debito', 'credito', 'otro'));

create table public.cueva_payment_receipts (
  id uuid primary key,
  student_id uuid not null references public.cueva_students(id),
  period_id uuid not null references public.cueva_periods(id),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default clock_timestamp(),
  object_path text not null unique,
  media_type text not null check (media_type in ('image/jpeg','image/png','application/pdf')),
  file_size integer not null check (file_size between 1 and 10485760),
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check (state in ('pending','approved','rejected','superseded')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  rejection_reason text check (length(btrim(rejection_reason)) between 1 and 300),
  payment_id uuid unique references public.cueva_payments(id) deferrable initially deferred,
  review_operation uuid unique,
  review_input jsonb,
  check (
    (state = 'pending' and resolved_at is null and resolved_by is null and
      review_operation is null and review_input is null and payment_id is null and rejection_reason is null)
    or
    (state <> 'pending' and resolved_at is not null and resolved_by is not null and (
      (state = 'approved' and payment_id is not null and rejection_reason is null and review_operation is not null and review_input is not null)
      or (state = 'rejected' and payment_id is null and rejection_reason is not null and review_operation is not null and review_input is not null)
      or (state = 'superseded' and payment_id is null and rejection_reason is null and review_operation is null and review_input is null)
    ))
  )
);
create unique index cueva_receipt_one_pending on public.cueva_payment_receipts(period_id)
  where state = 'pending';
create index cueva_receipt_period_history on public.cueva_payment_receipts(period_id, submitted_at desc, id);
create index cueva_receipt_student on public.cueva_payment_receipts(student_id);
create index cueva_receipt_queue on public.cueva_payment_receipts(state, submitted_at, id);

alter table public.cueva_payment_receipts enable row level security;
revoke all on public.cueva_payment_receipts from public, anon, authenticated, service_role;
grant select (id, student_id, period_id, state, object_path, media_type, submitted_at,
  resolved_at, rejection_reason, payment_id) on public.cueva_payment_receipts to authenticated;

create function cueva_private.receipt_student()
returns uuid language sql stable security definer set search_path = '' as $$
  select i.student_id
  from public.cueva_student_invitations i
  join public.cueva_profiles p on p.user_id = i.user_id
  where i.user_id = auth.uid() and p.role = 'alumno'
    and cueva_private.ready_for_current_session()
$$;
revoke all on function cueva_private.receipt_student() from public, anon, authenticated, service_role;
grant execute on function cueva_private.receipt_student() to authenticated;

create policy receipt_own_or_admin on public.cueva_payment_receipts for select to authenticated
using (student_id = (select cueva_private.receipt_student()) or (select cueva_private.billing_admin()));

create policy receipt_files_read on storage.objects for select to authenticated
using (bucket_id = 'cueva-payment-receipts' and exists (
  select 1 from public.cueva_payment_receipts r where r.object_path = storage.objects.name
));
-- No object INSERT, UPDATE or DELETE policy for API roles. Upload tokens
-- are issued only by the server, for one immutable path with upsert=false.

create function cueva_private.receipt_balance(p_period uuid)
returns numeric language sql stable security invoker set search_path = '' as $$
  select p.cents - coalesce(sum(m.cents), 0)
  from public.cueva_periods p
  left join public.cueva_payments m on m.period_id = p.id and not exists (
    select 1 from public.cueva_reversals r where r.payment_id = m.id
  )
  where p.id = p_period group by p.id
$$;
revoke all on function cueva_private.receipt_balance(uuid) from public, anon, authenticated, service_role;

create function cueva_private.receipt_check(
  p_student uuid, p_actor uuid, p_period uuid, p_id uuid, p_type text, p_size integer, p_hash text
) returns text language plpgsql stable security invoker set search_path = '' as $$
declare
  existing public.cueva_payment_receipts;
begin
  if p_student is null or not exists (
    select 1 from public.cueva_periods p
    where p.id = p_period and p.student_id = p_student
      and p.month <= date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date
  ) then
    raise exception 'Período no disponible' using errcode = '42501';
  end if;
  if p_id is null or p_type is null or p_type not in ('image/jpeg','image/png','application/pdf')
    or p_size is null or p_size not between 1 and 10485760 or coalesce(p_hash,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'Archivo inválido' using errcode = '22023';
  end if;
  select * into existing from public.cueva_payment_receipts where id = p_id;
  if found then
    if existing.period_id = p_period and existing.submitted_by = p_actor and existing.file_hash = p_hash
      and existing.media_type = p_type and existing.file_size = p_size then
      return 'submitted';
    end if;
    raise exception 'Operación ya utilizada' using errcode = '23505';
  end if;
  if cueva_private.receipt_balance(p_period) <= 0 then
    raise exception 'La cuota está saldada' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.cueva_payment_receipts where period_id = p_period and state = 'pending') then
    raise exception 'Ya hay un comprobante pendiente' using errcode = '23505';
  end if;
  return 'eligible';
end;
$$;
revoke all on function cueva_private.receipt_check(uuid,uuid,uuid,uuid,text,integer,text)
  from public, anon, authenticated, service_role;

-- One upload lease per period. The operation identifies the receipt; the
-- upload UUID identifies a particular lease and is never reused after cleanup.
create table cueva_private.receipt_uploads (
  period_id uuid primary key references public.cueva_periods(id),
  actor uuid not null,
  operation_id uuid not null unique,
  upload_id uuid not null unique default gen_random_uuid(),
  object_path text not null unique,
  media_type text not null,
  file_size integer not null,
  file_hash text not null,
  expires_at timestamptz not null,
  invalid boolean not null default false
);
create index receipt_uploads_expiry on cueva_private.receipt_uploads(expires_at);
alter table cueva_private.receipt_uploads enable row level security;
revoke all on cueva_private.receipt_uploads from public, anon, authenticated, service_role;

create function cueva_private.receipt_actor_student(p_actor uuid, p_session uuid)
returns uuid language sql stable security invoker set search_path = '' as $$
  select i.student_id
  from public.cueva_student_invitations i
  join public.cueva_profiles p on p.user_id = i.user_id and p.role = 'alumno'
  join cueva_private.access_state s on s.user_id = i.user_id
  join auth.sessions a on a.user_id = s.user_id
  where i.user_id = p_actor and a.id = p_session and s.ready and s.operation_id is null
    and a.created_at >= s.session_not_before
$$;
revoke all on function cueva_private.receipt_actor_student(uuid,uuid) from public, anon, authenticated, service_role;

create function cueva_private.receipt_reserve(
  p_actor uuid, p_session uuid, p_period uuid, p_id uuid, p_type text, p_size integer, p_hash text, p_upload uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  lease cueva_private.receipt_uploads;
  upload uuid;
  member_id uuid;
  expiry timestamptz;
begin
  perform pg_advisory_xact_lock(903004001);
  member_id := cueva_private.receipt_actor_student(p_actor, p_session);
  if cueva_private.receipt_check(member_id, p_actor, p_period, p_id, p_type, p_size, p_hash) = 'submitted' then
    return jsonb_build_object('status', 'submitted');
  end if;
  -- Storage tokens last two hours. Leave additional time for a signed PUT
  -- already in flight and the bounded signing request.
  expiry := clock_timestamp() + interval '2 hours 15 minutes';
  select * into lease from cueva_private.receipt_uploads where period_id = p_period for update;
  if found then
    if lease.expires_at <= clock_timestamp() then
      return jsonb_build_object('status', 'expired', 'id', lease.upload_id, 'path', lease.object_path);
    end if;
    if lease.actor <> p_actor or lease.operation_id <> p_id or lease.media_type <> p_type
      or lease.file_size <> p_size or lease.file_hash <> p_hash
      or (p_upload is not null and lease.upload_id <> p_upload) then
      raise exception 'Ya hay una carga reservada' using errcode = '55P03';
    end if;
    if lease.invalid then
      return jsonb_build_object('status', 'invalid');
    end if;
    if p_upload is null then
      update cueva_private.receipt_uploads set expires_at = expiry where upload_id = lease.upload_id;
    end if;
  else
    if p_upload is not null then
      raise exception 'La carga ya no está reservada' using errcode = '55P03';
    end if;
    upload := gen_random_uuid();
    insert into cueva_private.receipt_uploads
      (period_id, actor, operation_id, upload_id, object_path, media_type, file_size, file_hash, expires_at)
    values (p_period, p_actor, p_id, upload, p_actor::text || '/' || p_period::text || '/' || upload::text || '.' ||
      case p_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'pdf' end,
      p_type, p_size, p_hash, expiry)
    returning * into lease;
  end if;
  return jsonb_build_object('status', 'reserved', 'id', lease.upload_id, 'path', lease.object_path);
end;
$$;

create function public.cueva_receipt_reserve(
  p_actor uuid, p_session uuid, p_period uuid, p_id uuid, p_type text, p_size integer, p_hash text, p_upload uuid
) returns jsonb language sql security invoker set search_path = '' as $$
  select cueva_private.receipt_reserve(p_actor, p_session, p_period, p_id, p_type, p_size, p_hash, p_upload)
$$;
revoke all on function cueva_private.receipt_reserve(uuid,uuid,uuid,uuid,text,integer,text,uuid),
  public.cueva_receipt_reserve(uuid,uuid,uuid,uuid,text,integer,text,uuid) from public, anon, authenticated, service_role;
grant execute on function cueva_private.receipt_reserve(uuid,uuid,uuid,uuid,text,integer,text,uuid),
  public.cueva_receipt_reserve(uuid,uuid,uuid,uuid,text,integer,text,uuid) to service_role;

-- Only the server that verified the bytes can finalize. Recheck the exact
-- lease, actor/session, ownership and balance under the ledger lock.
create function cueva_private.receipt_submit(
  p_actor uuid, p_session uuid, p_period uuid, p_id uuid, p_type text, p_size integer, p_hash text, p_upload uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  member_id uuid;
  lease jsonb;
begin
  if p_upload is null then
    raise exception 'Falta la reserva de carga' using errcode = '22023';
  end if;
  lease := cueva_private.receipt_reserve(p_actor, p_session, p_period, p_id, p_type, p_size, p_hash, p_upload);
  if lease->>'status' = 'submitted' then return p_id; end if;
  if lease->>'status' <> 'reserved' then
    raise exception 'La carga ya no está reservada' using errcode = '55P03';
  end if;
  if not exists (
    select 1 from storage.objects where bucket_id = 'cueva-payment-receipts' and name = lease->>'path'
  ) then
    raise exception 'Carga no encontrada' using errcode = '22023';
  end if;
  member_id := cueva_private.receipt_actor_student(p_actor, p_session);
  insert into public.cueva_payment_receipts
    (id, student_id, period_id, submitted_by, object_path, media_type, file_size, file_hash)
  values (p_id, member_id, p_period, p_actor, lease->>'path', p_type, p_size, p_hash);
  delete from cueva_private.receipt_uploads where upload_id = p_upload;
  return p_id;
end;
$$;
create function public.cueva_receipt_submit(
  p_actor uuid, p_session uuid, p_period uuid, p_id uuid, p_type text, p_size integer, p_hash text, p_upload uuid
) returns uuid language sql security invoker set search_path = '' as $$
  select cueva_private.receipt_submit(p_actor, p_session, p_period, p_id, p_type, p_size, p_hash, p_upload)
$$;
revoke all on function cueva_private.receipt_submit(uuid,uuid,uuid,uuid,text,integer,text,uuid),
  public.cueva_receipt_submit(uuid,uuid,uuid,uuid,text,integer,text,uuid) from public, anon, authenticated, service_role;
grant execute on function cueva_private.receipt_submit(uuid,uuid,uuid,uuid,text,integer,text,uuid),
  public.cueva_receipt_submit(uuid,uuid,uuid,uuid,text,integer,text,uuid) to service_role;

create function cueva_private.receipt_expired_uploads()
returns table(id uuid, path text) language sql security definer set search_path = '' as $$
  select upload_id, object_path from cueva_private.receipt_uploads
  where expires_at <= statement_timestamp() order by expires_at limit 100 for update skip locked
$$;
create function public.cueva_receipt_expired_uploads()
returns table(id uuid, path text) language sql security invoker set search_path = '' as $$
  select * from cueva_private.receipt_expired_uploads()
$$;

-- Expired leases cannot be extended or finalized. Release only after the
-- Storage API has removed the object. Late duplicate cleanup is harmless.
create function cueva_private.receipt_retire_upload(p_upload uuid, p_invalid boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_invalid then
    update cueva_private.receipt_uploads set invalid = true where upload_id = p_upload;
  else
    delete from cueva_private.receipt_uploads where upload_id = p_upload and expires_at <= clock_timestamp();
  end if;
end;
$$;
create function public.cueva_receipt_retire_upload(p_upload uuid, p_invalid boolean)
returns void language sql security invoker set search_path = '' as $$
  select cueva_private.receipt_retire_upload(p_upload, p_invalid)
$$;
revoke all on function cueva_private.receipt_expired_uploads(), public.cueva_receipt_expired_uploads(),
  cueva_private.receipt_retire_upload(uuid,boolean), public.cueva_receipt_retire_upload(uuid,boolean)
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.receipt_expired_uploads(), public.cueva_receipt_expired_uploads(),
  cueva_private.receipt_retire_upload(uuid,boolean), public.cueva_receipt_retire_upload(uuid,boolean)
  to service_role;

create function cueva_private.receipt_close_paid()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if cueva_private.receipt_balance(new.period_id) <= 0 then
    update public.cueva_payment_receipts set state = 'superseded',
      resolved_at = clock_timestamp(), resolved_by = new.actor
    where period_id = new.period_id and state = 'pending';
  end if;
  return new;
end;
$$;
revoke all on function cueva_private.receipt_close_paid() from public, anon, authenticated, service_role;
create trigger cueva_receipt_close_paid after insert on public.cueva_payments
  for each row execute function cueva_private.receipt_close_paid();

create function cueva_private.receipt_review(
  p_id uuid, p_operation uuid, p_action text, p_cents text, p_paid_on date,
  p_method text, p_detail text, p_reason text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  receipt public.cueva_payment_receipts;
  actor uuid := auth.uid();
  review jsonb;
begin
  if not cueva_private.billing_admin() then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_id is null or p_operation is null or p_action is null or p_action not in ('approve','reject') then
    raise exception 'Revisión inválida' using errcode = '22023';
  end if;
  if p_action = 'approve' then
    if coalesce(p_cents,'') !~ '^[0-9]{1,12}$' or p_paid_on is null
      or p_paid_on not between date '1900-01-01' and (now() at time zone 'America/Argentina/Buenos_Aires')::date
      or p_method is null or p_method not in ('efectivo','transferencia','debito','credito','otro')
      or (p_method = 'otro' and coalesce(length(btrim(p_detail)),0) not between 1 and 120) then
      raise exception 'Revisá el importe, la fecha y el medio de pago' using errcode = '22023';
    end if;
    review := jsonb_build_object('kind','payment','cents',p_cents,'paid_on',p_paid_on,
      'method',p_method,'detail',case when p_method = 'otro' then btrim(p_detail) end,'receipt_id',p_id);
  else
    if coalesce(length(btrim(p_reason)),0) not between 1 and 300 then
      raise exception 'Indicá un motivo de rechazo' using errcode = '22023';
    end if;
    review := jsonb_build_object('kind','reject','reason',btrim(p_reason));
  end if;

  perform pg_advisory_xact_lock(903004001);
  select * into receipt from public.cueva_payment_receipts where id = p_id for update;
  if not found then
    raise exception 'Comprobante no disponible' using errcode = '42501';
  end if;
  if receipt.state = 'superseded' then return 'superseded'; end if;
  if receipt.state <> 'pending' then
    if receipt.review_operation = p_operation and receipt.review_input = review and receipt.resolved_by = actor then
      return receipt.state;
    end if;
    raise exception 'El comprobante ya fue revisado' using errcode = '40001';
  end if;

  if p_action = 'reject' then
    update public.cueva_payment_receipts set state = 'rejected',
      rejection_reason = btrim(p_reason), resolved_at = clock_timestamp(), resolved_by = actor,
      review_operation = p_operation, review_input = review
    where id = p_id;
    return 'rejected';
  end if;

  if exists (select 1 from cueva_private.billing_operations where id = p_operation) then
    raise exception 'Operación ya utilizada' using errcode = '23505';
  end if;
  -- Mark this receipt first so the ledger's after-insert trigger closes only
  -- other pending receipts. The payment FK and both writes commit together.
  update public.cueva_payment_receipts set state = 'approved', payment_id = p_operation,
    resolved_at = clock_timestamp(), resolved_by = actor, review_operation = p_operation, review_input = review
  where id = p_id;
  perform public.cueva_billing_write(p_operation, review ||
    jsonb_build_object('student_id', receipt.student_id, 'period_id', receipt.period_id));
  return 'approved';
end;
$$;
create function public.cueva_receipt_review(
  p_id uuid, p_operation uuid, p_action text, p_cents text, p_paid_on date,
  p_method text, p_detail text, p_reason text
) returns text language sql security invoker set search_path = '' as $$
  select cueva_private.receipt_review(p_id,p_operation,p_action,p_cents,p_paid_on,p_method,p_detail,p_reason)
$$;
revoke all on function cueva_private.receipt_review(uuid,uuid,text,text,date,text,text,text),
  public.cueva_receipt_review(uuid,uuid,text,text,date,text,text,text) from public, anon, authenticated, service_role;
grant execute on function cueva_private.receipt_review(uuid,uuid,text,text,date,text,text,text),
  public.cueva_receipt_review(uuid,uuid,text,text,date,text,text,text) to authenticated;

-- Extend Mi Membresía with receipt metadata, preserving its audited ledger read.
create function cueva_private.receipt_periods()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(p.month::text, jsonb_build_object(
    'id', p.id, 'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'state', r.state, 'submitted_at', r.submitted_at,
        'resolved_at', r.resolved_at, 'rejection_reason', r.rejection_reason
      ) order by r.submitted_at desc, r.id)
      from public.cueva_payment_receipts r where r.period_id = p.id
    ), '[]'::jsonb)
  )), '{}'::jsonb)
  from public.cueva_periods p
  where p.student_id = (select cueva_private.receipt_student())
    and p.month <= date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;
create function public.cueva_receipt_periods()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select cueva_private.receipt_periods()
$$;
revoke all on function cueva_private.receipt_periods(), public.cueva_receipt_periods()
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.receipt_periods(), public.cueva_receipt_periods()
  to authenticated;

commit;


