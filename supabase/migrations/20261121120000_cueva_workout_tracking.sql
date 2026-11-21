begin;

-- Text-routine mentions inherit their kg/time tracking behavior from the catalog.
alter table public.cueva_exercises
  add column tracking_mode text not null default 'weight'
  check (tracking_mode in ('weight','time'));

-- A workout entry records what the student actually performed. It is kept
-- separate from immutable administrator targets in routine publications.
create table public.cueva_workout_entries (
  id uuid primary key,
  student_id uuid not null references public.cueva_students(id) on delete restrict,
  publication_id uuid not null references public.cueva_routine_publications(id) on delete restrict,
  exercise_id uuid not null references public.cueva_exercises(id) on delete restrict,
  target_id uuid,
  tracking_mode text not null check (tracking_mode in ('weight','time')),
  entry_mode text not null check (entry_mode in ('quick','sets')),
  quick_weight_kg numeric(7,2),
  quick_duration_seconds integer,
  performed_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint cueva_workout_quick_value_check check (
    (entry_mode = 'quick' and tracking_mode = 'weight'
      and quick_weight_kg between 0 and 2000 and quick_duration_seconds is null)
    or (entry_mode = 'quick' and tracking_mode = 'time'
      and quick_weight_kg is null and quick_duration_seconds between 1 and 86400)
    or (entry_mode = 'sets' and quick_weight_kg is null and quick_duration_seconds is null)
  )
);

create index cueva_workout_entries_student_exercise_idx
  on public.cueva_workout_entries(student_id, exercise_id, performed_at desc, created_at desc);
create index cueva_workout_entries_publication_idx
  on public.cueva_workout_entries(publication_id);

create table public.cueva_workout_sets (
  entry_id uuid not null references public.cueva_workout_entries(id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 30),
  reps smallint,
  weight_kg numeric(7,2),
  duration_seconds integer,
  primary key (entry_id, set_number),
  constraint cueva_workout_set_value_check check (
    (weight_kg between 0 and 2000 and duration_seconds is null and reps between 1 and 1000)
    or (weight_kg is null and duration_seconds between 1 and 86400 and reps is null)
  )
);

alter table public.cueva_workout_entries enable row level security;
alter table public.cueva_workout_sets enable row level security;
revoke all on public.cueva_workout_entries, public.cueva_workout_sets
  from public, anon, authenticated, service_role;

create function cueva_private.workout_record(
  p_id uuid,
  p_publication_id uuid,
  p_exercise_id uuid,
  p_target_id uuid,
  p_mode text,
  p_weight_kg numeric,
  p_sets jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid;
  v_publication public.cueva_routine_publications;
  v_existing public.cueva_workout_entries;
  v_set jsonb;
  v_number integer := 0;
  v_reps integer;
  v_weight numeric;
  v_plan_target boolean := false;
  v_text_mention boolean := false;
  v_sets jsonb := '[]'::jsonb;
begin
  if p_id is null or p_publication_id is null or p_exercise_id is null
    or p_mode is null or p_mode not in ('quick','sets') or p_sets is null
    or jsonb_typeof(p_sets) is distinct from 'array'
  then
    raise exception 'Registro de entrenamiento inválido' using errcode = '22023';
  end if;

  if p_mode = 'quick' then
    if p_weight_kg is null or p_weight_kg < 0 or p_weight_kg > 2000
      or round(p_weight_kg, 2) <> p_weight_kg or jsonb_array_length(p_sets) <> 0
    then
      raise exception 'Ingresá un peso entre 0 y 2000 kg, con hasta dos decimales' using errcode = '22023';
    end if;
  else
    if p_weight_kg is not null or jsonb_array_length(p_sets) not between 1 and 30
    then
      raise exception 'El detalle debe incluir entre 1 y 30 series' using errcode = '22023';
    end if;
    for v_set in select value from jsonb_array_elements(p_sets) loop
      v_number := v_number + 1;
      if jsonb_typeof(v_set) is distinct from 'object'
        or (v_set - 'reps' - 'weight_kg') <> '{}'::jsonb
        or jsonb_typeof(v_set->'reps') is distinct from 'number'
        or coalesce(v_set->>'reps','') !~ '^[1-9][0-9]{0,2}([0-9])?$'
        or (v_set->>'reps')::numeric > 1000
        or jsonb_typeof(v_set->'weight_kg') is distinct from 'number'
      then
        raise exception 'Revisá las repeticiones y el peso de cada serie' using errcode = '22023';
      end if;
      v_reps := (v_set->>'reps')::integer;
      v_weight := (v_set->>'weight_kg')::numeric;
      if v_reps not between 1 and 1000 or v_weight < 0 or v_weight > 2000
        or round(v_weight, 2) <> v_weight
      then
        raise exception 'Cada serie admite 1–1000 repeticiones y 0–2000 kg' using errcode = '22023';
      end if;
    end loop;
  end if;

  -- Serialize with publication changes and idempotent retries. The caller
  -- cannot select a student identity; ownership comes from the session.
  perform pg_advisory_xact_lock(903004001);

  -- Replay an already committed operation before requiring the publication to
  -- remain current. A lost HTTP response must not create a duplicate session.
  select * into v_existing from public.cueva_workout_entries where id = p_id;
  if found then
    if not cueva_private.routine_owner(v_existing.student_id) then
      raise exception 'Acceso restringido' using errcode = '42501';
    end if;
    if v_existing.publication_id <> p_publication_id
      or v_existing.exercise_id <> p_exercise_id
      or v_existing.target_id is distinct from p_target_id
      or v_existing.entry_mode <> p_mode
      or v_existing.quick_weight_kg is distinct from p_weight_kg
    then
      raise exception 'El identificador de operación ya fue utilizado' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'reps', s.reps, 'weight_kg', s.weight_kg
    ) order by s.set_number), '[]'::jsonb)
    into v_sets
    from public.cueva_workout_sets s where s.entry_id = p_id;
    if p_mode = 'sets' and v_sets <> p_sets then
      raise exception 'El identificador de operación ya fue utilizado' using errcode = '22023';
    end if;
    return jsonb_build_object('entry', to_jsonb(v_existing), 'sets', v_sets);
  end if;

  select p.* into v_publication
  from public.cueva_routine_publications p
  where p.id = p_publication_id
    and cueva_private.routine_owner(p.student_id)
    and p.draft_revision = cueva_private.routine_latest(p.student_id)
  for share;

  if not found then
    raise exception 'La rutina ya no está disponible para registrar este ejercicio' using errcode = '42501';
  end if;
  v_student := v_publication.student_id;

  if p_target_id is not null then
    select exists (
      select 1
      from jsonb_array_elements(cueva_private.plan_blocks(v_publication.plan)) b
      cross join lateral jsonb_array_elements(b->'exercises') item
      where item->>'id' = p_target_id::text
        and item->>'exercise_id' = p_exercise_id::text
        and coalesce(item->>'mode','weight') = 'weight'
    ) into v_plan_target;
  else
    select exists (
      select 1
      from public.cueva_routine_text_publications document
      cross join lateral jsonb_array_elements(document.mentions) mention
      join public.cueva_exercises exercise
        on exercise.id = (mention->>'exercise_id')::uuid
        and exercise.tracking_mode = 'weight'
      where document.publication_id = p_publication_id
        and document.student_id = v_student
        and document.format = 'text'
        and mention->>'exercise_id' = p_exercise_id::text
    ) into v_text_mention;
  end if;

  if (p_target_id is null and not v_text_mention)
    or (p_target_id is not null and not v_plan_target)
    or not exists (select 1 from public.cueva_exercises e where e.id = p_exercise_id)
  then
    raise exception 'El ejercicio no admite registro de peso en esta rutina' using errcode = '22023';
  end if;

  insert into public.cueva_workout_entries(
    id, student_id, publication_id, exercise_id, target_id,
    entry_mode, quick_weight_kg
  ) values (
    p_id, v_student, p_publication_id, p_exercise_id, p_target_id,
    p_mode, p_weight_kg
  );

  if p_mode = 'sets' then
    v_number := 0;
    for v_set in select value from jsonb_array_elements(p_sets) loop
      v_number := v_number + 1;
      insert into public.cueva_workout_sets(entry_id,set_number,reps,weight_kg)
      values(p_id,v_number,(v_set->>'reps')::integer,(v_set->>'weight_kg')::numeric);
    end loop;
    select coalesce(jsonb_agg(jsonb_build_object(
      'reps', s.reps, 'weight_kg', s.weight_kg
    ) order by s.set_number), '[]'::jsonb)
    into v_sets
    from public.cueva_workout_sets s where s.entry_id = p_id;
  end if;

  select * into v_existing from public.cueva_workout_entries where id = p_id;
  return jsonb_build_object('entry', to_jsonb(v_existing), 'sets', v_sets);
end;
$$;

revoke all on function cueva_private.workout_record(uuid,uuid,uuid,uuid,text,numeric,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.workout_record(uuid,uuid,uuid,uuid,text,numeric,jsonb)
  to authenticated;

create function public.cueva_workout_record(
  p_id uuid,
  p_publication_id uuid,
  p_exercise_id uuid,
  p_target_id uuid,
  p_mode text,
  p_weight_kg numeric,
  p_sets jsonb
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select cueva_private.workout_record(
    p_id,p_publication_id,p_exercise_id,p_target_id,p_mode,p_weight_kg,p_sets
  )
$$;

revoke all on function public.cueva_workout_record(uuid,uuid,uuid,uuid,text,numeric,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.cueva_workout_record(uuid,uuid,uuid,uuid,text,numeric,jsonb)
  to authenticated;

create function cueva_private.workout_history(p_exercise_id uuid, p_limit integer default 30, p_offset integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid;
  v_last numeric;
  v_entries jsonb;
  v_has_more boolean;
begin
  if p_exercise_id is null or p_limit is null or p_offset is null
    or p_limit not between 1 and 50 or p_offset not between 0 and 100000 then
    raise exception 'Consulta de historial inválida' using errcode = '22023';
  end if;
  select s.id into v_student
  from public.cueva_students s
  where cueva_private.routine_owner(s.id)
  limit 1;
  if v_student is null then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;

  select coalesce(e.quick_weight_kg, (
    select s.weight_kg from public.cueva_workout_sets s
    where s.entry_id = e.id order by s.set_number desc limit 1
  )) into v_last
  from public.cueva_workout_entries e
  where e.student_id = v_student and e.exercise_id = p_exercise_id
  order by e.performed_at desc, e.created_at desc, e.id desc
  limit 1;

  select exists (
    select 1 from public.cueva_workout_entries e
    where e.student_id = v_student and e.exercise_id = p_exercise_id
    order by e.performed_at desc, e.created_at desc, e.id desc
    offset (p_offset + p_limit) limit 1
  ) into v_has_more;

  select coalesce(jsonb_agg(row_data.entry_json order by row_data.performed_at desc), '[]'::jsonb)
  into v_entries
  from (
    select e.performed_at, jsonb_build_object(
      'id', e.id,
      'performed_at', e.performed_at,
      'mode', e.entry_mode,
      'weight_kg', e.quick_weight_kg,
      'sets', coalesce((
        select jsonb_agg(jsonb_build_object(
          'set_number', s.set_number, 'reps', s.reps, 'weight_kg', s.weight_kg
        ) order by s.set_number)
        from public.cueva_workout_sets s where s.entry_id = e.id
      ), '[]'::jsonb)
    ) as entry_json
    from public.cueva_workout_entries e
    where e.student_id = v_student and e.exercise_id = p_exercise_id
    order by e.performed_at desc, e.created_at desc, e.id desc
    limit p_limit offset p_offset
  ) row_data;

  return jsonb_build_object('last_weight_kg', v_last, 'entries', v_entries, 'has_more', v_has_more);
end;
$$;

revoke all on function cueva_private.workout_history(uuid,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.workout_history(uuid,integer,integer) to authenticated;

create function public.cueva_workout_history(p_exercise_id uuid, p_limit integer default 30, p_offset integer default 0)
returns jsonb
language sql
security invoker
set search_path = ''
as $workout$
  select cueva_private.workout_history(p_exercise_id,p_limit,p_offset)
$workout$;

revoke all on function public.cueva_workout_history(uuid,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.cueva_workout_history(uuid,integer,integer) to authenticated;


-- Replace the exercise writer with a versioned catalog field for text routines.
drop function public.cueva_exercise_write(uuid,text,boolean,integer,text,text,text);
drop function cueva_private.exercise_write(uuid,text,boolean,integer,text,text,text);

create function cueva_private.exercise_write(
  p_id uuid, p_name text, p_active boolean, p_revision integer,
  p_description text, p_video_url text, p_video_path text, p_tracking_mode text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $exwrite$
declare
  e public.cueva_exercises;
  normalized text;
begin
  if not cueva_private.routine_admin() then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  normalized := btrim(regexp_replace(p_name,'[[:space:]]+',' ','g'));
  if p_id is null or normalized is null or length(normalized) not between 1 and 120
    or p_active is null or p_revision is null or p_revision < 0 or p_revision > 2147483646
    or p_description is null or length(p_description) > 2000
    or p_tracking_mode is null or p_tracking_mode not in ('weight','time')
    or (p_video_url is not null and p_video_path is not null)
  then
    raise exception 'Datos inválidos' using errcode = '22023';
  end if;
  if p_video_url is not null
    and substring(p_video_url from '^https://((www[.])?youtube[.]com/(watch[?]v=|shorts/|embed/)|youtu[.]be/)[A-Za-z0-9_-]{11}') is distinct from p_video_url
  then
    raise exception 'Video inválido' using errcode = '22023';
  end if;
  if p_video_path is not null and (
    substring(p_video_path from ('^'||p_id::text||'/[0-9a-f-]{36}[.](mp4|mov|webm)')) is distinct from p_video_path
    or not exists (
      select 1 from storage.objects
      where bucket_id='cueva-exercise-videos' and name=p_video_path
        and (metadata->>'size')::bigint between 1 and 52428800
        and metadata->>'mimetype' in ('video/mp4','video/quicktime','video/webm')
    )
  ) then
    raise exception 'Archivo no disponible' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(903004001);
  select * into e from public.cueva_exercises where id=p_id for update;
  if found then
    if e.name=normalized and e.active=p_active and e.description=p_description
      and e.video_url is not distinct from p_video_url
      and e.video_path is not distinct from p_video_path
      and e.tracking_mode=p_tracking_mode and e.revision=p_revision+1
    then return to_jsonb(e); end if;
    if e.revision<>p_revision then
      raise exception 'El ejercicio cambió. Revisá la versión actual.' using errcode = '40001';
    end if;
    update public.cueva_exercises
      set name=normalized, active=p_active, description=p_description,
        video_url=p_video_url, video_path=p_video_path, tracking_mode=p_tracking_mode,
        revision=revision+1, updated_by=auth.uid(), updated_at=clock_timestamp()
      where id=p_id returning * into e;
  else
    if p_revision<>0 then raise exception 'El ejercicio cambió' using errcode = '40001'; end if;
    insert into public.cueva_exercises(
      id,name,active,revision,updated_by,description,video_url,video_path,tracking_mode
    ) values (
      p_id,normalized,p_active,1,auth.uid(),p_description,p_video_url,p_video_path,p_tracking_mode
    ) returning * into e;
  end if;
  return to_jsonb(e);
end;
$exwrite$;

revoke all on function cueva_private.exercise_write(uuid,text,boolean,integer,text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function cueva_private.exercise_write(uuid,text,boolean,integer,text,text,text,text)
  to authenticated;

create function public.cueva_exercise_write(
  p_id uuid, p_name text, p_active boolean, p_revision integer,
  p_description text, p_video_url text, p_video_path text, p_tracking_mode text
) returns jsonb
language sql
security invoker
set search_path = ''
as $exercise_write$
  select cueva_private.exercise_write(
    p_id,p_name,p_active,p_revision,p_description,p_video_url,p_video_path,p_tracking_mode
  )
$exercise_write$;

revoke all on function public.cueva_exercise_write(uuid,text,boolean,integer,text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.cueva_exercise_write(uuid,text,boolean,integer,text,text,text,text)
  to authenticated;

create function cueva_private.student_mentioned_exercises_with_tracking_mode()
returns table(id uuid, name text, description text, tracking_mode text)
language sql stable security definer set search_path = ''
as $mentions_private$
  select distinct e.id, e.name, e.description, e.tracking_mode
  from public.cueva_routine_text_publications document
  join public.cueva_routine_publications publication on publication.id = document.publication_id
  cross join lateral jsonb_array_elements(document.mentions) mention
  join public.cueva_exercises e on e.id = (mention->>'exercise_id')::uuid
  where document.format = 'text'
    and cueva_private.routine_owner(document.student_id)
    and publication.draft_revision = cueva_private.routine_latest(document.student_id)
$mentions_private$;
revoke all on function cueva_private.student_mentioned_exercises_with_tracking_mode()
  from public,anon,authenticated,service_role;
grant execute on function cueva_private.student_mentioned_exercises_with_tracking_mode()
  to authenticated;

create function public.cueva_student_mentioned_exercises_with_tracking_mode()
returns table(id uuid, name text, description text, tracking_mode text)
language sql security invoker set search_path = ''
as $mentions$
  select * from cueva_private.student_mentioned_exercises_with_tracking_mode()
$mentions$;
revoke all on function public.cueva_student_mentioned_exercises_with_tracking_mode()
  from public,anon,authenticated,service_role;
grant execute on function public.cueva_student_mentioned_exercises_with_tracking_mode()
  to authenticated;

commit;
