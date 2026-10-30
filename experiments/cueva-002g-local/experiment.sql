-- LOCAL EXPERIMENT ONLY. Not a deployable migration or a production security claim.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE authenticator LOGIN;
CREATE ROLE cueva_coordinator LOGIN NOBYPASSRLS;
GRANT anon, authenticated TO authenticator;
CREATE SCHEMA private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO cueva_coordinator;
GRANT USAGE ON SCHEMA auth TO authenticated;

REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE private.onboarding (user_id uuid PRIMARY KEY REFERENCES auth.users(id), ready boolean NOT NULL DEFAULT false, generation bigint NOT NULL DEFAULT 1);
REVOKE ALL ON private.onboarding FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.ready() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, private, auth
  AS $$ SELECT coalesce((SELECT ready FROM private.onboarding WHERE user_id = auth.uid()), false)
    AND EXISTS (SELECT 1 FROM auth.sessions s WHERE s.user_id = auth.uid()
      AND s.id = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'session_id','')::uuid) $$;
REVOKE ALL ON FUNCTION private.ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.ready() TO authenticated;

-- Experimental coordinator only: no direct access to the private table.
CREATE FUNCTION private.pending(p_user uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, private
  AS $$ SELECT generation FROM private.onboarding WHERE user_id = p_user AND NOT ready $$;
CREATE FUNCTION private.activate(p_user uuid, p_generation bigint, p_session uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, private, auth
  AS $$ WITH updated AS (
    UPDATE private.onboarding SET ready=true WHERE user_id=p_user AND NOT ready AND generation=p_generation
      AND EXISTS (SELECT 1 FROM auth.sessions WHERE id=p_session AND user_id=p_user)
    RETURNING 1
  ) SELECT EXISTS (SELECT 1 FROM updated) $$;
REVOKE ALL ON FUNCTION private.pending(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.activate(uuid,bigint,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.pending(uuid) TO cueva_coordinator;
GRANT EXECUTE ON FUNCTION private.activate(uuid,bigint,uuid) TO cueva_coordinator;

CREATE TABLE public.lab_records (id integer PRIMARY KEY, owner_id uuid NOT NULL, content text NOT NULL);
ALTER TABLE public.lab_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_records FORCE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_records TO authenticated;
CREATE POLICY lab_isolation ON public.lab_records TO authenticated
  USING (owner_id = auth.uid() AND private.ready())
  WITH CHECK (owner_id = auth.uid() AND private.ready());
