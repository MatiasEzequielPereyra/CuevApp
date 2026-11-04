begin;
create table public.cueva_student_invitations (
 student_id uuid primary key references public.cueva_students(id),
 email text not null,
 user_id uuid unique references auth.users(id),
 state text not null check(state in ('blocked','processing','sent','review','failed')),
 lease uuid not null,
 requested_by uuid not null references auth.users(id),
 requested_at timestamptz not null default now(),
 finished_at timestamptz
);
alter table public.cueva_student_invitations enable row level security;
revoke all on public.cueva_student_invitations from public,anon,authenticated,service_role;
grant select(student_id,email,user_id,state,requested_at,finished_at) on public.cueva_student_invitations to authenticated;
create policy invitations_admin_read on public.cueva_student_invitations for select to authenticated using(
 (select cueva_private.ready_for_current_session()) and exists(select 1 from public.cueva_profiles where user_id=(select auth.uid()) and role='admin'));
create function public.cueva_queue_student_invitation(student uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare s public.cueva_students;
begin
 if not cueva_private.ready_for_current_session() or not exists(select 1 from public.cueva_profiles where user_id=auth.uid() and role='admin') then raise exception 'Acceso restringido' using errcode='42501'; end if;
 select * into s from public.cueva_students where id=student for update;
 if not found then return false; end if;
 insert into public.cueva_student_invitations(student_id,email,state,lease,requested_by) values(student,s.email,'blocked',gen_random_uuid(),auth.uid()) on conflict(student_id) do nothing;
 return true;
end $$;
revoke all on function public.cueva_queue_student_invitation(uuid) from public,anon,service_role;
grant execute on function public.cueva_queue_student_invitation(uuid) to authenticated;
create function public.cueva_claim_student_invitation(student uuid,claim uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.cueva_students; job public.cueva_student_invitations;
begin
 if not cueva_private.ready_for_current_session() or not exists(select 1 from public.cueva_profiles where user_id=auth.uid() and role='admin') then raise exception 'Acceso restringido' using errcode='42501'; end if;
 if claim is null then raise exception 'Operación inválida';end if;
 select * into s from public.cueva_students where id=student for update;
 if not found then raise exception 'Ficha inexistente';end if;
 select * into job from public.cueva_student_invitations where student_id=student;
 if found and job.state not in ('failed','blocked') then return jsonb_build_object('claimed',false,'state',job.state);end if;
 -- Existing accounts are never associated by email. A previously ambiguous create must be reconciled.
 if exists(select 1 from auth.users where lower(email)=s.email) then return jsonb_build_object('claimed',false,'state','existing');end if;
 insert into public.cueva_student_invitations(student_id,email,state,lease,requested_by) values(student,s.email,'processing',claim,auth.uid())
 on conflict(student_id) do update set state='processing',lease=claim,requested_by=auth.uid(),requested_at=now(),finished_at=null;
 return jsonb_build_object('claimed',true,'email',s.email);
end $$;
revoke all on function public.cueva_claim_student_invitation(uuid,uuid) from public,anon,service_role;
grant execute on function public.cueva_claim_student_invitation(uuid,uuid) to authenticated;
create function public.cueva_prepare_student_invitation(student uuid,claim uuid,created_user uuid,nonce_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare job public.cueva_student_invitations;
begin
 select * into job from public.cueva_student_invitations where student_id=student and lease=claim and state='processing' for update;
 if not found or job.user_id is not null then return false;end if;
 if not exists(select 1 from auth.users where id=created_user and lower(email)=job.email and email_confirmed_at is null and last_sign_in_at is null) then return false;end if;
 if not cueva_private.prepare_invitation(created_user,nonce_hash) then return false;end if;
 update public.cueva_student_invitations set user_id=created_user where student_id=student;
 return true;
end $$;
revoke all on function public.cueva_prepare_student_invitation(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.cueva_prepare_student_invitation(uuid,uuid,uuid,text) to service_role;
create function public.cueva_finish_student_invitation(student uuid,claim uuid,outcome text) returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if outcome not in ('sent','review','failed') then return false;end if;
 update public.cueva_student_invitations set state=outcome,finished_at=now() where student_id=student and lease=claim and state='processing' and (outcome<>'failed' or user_id is null);
 get diagnostics changed=row_count;return changed=1;
end $$;
revoke all on function public.cueva_finish_student_invitation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.cueva_finish_student_invitation(uuid,uuid,text) to service_role;
create function cueva_private.freeze_invited_student_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email<>old.email and exists(select 1 from public.cueva_student_invitations where student_id=old.id and (state not in ('blocked','failed') or user_id is not null)) then raise exception 'La ficha tiene una invitación registrada. El cambio de correo requiere reconciliación administrativa.';end if;
 if new.email<>old.email then update public.cueva_student_invitations set email=new.email where student_id=old.id and state in ('blocked','failed') and user_id is null; end if;
 return new;
end $$;
revoke all on function cueva_private.freeze_invited_student_email() from public,anon,authenticated,service_role;
create trigger freeze_invited_student_email before update of email on public.cueva_students for each row execute function cueva_private.freeze_invited_student_email();
commit;
