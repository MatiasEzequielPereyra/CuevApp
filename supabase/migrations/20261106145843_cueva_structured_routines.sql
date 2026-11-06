begin;
create table public.cueva_exercises (
 id uuid primary key,
 name text not null check(length(name) between 1 and 120 and name=btrim(regexp_replace(name,'[[:space:]]+',' ','g'))),
 name_key text generated always as (lower(btrim(regexp_replace(name,'[[:space:]]+',' ','g')))) stored unique,
 active boolean not null default true,
 revision integer not null check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.cueva_exercises enable row level security;
revoke all on public.cueva_exercises from public,anon,authenticated,service_role;
grant select on public.cueva_exercises to authenticated;
create policy exercise_admin on public.cueva_exercises for select to authenticated using((select cueva_private.routine_admin()));
create function cueva_private.exercise_write(p_id uuid,p_name text,p_active boolean,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.cueva_exercises; normalized text;
begin
 if not cueva_private.routine_admin() then raise exception 'Acceso restringido' using errcode='42501'; end if;
 normalized=btrim(regexp_replace(p_name,'[[:space:]]+',' ','g'));
 if p_id is null or normalized is null or length(normalized) not between 1 and 120 or p_active is null or p_revision is null or p_revision<0 or p_revision>2147483646 then raise exception 'Datos inválidos' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(903004001);
 select * into e from public.cueva_exercises where id=p_id for update;
 if found then
  if e.name=normalized and e.active=p_active and e.revision=p_revision+1 then return to_jsonb(e); end if;
  if e.revision<>p_revision then raise exception 'El ejercicio cambió. Revisá la versión actual.' using errcode='40001'; end if;
  update public.cueva_exercises set name=normalized,active=p_active,revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id returning * into e;
 else
  if p_revision<>0 then raise exception 'El ejercicio cambió' using errcode='40001'; end if;
  insert into public.cueva_exercises(id,name,active,revision,updated_by) values(p_id,normalized,p_active,1,auth.uid()) returning * into e;
 end if;
 return to_jsonb(e);
end $$;
revoke all on function cueva_private.exercise_write(uuid,text,boolean,integer) from public,anon,authenticated,service_role;
grant execute on function cueva_private.exercise_write(uuid,text,boolean,integer) to authenticated;
create function public.cueva_exercise_write(p_id uuid,p_name text,p_active boolean,p_revision integer)
returns jsonb language sql security invoker set search_path='' as $$ select cueva_private.exercise_write(p_id,p_name,p_active,p_revision) $$;
revoke all on function public.cueva_exercise_write(uuid,text,boolean,integer) from public,anon,authenticated,service_role;
grant execute on function public.cueva_exercise_write(uuid,text,boolean,integer) to authenticated;

alter table public.cueva_routine_drafts add column plan jsonb;
alter table public.cueva_routine_templates add column plan jsonb;
alter table public.cueva_routine_publications add column plan jsonb;
-- NULL preserves every legacy note exactly. No UPDATE/backfill or parsing.
alter table public.cueva_routine_publications drop constraint cueva_routine_publications_content_check;
alter table public.cueva_routine_publications add constraint cueva_routine_publications_content_check check(length(content)<=40000 and (length(btrim(content))>0 or plan is not null));

create function cueva_private.validate_plan(p jsonb,previous jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare b jsonb; e jsonb; count_items integer:=0; block_ids text[]:='{}'; item_ids text[]:='{}'; known boolean;
begin
 if p is null then return; end if;
 if jsonb_typeof(p)<>'object' or p->>'version' is distinct from '1' or jsonb_typeof(p->'version') is distinct from 'number' or jsonb_typeof(p->'blocks') is distinct from 'array' or jsonb_array_length(p->'blocks')>20 or (p-'version'-'blocks')<>'{}' then raise exception 'Estructura inválida' using errcode='22023'; end if;
 for b in select value from jsonb_array_elements(p->'blocks') loop
  if jsonb_typeof(b)<>'object' or (b-'id'-'name'-'exercises')<>'{}' or coalesce(b->>'id','')!~*'^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' or b->>'id'=any(block_ids) or jsonb_typeof(b->'name') is distinct from 'string' or length(btrim(b->>'name')) not between 1 and 80 or jsonb_typeof(b->'exercises') is distinct from 'array' or jsonb_array_length(b->'exercises')>30 then raise exception 'Bloque inválido' using errcode='22023'; end if;
  block_ids=array_append(block_ids,b->>'id');
  for e in select value from jsonb_array_elements(b->'exercises') loop
   count_items=count_items+1;
   if count_items>300 or jsonb_typeof(e)<>'object' or (e-'id'-'exercise_id'-'name'-'sets'-'reps'-'weight_kg'-'note')<>'{}'
    or coalesce(e->>'id','')!~*'^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' or e->>'id'=any(item_ids)
    or coalesce(e->>'exercise_id','')!~*'^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    or jsonb_typeof(e->'name') is distinct from 'string' or length(btrim(e->>'name')) not between 1 and 120
    or jsonb_typeof(e->'sets') is distinct from 'number' or coalesce(e->>'sets','')!~'^[1-9][0-9]?$' or (e->>'sets')::numeric>30
    or jsonb_typeof(e->'reps') is distinct from 'string' or coalesce(e->>'reps','')!~'^[1-9][0-9]{0,2}(-[1-9][0-9]{0,2})?$'
    or jsonb_typeof(e->'note') is distinct from 'string' or length(e->>'note')>300
    or not(e ? 'weight_kg') or (jsonb_typeof(e->'weight_kg') not in ('null','number'))
   then raise exception 'Objetivo inválido' using errcode='22023'; end if;
   if position('-' in e->>'reps')>0 and split_part(e->>'reps','-',1)::integer>split_part(e->>'reps','-',2)::integer then raise exception 'Rango inválido' using errcode='22023'; end if;
   if jsonb_typeof(e->'weight_kg')='number' and ((e->>'weight_kg')::numeric<0 or (e->>'weight_kg')::numeric>2000 or round((e->>'weight_kg')::numeric,2)<>(e->>'weight_kg')::numeric) then raise exception 'Peso inválido' using errcode='22023'; end if;
   item_ids=array_append(item_ids,e->>'id');
   select exists(select 1 from jsonb_array_elements(previous->'blocks') pb cross join lateral jsonb_array_elements(pb->'exercises') pe where pe->>'id'=e->>'id' and pe->>'exercise_id'=e->>'exercise_id') into known;
   if not exists(select 1 from public.cueva_exercises where id=(e->>'exercise_id')::uuid and (active or known)) then raise exception 'Ejercicio inexistente o inactivo para una nueva selección' using errcode='22023'; end if;
  end loop;
 end loop;
end $$;
revoke all on function cueva_private.validate_plan(jsonb,jsonb) from public,anon,authenticated,service_role;
-- The new writer calls validation as owner; API callers cannot bypass it.
create function cueva_private.routine_write(p_kind text,p_id uuid,p_revision integer,p_content text,p_title text,p_operation uuid,p_plan jsonb)
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
  perform cueva_private.validate_plan(p_plan,t.plan);
  select * into t from public.cueva_routine_templates where id=p_id for update;
  if found then
   if t.save_id=p_operation and t.revision=p_revision+1 and t.content=p_content and t.title=p_title and t.plan is not distinct from p_plan then return to_jsonb(t); end if;
   if t.revision<>p_revision then raise exception 'El contenido cambió en otra ventana. Conservamos tu texto.' using errcode='40001'; end if;
   update public.cueva_routine_templates set content=p_content,title=p_title,plan=p_plan,revision=revision+1,save_id=p_operation,updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id returning * into t;
  else
   if p_revision<>0 then raise exception 'La plantilla cambió' using errcode='40001'; end if;
   insert into public.cueva_routine_templates values(p_id,p_title,p_content,1,p_operation,auth.uid(),clock_timestamp(),p_plan) returning * into t;
  end if;
  return to_jsonb(t);
 end if;
 perform 1 from public.cueva_students where id=p_id for update;
 if not found then raise exception 'No se encontró la ficha' using errcode='22023'; end if;
 select * into d from public.cueva_routine_drafts where student_id=p_id for update;
 if p_kind='draft' then
  perform cueva_private.validate_plan(p_plan,d.plan);
  select * into d from public.cueva_routine_drafts where student_id=p_id for update;
  if found then
   if d.save_id=p_operation and d.revision=p_revision+1 and d.content=p_content and d.plan is not distinct from p_plan then return to_jsonb(d); end if;
   if d.revision<>p_revision then raise exception 'El contenido cambió en otra ventana. Conservamos tu texto.' using errcode='40001'; end if;
   update public.cueva_routine_drafts set content=p_content,plan=p_plan,revision=revision+1,save_id=p_operation,updated_by=auth.uid(),updated_at=clock_timestamp() where student_id=p_id returning * into d;
  else
   if p_revision<>0 then raise exception 'El borrador cambió' using errcode='40001'; end if;
   insert into public.cueva_routine_drafts values(p_id,p_content,1,p_operation,auth.uid(),clock_timestamp(),p_plan) returning * into d;
  end if;
  return to_jsonb(d);
 end if;
 -- An operation ID is permanently bound to this exact snapshot and actor.
 select * into v from public.cueva_routine_publications where id=p_operation;
 if found then
  if v.student_id<>p_id or v.draft_revision<>p_revision or v.content<>p_content or v.plan is distinct from p_plan or v.published_by<>auth.uid() then
   raise exception 'La operación ya pertenece a otra publicación' using errcode='22023'; end if;
  return to_jsonb(v);
 end if;
 if d.student_id is null or d.revision<>p_revision or d.content<>p_content or d.plan is distinct from p_plan then
  raise exception 'Guardá los cambios actuales antes de publicar.' using errcode='40001'; end if;
 if length(btrim(p_content))=0 and not exists(select 1 from jsonb_array_elements(p_plan->'blocks') b cross join lateral jsonb_array_elements(b->'exercises') e) then raise exception 'Escribí una rutina antes de publicar' using errcode='22023'; end if;
 select * into v from public.cueva_routine_publications where student_id=p_id and draft_revision=p_revision;
 if found then return to_jsonb(v); end if;
 insert into public.cueva_routine_publications(id,student_id,draft_revision,content,published_by,plan) values(p_operation,p_id,p_revision,p_content,auth.uid(),p_plan) returning * into v;
 return to_jsonb(v);
end $$;
revoke all on function cueva_private.routine_write(text,uuid,integer,text,text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function cueva_private.routine_write(text,uuid,integer,text,text,uuid,jsonb) to authenticated;
create function public.cueva_routine_write(p_kind text,p_id uuid,p_revision integer,p_content text,p_title text,p_operation uuid,p_plan jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select cueva_private.routine_write(p_kind,p_id,p_revision,p_content,p_title,p_operation,p_plan)
$$;
revoke all on function public.cueva_routine_write(text,uuid,integer,text,text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.cueva_routine_write(text,uuid,integer,text,text,uuid,jsonb) to authenticated;


revoke all on function public.cueva_routine_write(text,uuid,integer,text,text,uuid),cueva_private.routine_write(text,uuid,integer,text,text,uuid) from public,anon,authenticated,service_role;
commit;
