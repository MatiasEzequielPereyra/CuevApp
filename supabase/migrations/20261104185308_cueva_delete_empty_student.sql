begin;
-- Narrow administrator capability. Direct DELETE and Auth writes remain denied.
create function cueva_private.delete_empty_student(p_student uuid,p_expected_email text,p_confirm boolean)
returns text language plpgsql security definer set search_path='' as $$
declare s public.cueva_students;
begin
 if not cueva_private.ready_for_current_session() or not exists(
   select 1 from public.cueva_profiles where user_id=auth.uid() and role='admin'
 ) then raise exception 'Administrador y sesión habilitada requeridos' using errcode='42501'; end if;
 if p_student is null or p_expected_email is null or p_confirm is null then raise exception 'Solicitud inválida'; end if;
 -- Same order as financial writes, then serialize invitation/edit/delete on fiche.
 perform pg_advisory_xact_lock(903004001);
 select * into s from public.cueva_students where id=p_student for update;
 if not found then return 'not_found'; end if;
 if s.email<>p_expected_email then return 'changed'; end if;
 perform 1 from public.cueva_student_invitations where student_id=p_student for update;
 if exists(select 1 from public.cueva_periods where student_id=p_student)
   or exists(select 1 from public.cueva_student_invitations where student_id=p_student
     and (user_id is not null or state<>'blocked'))
   -- A match only blocks deletion; it never associates or mutates an Auth identity.
   or exists(select 1 from auth.users where lower(email)=s.email)
 then return 'protected'; end if;
 if not p_confirm then return 'eligible'; end if;
 -- failed can hide a createUser request whose remote outcome is still unknown.
 delete from public.cueva_student_invitations where student_id=p_student and user_id is null and state='blocked';
 delete from public.cueva_students where id=p_student;
 return 'deleted';
exception when foreign_key_violation then
 -- All preceding writes roll back if a current/future related record protects it.
 return 'protected';
end $$;
revoke all on function cueva_private.delete_empty_student(uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function cueva_private.delete_empty_student(uuid,text,boolean) to authenticated;
create function public.cueva_delete_empty_student(p_student uuid,p_expected_email text,p_confirm boolean)
returns text language sql security invoker set search_path='' as $$
 select cueva_private.delete_empty_student(p_student,p_expected_email,p_confirm)
$$;
revoke all on function public.cueva_delete_empty_student(uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.cueva_delete_empty_student(uuid,text,boolean) to authenticated;
commit;
