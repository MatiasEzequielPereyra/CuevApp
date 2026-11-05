begin;
-- Append-only prior-attempt snapshots. No new Data API capability.
create table cueva_private.invitation_reconciliation_history (
 attempt_id uuid primary key,
 student_id uuid not null references public.cueva_student_invitations(student_id),
 successor_attempt_id uuid not null unique,
 authorization_hash text not null check(authorization_hash ~ '^[0-9a-f]{64}$'),
 rejection_hash text not null check(rejection_hash ~ '^[0-9a-f]{64}$'),
 repair_hash text not null check(repair_hash ~ '^[0-9a-f]{64}$'),
 prior_row jsonb not null check(jsonb_typeof(prior_row)='object'),
 archived_at timestamptz not null default clock_timestamp()
);
alter table cueva_private.invitation_reconciliation_history enable row level security;
revoke all on cueva_private.invitation_reconciliation_history from public,anon,authenticated,service_role;
alter table cueva_private.invitation_reconciliation add column previous_attempt_id uuid
 references cueva_private.invitation_reconciliation_history(attempt_id);
create function cueva_private.immutable_reconciliation_history() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Historial de reconciliación inmutable'; end $$;
revoke all on function cueva_private.immutable_reconciliation_history() from public,anon,authenticated,service_role;
create trigger immutable_reconciliation_history before update or delete
on cueva_private.invitation_reconciliation_history for each row execute function cueva_private.immutable_reconciliation_history();
commit;
