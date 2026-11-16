begin;

-- Text mode is stored beside the established block model. This avoids
-- rewriting existing routine rows and keeps immutable publication snapshots.
create table public.cueva_routine_text_drafts (
  kind text not null check (kind in ('draft','template')),
  owner_id uuid not null,
  revision integer not null check (revision > 0),
  format text not null check (format in ('blocks','text')),
  text_content text not null default '' check (length(text_content) <= 40000),
  block_content text not null default '' check (length(block_content) <= 40000),
  mentions jsonb not null default '[]'::jsonb check (jsonb_typeof(mentions) = 'array'),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (kind, owner_id)
);

create table public.cueva_routine_text_publications (
  publication_id uuid primary key references public.cueva_routine_publications(id) on delete restrict,
  student_id uuid not null references public.cueva_students(id) on delete restrict,
  format text not null check (format in ('blocks','text')),
  text_content text not null default '' check (length(text_content) <= 40000),
  mentions jsonb not null default '[]'::jsonb check (jsonb_typeof(mentions) = 'array'),
  published_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp()
);

create index cueva_routine_text_publications_student_idx
  on public.cueva_routine_text_publications(student_id, publication_id);

alter table public.cueva_routine_text_drafts enable row level security;
alter table public.cueva_routine_text_publications enable row level security;
revoke all on public.cueva_routine_text_drafts, public.cueva_routine_text_publications
  from public, anon, authenticated, service_role;
grant select on public.cueva_routine_text_drafts, public.cueva_routine_text_publications
  to authenticated;

create policy routine_text_draft_admin on public.cueva_routine_text_drafts
  for select to authenticated using ((select cueva_private.routine_admin()));

create policy routine_text_publication_reader on public.cueva_routine_text_publications
  for select to authenticated using (
    (select cueva_private.routine_admin())
    or (
      cueva_private.routine_owner(student_id)
      and exists (
        select 1
        from public.cueva_routine_publications p
        where p.id = publication_id
          and p.draft_revision = cueva_private.routine_latest(student_id)
      )
    )
  );

create function cueva_private.routine_text_write(
  p_kind text,
  p_id uuid,
  p_revision integer,
  p_content text,
  p_title text,
  p_operation uuid,
  p_plan jsonb,
  p_format text,
  p_text_content text,
  p_mentions jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_previous jsonb := '[]'::jsonb;
  v_mention jsonb;
  v_start integer;
  v_end integer;
  v_previous_end integer := 0;
  v_length integer;
  v_revision integer;
  v_base_content text;
  v_publication public.cueva_routine_publications;
  v_existing public.cueva_routine_text_publications;
begin
  if not cueva_private.routine_admin() then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('draft','template','publish')
    or p_id is null or p_operation is null
    or p_revision is null or p_revision < 0
    or p_format is null or p_format not in ('blocks','text')
    or p_text_content is null or length(p_text_content) > 40000
    or (p_format = 'text' and length(btrim(p_text_content)) = 0)
    or jsonb_typeof(p_mentions) is distinct from 'array'
    or jsonb_array_length(p_mentions) > 300
  then
    raise exception 'Documento de texto libre inválido' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(903004001);

  -- A retry of an already committed publication is checked against its
  -- immutable sidecar, not against a draft that may since have advanced.
  if p_kind = 'publish' then
    v_base_content := case when p_format = 'text' then p_text_content else p_content end;
    select * into v_publication from public.cueva_routine_publications where id = p_operation;
    select * into v_existing from public.cueva_routine_text_publications where publication_id = p_operation;
    if found then
      if v_publication.id is null or v_publication.student_id <> p_id
        or v_publication.draft_revision <> p_revision
        or v_publication.content <> v_base_content
        or v_publication.plan is distinct from p_plan
        or v_publication.published_by <> auth.uid()
        or v_existing.student_id <> p_id or v_existing.format <> p_format
        or v_existing.text_content <> p_text_content or v_existing.block_content <> p_content
        or v_existing.mentions <> p_mentions or v_existing.published_by <> auth.uid()
      then
        raise exception 'La publicación ya contiene otra versión' using errcode = '22023';
      end if;
      return to_jsonb(v_publication) || jsonb_build_object(
        'format', v_existing.format,
        'text_content', v_existing.text_content,
        'block_content', v_existing.block_content,
        'mentions', v_existing.mentions
      );
    end if;
  end if;

  if p_kind in ('draft','template') then
    select mentions into v_previous
    from public.cueva_routine_text_drafts
    where kind = p_kind and owner_id = p_id;
    v_previous := coalesce(v_previous, '[]'::jsonb);
  else
    select mentions into v_previous
    from public.cueva_routine_text_drafts
    where kind = 'draft' and owner_id = p_id;
    v_previous := coalesce(v_previous, '[]'::jsonb);
  end if;

  v_length := char_length(p_text_content);
  for v_mention in select value from jsonb_array_elements(p_mentions) loop
    if jsonb_typeof(v_mention) is distinct from 'object'
      or (v_mention - 'exercise_id' - 'start' - 'end' - 'text') <> '{}'::jsonb
      or coalesce(v_mention->>'exercise_id','') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      or jsonb_typeof(v_mention->'start') is distinct from 'number'
      or jsonb_typeof(v_mention->'end') is distinct from 'number'
      or coalesce(v_mention->>'start','') !~ '^(0|[1-9][0-9]*)      or coalesce(v_mention->>'text','') = ''
    then
      raise exception 'Referencia de ejercicio inválida' using errcode = '22023';
    end if;

    v_start := (v_mention->>'start')::integer;
    v_end := (v_mention->>'end')::integer;
    if v_start < v_previous_end or v_start < 0 or v_end <= v_start or v_end > v_length
      or substring(p_text_content from v_start + 1 for v_end - v_start) <> v_mention->>'text'
    then
      raise exception 'Los rangos de menciones no coinciden con el texto' using errcode = '22023';
    end if;
    v_previous_end := v_end;

    if not exists (
      select 1 from public.cueva_exercises e
      where e.id = (v_mention->>'exercise_id')::uuid and e.active
    ) and not exists (
      select 1 from jsonb_array_elements(v_previous) old_mention
      where old_mention->>'exercise_id' = v_mention->>'exercise_id'
    ) then
      raise exception 'El ejercicio no existe o está inactivo para una nueva mención'
        using errcode = '22023';
    end if;
  end loop;

  v_base_content := case when p_format = 'text' then p_text_content else p_content end;
  v_result := cueva_private.routine_write(
    p_kind, p_id, p_revision, v_base_content, p_title, p_operation, p_plan
  );
  v_revision := (v_result->>'revision')::integer;

  if p_kind = 'publish' then
    select * into v_publication
    from public.cueva_routine_publications
    where id = p_operation;
    if not found then
      raise exception 'No se encontró la publicación confirmada' using errcode = '40001';
    end if;

    if v_publication.student_id <> p_id
      or v_publication.draft_revision <> p_revision
      or v_publication.content <> v_base_content
      or v_publication.published_by <> auth.uid()
    then
      raise exception 'La publicación no coincide con el borrador confirmado' using errcode = '40001';
    end if;

    if not exists (select 1 from public.cueva_routine_text_drafts d where d.kind='draft' and d.owner_id=p_id)
      and (p_format <> 'blocks' or p_text_content <> '' or p_mentions <> '[]'::jsonb) then
      raise exception 'Guardá el documento de texto antes de publicar' using errcode = '40001';
    end if;
    if exists (
      select 1 from public.cueva_routine_text_drafts d
      where d.kind = 'draft' and d.owner_id = p_id
        and (d.revision <> p_revision or d.format <> p_format
          or d.text_content <> p_text_content or d.block_content <> p_content or d.mentions <> p_mentions)
    ) then
      raise exception 'Guardá el documento de texto antes de publicar' using errcode = '40001';
    end if;

    insert into public.cueva_routine_text_publications (
      publication_id, student_id, format, text_content, block_content, mentions, published_by
    ) values (
      p_operation, p_id, p_format, p_text_content, p_content, p_mentions, auth.uid()
    ) on conflict (publication_id) do nothing;

    select * into v_existing
    from public.cueva_routine_text_publications
    where publication_id = p_operation;
    if v_existing.student_id <> p_id or v_existing.format <> p_format
      or v_existing.text_content <> p_text_content or v_existing.block_content <> p_content or v_existing.mentions <> p_mentions
      or v_existing.published_by <> auth.uid()
    then
      raise exception 'La publicación ya contiene otro documento de texto' using errcode = '22023';
    end if;
    return to_jsonb(v_publication) || jsonb_build_object(
      'format', v_existing.format,
      'text_content', v_existing.text_content,
      'block_content', v_existing.block_content,
      'mentions', v_existing.mentions
    );
  end if;

  insert into public.cueva_routine_text_drafts (
    kind, owner_id, revision, format, text_content, block_content, mentions, updated_by, updated_at
  ) values (
    p_kind, p_id, v_revision, p_format, p_text_content, p_content, p_mentions, auth.uid(), clock_timestamp()
  )
  on conflict (kind, owner_id) do update set
    revision = excluded.revision,
    format = excluded.format,
    text_content = excluded.text_content,
    block_content = excluded.block_content,
    mentions = excluded.mentions,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  where public.cueva_routine_text_drafts.revision <= excluded.revision;

  return v_result || jsonb_build_object(
    'format', p_format,
    'text_content', p_text_content,
    'block_content', p_content,
    'mentions', p_mentions
  );
end;
$$;

revoke all on function cueva_private.routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function cueva_private.routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) to authenticated;

create function public.cueva_routine_text_write(
  p_kind text,
  p_id uuid,
  p_revision integer,
  p_content text,
  p_title text,
  p_operation uuid,
  p_plan jsonb,
  p_format text,
  p_text_content text,
  p_mentions jsonb
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select cueva_private.routine_text_write(
    p_kind,p_id,p_revision,p_content,p_title,p_operation,p_plan,
    p_format,p_text_content,p_mentions
  )
$$;

revoke all on function public.cueva_routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.cueva_routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) to authenticated;


create function cueva_private.student_mentioned_exercises()
returns table(id uuid, name text, description text)
language sql
stable
security definer
set search_path = ''
as $
  select distinct e.id, e.name, e.description
  from public.cueva_routine_text_publications document
  join public.cueva_routine_publications publication
    on publication.id = document.publication_id
  cross join lateral jsonb_array_elements(document.mentions) mention
  join public.cueva_exercises e
    on e.id = (mention->>'exercise_id')::uuid
  where cueva_private.routine_owner(document.student_id)
    and publication.draft_revision = cueva_private.routine_latest(document.student_id)
$;

revoke all on function cueva_private.student_mentioned_exercises()
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.student_mentioned_exercises() to authenticated;

create function public.cueva_student_mentioned_exercises()
returns table(id uuid, name text, description text)
language sql
security invoker
set search_path = ''
as $
  select * from cueva_private.student_mentioned_exercises()
$;

revoke all on function public.cueva_student_mentioned_exercises()
  from public, anon, authenticated, service_role;
grant execute on function public.cueva_student_mentioned_exercises() to authenticated;

commit;

      or coalesce(v_mention->>'end','') !~ '^(0|[1-9][0-9]*)      or coalesce(v_mention->>'text','') = ''
    then
      raise exception 'Referencia de ejercicio inválida' using errcode = '22023';
    end if;

    v_start := (v_mention->>'start')::integer;
    v_end := (v_mention->>'end')::integer;
    if v_start < v_previous_end or v_start < 0 or v_end <= v_start or v_end > v_length
      or substring(p_text_content from v_start + 1 for v_end - v_start) <> v_mention->>'text'
    then
      raise exception 'Los rangos de menciones no coinciden con el texto' using errcode = '22023';
    end if;
    v_previous_end := v_end;

    if not exists (
      select 1 from public.cueva_exercises e
      where e.id = (v_mention->>'exercise_id')::uuid and e.active
    ) and not exists (
      select 1 from jsonb_array_elements(v_previous) old_mention
      where old_mention->>'exercise_id' = v_mention->>'exercise_id'
    ) then
      raise exception 'El ejercicio no existe o está inactivo para una nueva mención'
        using errcode = '22023';
    end if;
  end loop;

  v_base_content := case when p_format = 'text' then p_text_content else p_content end;
  v_result := cueva_private.routine_write(
    p_kind, p_id, p_revision, v_base_content, p_title, p_operation, p_plan
  );
  v_revision := (v_result->>'revision')::integer;

  if p_kind = 'publish' then
    select * into v_publication
    from public.cueva_routine_publications
    where id = p_operation;
    if not found then
      raise exception 'No se encontró la publicación confirmada' using errcode = '40001';
    end if;

    if v_publication.student_id <> p_id
      or v_publication.draft_revision <> p_revision
      or v_publication.content <> v_base_content
      or v_publication.published_by <> auth.uid()
    then
      raise exception 'La publicación no coincide con el borrador confirmado' using errcode = '40001';
    end if;

    if not exists (select 1 from public.cueva_routine_text_drafts d where d.kind='draft' and d.owner_id=p_id)
      and (p_format <> 'blocks' or p_text_content <> '' or p_mentions <> '[]'::jsonb) then
      raise exception 'Guardá el documento de texto antes de publicar' using errcode = '40001';
    end if;
    if exists (
      select 1 from public.cueva_routine_text_drafts d
      where d.kind = 'draft' and d.owner_id = p_id
        and (d.revision <> p_revision or d.format <> p_format
          or d.text_content <> p_text_content or d.block_content <> p_content or d.mentions <> p_mentions)
    ) then
      raise exception 'Guardá el documento de texto antes de publicar' using errcode = '40001';
    end if;

    insert into public.cueva_routine_text_publications (
      publication_id, student_id, format, text_content, block_content, mentions, published_by
    ) values (
      p_operation, p_id, p_format, p_text_content, p_content, p_mentions, auth.uid()
    ) on conflict (publication_id) do nothing;

    select * into v_existing
    from public.cueva_routine_text_publications
    where publication_id = p_operation;
    if v_existing.student_id <> p_id or v_existing.format <> p_format
      or v_existing.text_content <> p_text_content or v_existing.block_content <> p_content or v_existing.mentions <> p_mentions
      or v_existing.published_by <> auth.uid()
    then
      raise exception 'La publicación ya contiene otro documento de texto' using errcode = '22023';
    end if;
    return to_jsonb(v_publication) || jsonb_build_object(
      'format', v_existing.format,
      'text_content', v_existing.text_content,
      'block_content', v_existing.block_content,
      'mentions', v_existing.mentions
    );
  end if;

  insert into public.cueva_routine_text_drafts (
    kind, owner_id, revision, format, text_content, block_content, mentions, updated_by, updated_at
  ) values (
    p_kind, p_id, v_revision, p_format, p_text_content, p_content, p_mentions, auth.uid(), clock_timestamp()
  )
  on conflict (kind, owner_id) do update set
    revision = excluded.revision,
    format = excluded.format,
    text_content = excluded.text_content,
    block_content = excluded.block_content,
    mentions = excluded.mentions,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  where public.cueva_routine_text_drafts.revision <= excluded.revision;

  return v_result || jsonb_build_object(
    'format', p_format,
    'text_content', p_text_content,
    'block_content', p_content,
    'mentions', p_mentions
  );
end;
$$;

revoke all on function cueva_private.routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function cueva_private.routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) to authenticated;

create function public.cueva_routine_text_write(
  p_kind text,
  p_id uuid,
  p_revision integer,
  p_content text,
  p_title text,
  p_operation uuid,
  p_plan jsonb,
  p_format text,
  p_text_content text,
  p_mentions jsonb
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select cueva_private.routine_text_write(
    p_kind,p_id,p_revision,p_content,p_title,p_operation,p_plan,
    p_format,p_text_content,p_mentions
  )
$$;

revoke all on function public.cueva_routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.cueva_routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) to authenticated;

commit;

      or coalesce(v_mention->>'text','') = ''
    then
      raise exception 'Referencia de ejercicio inválida' using errcode = '22023';
    end if;

    v_start := (v_mention->>'start')::integer;
    v_end := (v_mention->>'end')::integer;
    if v_start < v_previous_end or v_start < 0 or v_end <= v_start or v_end > v_length
      or substring(p_text_content from v_start + 1 for v_end - v_start) <> v_mention->>'text'
    then
      raise exception 'Los rangos de menciones no coinciden con el texto' using errcode = '22023';
    end if;
    v_previous_end := v_end;

    if not exists (
      select 1 from public.cueva_exercises e
      where e.id = (v_mention->>'exercise_id')::uuid and e.active
    ) and not exists (
      select 1 from jsonb_array_elements(v_previous) old_mention
      where old_mention->>'exercise_id' = v_mention->>'exercise_id'
    ) then
      raise exception 'El ejercicio no existe o está inactivo para una nueva mención'
        using errcode = '22023';
    end if;
  end loop;

  v_base_content := case when p_format = 'text' then p_text_content else p_content end;
  v_result := cueva_private.routine_write(
    p_kind, p_id, p_revision, v_base_content, p_title, p_operation, p_plan
  );
  v_revision := (v_result->>'revision')::integer;

  if p_kind = 'publish' then
    select * into v_publication
    from public.cueva_routine_publications
    where id = p_operation;
    if not found then
      raise exception 'No se encontró la publicación confirmada' using errcode = '40001';
    end if;

    if v_publication.student_id <> p_id
      or v_publication.draft_revision <> p_revision
      or v_publication.content <> v_base_content
      or v_publication.published_by <> auth.uid()
    then
      raise exception 'La publicación no coincide con el borrador confirmado' using errcode = '40001';
    end if;

    if not exists (select 1 from public.cueva_routine_text_drafts d where d.kind='draft' and d.owner_id=p_id)
      and (p_format <> 'blocks' or p_text_content <> '' or p_mentions <> '[]'::jsonb) then
      raise exception 'Guardá el documento de texto antes de publicar' using errcode = '40001';
    end if;
    if exists (
      select 1 from public.cueva_routine_text_drafts d
      where d.kind = 'draft' and d.owner_id = p_id
        and (d.revision <> p_revision or d.format <> p_format
          or d.text_content <> p_text_content or d.block_content <> p_content or d.mentions <> p_mentions)
    ) then
      raise exception 'Guardá el documento de texto antes de publicar' using errcode = '40001';
    end if;

    insert into public.cueva_routine_text_publications (
      publication_id, student_id, format, text_content, block_content, mentions, published_by
    ) values (
      p_operation, p_id, p_format, p_text_content, p_content, p_mentions, auth.uid()
    ) on conflict (publication_id) do nothing;

    select * into v_existing
    from public.cueva_routine_text_publications
    where publication_id = p_operation;
    if v_existing.student_id <> p_id or v_existing.format <> p_format
      or v_existing.text_content <> p_text_content or v_existing.block_content <> p_content or v_existing.mentions <> p_mentions
      or v_existing.published_by <> auth.uid()
    then
      raise exception 'La publicación ya contiene otro documento de texto' using errcode = '22023';
    end if;
    return to_jsonb(v_publication) || jsonb_build_object(
      'format', v_existing.format,
      'text_content', v_existing.text_content,
      'block_content', v_existing.block_content,
      'mentions', v_existing.mentions
    );
  end if;

  insert into public.cueva_routine_text_drafts (
    kind, owner_id, revision, format, text_content, block_content, mentions, updated_by, updated_at
  ) values (
    p_kind, p_id, v_revision, p_format, p_text_content, p_content, p_mentions, auth.uid(), clock_timestamp()
  )
  on conflict (kind, owner_id) do update set
    revision = excluded.revision,
    format = excluded.format,
    text_content = excluded.text_content,
    block_content = excluded.block_content,
    mentions = excluded.mentions,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  where public.cueva_routine_text_drafts.revision <= excluded.revision;

  return v_result || jsonb_build_object(
    'format', p_format,
    'text_content', p_text_content,
    'block_content', p_content,
    'mentions', p_mentions
  );
end;
$$;

revoke all on function cueva_private.routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function cueva_private.routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) to authenticated;

create function public.cueva_routine_text_write(
  p_kind text,
  p_id uuid,
  p_revision integer,
  p_content text,
  p_title text,
  p_operation uuid,
  p_plan jsonb,
  p_format text,
  p_text_content text,
  p_mentions jsonb
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select cueva_private.routine_text_write(
    p_kind,p_id,p_revision,p_content,p_title,p_operation,p_plan,
    p_format,p_text_content,p_mentions
  )
$$;

revoke all on function public.cueva_routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.cueva_routine_text_write(
  text,uuid,integer,text,text,uuid,jsonb,text,text,jsonb
) to authenticated;

commit;
