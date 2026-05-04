CREATE OR REPLACE FUNCTION public.prevent_duplicate_athlete_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _phone text;
  _email text;
  _existing_name text;
BEGIN
  _phone := public.normalize_phone(NEW.phone);
  _email := lower(nullif(btrim(NEW.email), ''));

  IF _phone IS NOT NULL AND _phone <> '' THEN
    SELECT full_name INTO _existing_name
    FROM public.athletes
    WHERE id <> COALESCE(NEW.id, gen_random_uuid())
      AND public.normalize_phone(phone) = _phone
    LIMIT 1;

    IF _existing_name IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um atleta cadastrado com este telefone: %', _existing_name;
    END IF;
  END IF;

  IF _email IS NOT NULL THEN
    SELECT full_name INTO _existing_name
    FROM public.athletes
    WHERE id <> COALESCE(NEW.id, gen_random_uuid())
      AND lower(nullif(btrim(email), '')) = _email
    LIMIT 1;

    IF _existing_name IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um atleta cadastrado com este email: %', _existing_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_athlete_contact_trigger ON public.athletes;
CREATE TRIGGER prevent_duplicate_athlete_contact_trigger
BEFORE INSERT OR UPDATE OF phone, email ON public.athletes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_athlete_contact();