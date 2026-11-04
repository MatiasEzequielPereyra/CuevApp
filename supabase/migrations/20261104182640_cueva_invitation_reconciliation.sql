begin;
-- Private operator ledger. No new Data API capability or application permission.
create table cueva_private.invitation_reconciliation (
 student_id uuid primary key references public.cueva_student_invitations(student_id),
 attempt_id uuid not null unique,
 source_lease uuid not null,
 user_id uuid not null unique references auth.users(id),
 source_generation bigint not null check (source_generation > 0),
 email text not null,
 evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
 state text not null check (state in ('reserved','dispatching','accepted','uncertain')),
 reserved_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz
);
alter table cueva_private.invitation_reconciliation enable row level security;
revoke all on cueva_private.invitation_reconciliation from public,anon,authenticated,service_role;
-- The existing begin/bind/preflight functions already refuse any pending operation.
-- Only the operator can close this kind; finish_operation cannot activate it.
alter table cueva_private.access_state drop constraint access_state_operation_kind_check;
alter table cueva_private.access_state add constraint access_state_operation_kind_check
 check (operation_kind in ('activate','reset','invite-resend'));
commit;
