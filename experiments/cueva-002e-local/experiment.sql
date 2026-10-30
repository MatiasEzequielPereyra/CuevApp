-- LOCAL EXPERIMENT ONLY. Not a deployable migration or a production security claim.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE authenticator LOGIN;
GRANT anon, authenticated TO authenticator;
CREATE SCHEMA private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;

REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE private.onboarding (user_id uuid PRIMARY KEY REFERENCES auth.users(id), ready boolean NOT NULL DEFAULT false);
REVOKE ALL ON private.onboarding FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.ready() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, private, auth
  AS $$ SELECT coalesce((SELECT ready FROM private.onboarding WHERE user_id = auth.uid()), false) $$;
REVOKE ALL ON FUNCTION private.ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.ready() TO authenticated;

CREATE TABLE public.lab_records (id integer PRIMARY KEY, owner_id uuid NOT NULL, content text NOT NULL);
ALTER TABLE public.lab_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_records FORCE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_records TO authenticated;
CREATE POLICY lab_isolation ON public.lab_records TO authenticated
  USING (owner_id = auth.uid() AND private.ready())
  WITH CHECK (owner_id = auth.uid() AND private.ready());
