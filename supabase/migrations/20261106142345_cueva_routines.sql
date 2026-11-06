begin;
-- Read-only tables for session callers; all mutations use checked capabilities.
create table public.cueva_routine_drafts (
 student_id uuid primary key references public.cueva_students(id) on delete restrict,
 content text not null check (length(content)<=40000),
 revision integer not null check (revision>0),
 save_id uuid not null,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp()
);
create table public.cueva_routine_publications (
 id uuid primary key,
 student_id uuid not null references public.cueva_students(id) on delete restrict,
 draft_revision integer not null check (draft_revision>0),
 content text not null check (length(btrim(content))>0 and length(content)<=40000),
 published_by uuid not null references auth.users(id),
 published_at timestamptz not null default clock_timestamp(),
 unique(student_id,draft_revision)
);
create index on public.cueva_routine_publications(student_id,draft_revision desc);
create table public.cueva_routine_templates (
 id uuid primary key,
 title text not null check (length(btrim(title))>0 and length(title)<=100),
 content text not null check (length(content)<=40000),
 revision integer not null check (revision>0),
 save_id uuid not null,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp()
);

create function cueva_private.routine_admin() returns boolean
language sql stable security invoker set search_path='' as $$
 select cueva_private.ready_for_current_session() and exists(
  select 1 from public.cueva_profiles where user_id=auth.uid() and role='admin')
$$;
-- Trusted explicit invitation binding, never email matching. Private lookup is
-- needed because students must not read the invitation/job ledger itself.
create function cueva_private.routine_owner(student uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select cueva_private.ready_for_current_session() and exists(
  select 1 from public.cueva_student_invitations i join public.cueva_profiles p on p.user_id=i.user_id
  where i.student_id=student and i.user_id=auth.uid() and p.role='alumno')
$$;
revoke all on function cueva_private.routine_admin(),cueva_private.routine_owner(uuid) from public,anon,authenticated,service_role;
grant execute on function cueva_private.routine_admin(),cueva_private.routine_owner(uuid) to authenticated;

alter table public.cueva_routine_drafts enable row level security;
alter table public.cueva_routine_publications enable row level security;
alter table public.cueva_routine_templates enable row level security;
revoke all on public.cueva_routine_drafts,public.cueva_routine_publications,public.cueva_routine_templates from public,anon,authenticated,service_role;
grant select on public.cueva_routine_drafts,public.cueva_routine_publications,public.cueva_routine_templates to authenticated;
create policy routine_draft_admin on public.cueva_routine_drafts for select to authenticated using((select cueva_private.routine_admin()));
create policy routine_template_admin on public.cueva_routine_templates for select to authenticated using((select cueva_private.routine_admin()));
-- Only the current published revision is visible to a student, including via
-- direct REST. The private helper avoids recursive publication-table policies.
create function cueva_private.routine_latest(student uuid) returns integer
language sql stable security definer set search_path='' as $$
 select max(draft_revision) from public.cueva_routine_publications where student_id=student
 and (cueva_private.routine_admin() or cueva_private.routine_owner(student))
$$;
revoke all on function cueva_private.routine_latest(uuid) from public,anon,authenticated,service_role;
grant execute on function cueva_private.routine_latest(uuid) to authenticated;
create policy routine_publication_reader on public.cueva_routine_publications for select to authenticated using(
 (select cueva_private.routine_admin()) or (cueva_private.routine_owner(student_id) and draft_revision=cueva_private.routine_latest(student_id)));

create function cueva_private.routine_write(p_kind text,p_id uuid,p_revision integer,p_content text,p_title text,p_operation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.cueva_routine_drafts; t public.cueva_routine_templates; v public.cueva_routine_publications;
begin
 if not cueva_private.routine_admin() then raise exception 'Acceso restringido' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('draft','template','publish') or p_id is null or p_operation is null
   or p_revision is null or p_revision<0 or p_revision>2147483646 or p_content is null or length(p_content)>40000
 then raise exception 'Datos inválidos' using errcode='22023'; end if;
 -- Same lock order as billing/delete. Protects both first INSERT and existing
 -- revisions, serializes with fiche removal, and makes publication retries safe.
 perform pg_advisory_xact_lock(903004001);
 if p_kind='template' then
  if p_title is null or length(btrim(p_title))=0 or length(p_title)>100 then raise exception 'Título requerido' using errcode='22023'; end if;
  select * into t from public.cueva_routine_templates where id=p_id for update;
  if found then
   if t.save_id=p_operation and t.revision=p_revision+1 and t.content=p_content and t.title=p_title then return to_jsonb(t); end if;
   if t.revision<>p_revision then raise exception 'El contenido cambió en otra ventana. Conservamos tu texto.' using errcode='40001'; end if;
   update public.cueva_routine_templates set content=p_content,title=p_title,revision=revision+1,save_id=p_operation,updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id returning * into t;
  else
   if p_revision<>0 then raise exception 'La plantilla cambió' using errcode='40001'; end if;
   insert into public.cueva_routine_templates values(p_id,p_title,p_content,1,p_operation,auth.uid(),clock_timestamp()) returning * into t;
  end if;
  return to_jsonb(t);
 end if;
 perform 1 from public.cueva_students where id=p_id for update;
 if not found then raise exception 'No se encontró la ficha' using errcode='22023'; end if;
 select * into d from public.cueva_routine_drafts where student_id=p_id for update;
 if p_kind='draft' then
  if found then
   if d.save_id=p_operation and d.revision=p_revision+1 and d.content=p_content then return to_jsonb(d); end if;
   if d.revision<>p_revision then raise exception 'El contenido cambió en otra ventana. Conservamos tu texto.' using errcode='40001'; end if;
   update public.cueva_routine_drafts set content=p_content,revision=revision+1,save_id=p_operation,updated_by=auth.uid(),updated_at=clock_timestamp() where student_id=p_id returning * into d;
  else
   if p_revision<>0 then raise exception 'El borrador cambió' using errcode='40001'; end if;
   insert into public.cueva_routine_drafts values(p_id,p_content,1,p_operation,auth.uid(),clock_timestamp()) returning * into d;
  end if;
  return to_jsonb(d);
 end if;
 -- An operation ID is permanently bound to this exact snapshot and actor.
 select * into v from public.cueva_routine_publications where id=p_operation;
 if found then
  if v.student_id<>p_id or v.draft_revision<>p_revision or v.content<>p_content or v.published_by<>auth.uid() then
   raise exception 'La operación ya pertenece a otra publicación' using errcode='22023'; end if;
  return to_jsonb(v);
 end if;
 if d.student_id is null or d.revision<>p_revision or d.content<>p_content then
  raise exception 'Guardá los cambios actuales antes de publicar.' using errcode='40001'; end if;
 if length(btrim(p_content))=0 then raise exception 'Escribí una rutina antes de publicar' using errcode='22023'; end if;
 select * into v from public.cueva_routine_publications where student_id=p_id and draft_revision=p_revision;
 if found then return to_jsonb(v); end if;
 insert into public.cueva_routine_publications(id,student_id,draft_revision,content,published_by) values(p_operation,p_id,p_revision,p_content,auth.uid()) returning * into v;
 return to_jsonb(v);
end $$;
revoke all on function cueva_private.routine_write(text,uuid,integer,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function cueva_private.routine_write(text,uuid,integer,text,text,uuid) to authenticated;
create function public.cueva_routine_write(p_kind text,p_id uuid,p_revision integer,p_content text,p_title text,p_operation uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select cueva_private.routine_write(p_kind,p_id,p_revision,p_content,p_title,p_operation)
$$;
revoke all on function public.cueva_routine_write(text,uuid,integer,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.cueva_routine_write(text,uuid,integer,text,text,uuid) to authenticated;

-- Immutable snapshots: no caller may silently rewrite published history.
create function cueva_private.routine_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Las publicaciones son inmutables'; end $$;
revoke all on function cueva_private.routine_immutable() from public,anon,authenticated,service_role;
create trigger routine_publication_immutable before update or delete on public.cueva_routine_publications for each row execute function cueva_private.routine_immutable();
-- Narrow administrator capability. Direct DELETE and Auth writes remain denied.
create or replace function cueva_private.delete_empty_student(p_student uuid,p_expected_email text,p_confirm boolean)
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
 if exists(select 1 from public.cueva_routine_drafts where student_id=p_student)
   or exists(select 1 from public.cueva_routine_publications where student_id=p_student)
   or exists(select 1 from public.cueva_periods where student_id=p_student)
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

commit;
