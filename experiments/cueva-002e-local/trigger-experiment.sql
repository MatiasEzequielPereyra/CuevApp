-- REJECTED: reproduces the privilege-boundary failure, never deploy.
CREATE FUNCTION private.observe_first_password() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, private
  AS $$ BEGIN
    IF OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password AND coalesce(NEW.encrypted_password, '') <> ''
      AND NEW.email_confirmed_at IS NOT NULL THEN
      UPDATE private.onboarding SET ready = true WHERE user_id = NEW.id AND ready = false;
    END IF;
    RETURN NEW;
  END $$;
REVOKE ALL ON FUNCTION private.observe_first_password() FROM PUBLIC;
CREATE TRIGGER cueva_experiment_first_password AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.observe_first_password();
