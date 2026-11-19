begin;

-- A student's login email becomes authoritative only after Supabase Auth
-- completes its email-change confirmation and updates auth.users.email.
create or replace function cueva_private.freeze_invited_student_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
    and current_setting('cueva.syncing_student_email', true) is distinct from 'on'
    and exists (
      select 1 from public.cueva_student_invitations
      where student_id = old.id
        and (state not in ('blocked','failed') or user_id is not null)
    ) then
    raise exception 'La ficha tiene una invitación registrada. El cambio de correo requiere reconciliación administrativa.';
  end if;

  if new.email is distinct from old.email
    and current_setting('cueva.syncing_student_email', true) is distinct from 'on' then
    update public.cueva_student_invitations
      set email = new.email
      where student_id = old.id and state in ('blocked','failed') and user_id is null;
  end if;
  return new;
end
$$;
revoke all on function cueva_private.freeze_invited_student_email() from public, anon, authenticated, service_role;

create function cueva_private.sync_student_email_after_auth_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_previous_setting text;
begin
  if new.email is not distinct from old.email then
    return new;
  end if;

  select student_id into v_student_id
    from public.cueva_student_invitations
    where user_id = new.id;

  -- Administrators and unrelated Auth users have no student invitation link.
  if not found then
    return new;
  end if;

  v_previous_setting := current_setting('cueva.syncing_student_email', true);
  perform set_config('cueva.syncing_student_email', 'on', true);

  update public.cueva_students
    set email = lower(btrim(new.email))
    where id = v_student_id;

  if not found then
    raise exception 'No se pudo sincronizar el correo de la ficha del alumno.';
  end if;

  update public.cueva_student_invitations
    set email = lower(btrim(new.email))
    where student_id = v_student_id and user_id = new.id;

  perform set_config('cueva.syncing_student_email', coalesce(v_previous_setting, ''), true);
  return new;
exception when others then
  perform set_config('cueva.syncing_student_email', coalesce(v_previous_setting, ''), true);
  raise;
end
$$;

revoke all on function cueva_private.sync_student_email_after_auth_change() from public, anon, authenticated, service_role;

drop trigger if exists cueva_sync_student_email_after_auth_change on auth.users;
create trigger cueva_sync_student_email_after_auth_change
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function cueva_private.sync_student_email_after_auth_change();

commit;
