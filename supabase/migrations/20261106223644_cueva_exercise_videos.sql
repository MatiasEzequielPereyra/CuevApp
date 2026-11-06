begin;
alter table public.cueva_exercises add column description text not null default '' check(length(description)<=2000);
alter table public.cueva_exercises add column video_url text check(video_url ~ '^https://((www\.)?youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)[A-Za-z0-9_-]{11}$');
alter table public.cueva_exercises add column video_path text;
alter table public.cueva_exercises add constraint exercise_video_one_source check(video_url is null or video_path is null);
-- Private bucket. Never overwrite/delete an existing object through the product.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cueva-exercise-videos','cueva-exercise-videos',false,52428800,array['video/mp4','video/quicktime','video/webm']);
create function cueva_private.exercise_allowed(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select cueva_private.routine_admin() or exists(
  select 1 from public.cueva_routine_publications p
  cross join lateral jsonb_array_elements(cueva_private.plan_blocks(p.plan)) b
  cross join lateral jsonb_array_elements(b->'exercises') e
  where cueva_private.routine_owner(p.student_id) and p.draft_revision=cueva_private.routine_latest(p.student_id) and (e->>'exercise_id')::uuid=p_id
 )
$$;
revoke all on function cueva_private.exercise_allowed(uuid) from public,anon,authenticated,service_role;
grant execute on function cueva_private.exercise_allowed(uuid) to authenticated;
create policy cueva_video_insert on storage.objects for insert to authenticated with check(bucket_id='cueva-exercise-videos' and cueva_private.routine_admin() and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|mov|webm)$');
create function cueva_private.video_path_allowed(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select cueva_private.routine_admin() or exists(select 1 from public.cueva_exercises e where e.video_path=p_path and cueva_private.exercise_allowed(e.id))
$$;
revoke all on function cueva_private.video_path_allowed(text) from public,anon,authenticated,service_role;
grant execute on function cueva_private.video_path_allowed(text) to authenticated;
create policy cueva_video_read on storage.objects for select to authenticated using(bucket_id='cueva-exercise-videos' and cueva_private.video_path_allowed(name));
-- The resource capability returns no catalogue, draft, profile or administrative metadata.
create function cueva_private.exercise_resource(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not cueva_private.exercise_allowed(p_id) then raise exception 'Acceso restringido' using errcode='42501'; end if;
 return (select jsonb_build_object('video_url',video_url,'video_path',video_path) from public.cueva_exercises where id=p_id);
end $$;
revoke all on function cueva_private.exercise_resource(uuid) from public,anon,authenticated,service_role;
grant execute on function cueva_private.exercise_resource(uuid) to authenticated;
create function public.cueva_exercise_resource(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select cueva_private.exercise_resource(p_id) $$;
revoke all on function public.cueva_exercise_resource(uuid) from public,anon,authenticated,service_role;
grant execute on function public.cueva_exercise_resource(uuid) to authenticated;
create function cueva_private.exercise_write(p_id uuid,p_name text,p_active boolean,p_revision integer,p_description text,p_video_url text,p_video_path text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.cueva_exercises; normalized text;
begin
 if not cueva_private.routine_admin() then raise exception 'Acceso restringido' using errcode='42501'; end if;
 normalized=btrim(regexp_replace(p_name,'[[:space:]]+',' ','g'));
 if p_id is null or normalized is null or length(normalized) not between 1 and 120 or p_active is null or p_revision is null or p_revision<0 or p_revision>2147483646 or p_description is null or length(p_description)>2000 or (p_video_url is not null and p_video_path is not null) then raise exception 'Datos inválidos' using errcode='22023'; end if;
 if p_video_url is not null and p_video_url !~ '^https://((www\.)?youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)[A-Za-z0-9_-]{11}$' then raise exception 'Video inválido' using errcode='22023'; end if;
 if p_video_path is not null and (p_video_path !~ ('^'||p_id::text||'/[0-9a-f-]{36}\.(mp4|mov|webm)$') or not exists(select 1 from storage.objects where bucket_id='cueva-exercise-videos' and name=p_video_path and (metadata->>'size')::bigint between 1 and 52428800 and metadata->>'mimetype' in ('video/mp4','video/quicktime','video/webm'))) then raise exception 'Archivo no disponible' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(903004001);
 select * into e from public.cueva_exercises where id=p_id for update;
 if found then
  if e.name=normalized and e.active=p_active and e.description=p_description and e.video_url is not distinct from p_video_url and e.video_path is not distinct from p_video_path and e.revision=p_revision+1 then return to_jsonb(e); end if;
  if e.revision<>p_revision then raise exception 'El ejercicio cambió. Revisá la versión actual.' using errcode='40001'; end if;
  update public.cueva_exercises set name=normalized,active=p_active,description=p_description,video_url=p_video_url,video_path=p_video_path,revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id returning * into e;
 else
  if p_revision<>0 then raise exception 'El ejercicio cambió' using errcode='40001'; end if;
  insert into public.cueva_exercises(id,name,active,revision,updated_by,description,video_url,video_path) values(p_id,normalized,p_active,1,auth.uid(),p_description,p_video_url,p_video_path) returning * into e;
 end if;
 return to_jsonb(e);
end $$;
revoke all on function cueva_private.exercise_write(uuid,text,boolean,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function cueva_private.exercise_write(uuid,text,boolean,integer,text,text,text) to authenticated;
create function public.cueva_exercise_write(p_id uuid,p_name text,p_active boolean,p_revision integer,p_description text,p_video_url text,p_video_path text)
returns jsonb language sql security invoker set search_path='' as $$ select cueva_private.exercise_write(p_id,p_name,p_active,p_revision,p_description,p_video_url,p_video_path) $$;
revoke all on function public.cueva_exercise_write(uuid,text,boolean,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.cueva_exercise_write(uuid,text,boolean,integer,text,text,text) to authenticated;
revoke all on function public.cueva_exercise_write(uuid,text,boolean,integer),cueva_private.exercise_write(uuid,text,boolean,integer) from public,anon,authenticated,service_role;
commit;
