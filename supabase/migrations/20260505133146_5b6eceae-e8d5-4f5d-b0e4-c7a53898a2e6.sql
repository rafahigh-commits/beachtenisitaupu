CREATE OR REPLACE FUNCTION public.prevent_duplicate_athlete_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _phone text;
  _email text;
  _existing_name text;
  _phone_changed boolean;
  _email_changed boolean;
BEGIN
  _phone := public.normalize_phone(NEW.phone);
  _email := lower(nullif(btrim(NEW.email), ''));

  IF TG_OP = 'INSERT' THEN
    _phone_changed := true;
    _email_changed := true;
  ELSE
    _phone_changed := public.normalize_phone(OLD.phone) IS DISTINCT FROM _phone;
    _email_changed := lower(nullif(btrim(OLD.email), '')) IS DISTINCT FROM _email;
  END IF;

  IF _phone_changed AND _phone IS NOT NULL AND _phone <> '' THEN
    SELECT full_name INTO _existing_name
    FROM public.athletes
    WHERE id <> COALESCE(NEW.id, gen_random_uuid())
      AND public.normalize_phone(phone) = _phone
    LIMIT 1;
    IF _existing_name IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um atleta cadastrado com este telefone: %', _existing_name;
    END IF;
  END IF;

  IF _email_changed AND _email IS NOT NULL THEN
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
$function$;