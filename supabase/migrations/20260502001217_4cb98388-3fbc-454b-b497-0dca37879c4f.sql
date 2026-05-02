
-- Normaliza telefone para só dígitos
CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _phone IS NULL THEN NULL
    ELSE regexp_replace(_phone, '\D', '', 'g')
  END
$$;

-- Atualiza handle_new_user para vincular também por telefone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _phone_digits text;
  _email_local text;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');

  -- Vincular por email (caso ainda exista)
  IF NEW.email IS NOT NULL THEN
    UPDATE public.athletes
    SET user_id = NEW.id
    WHERE user_id IS NULL
      AND email IS NOT NULL
      AND lower(email) = lower(NEW.email);

    -- Email sintético no formato <digits>@phone.beachclub → vincular pelo telefone
    IF NEW.email LIKE '%@phone.beachclub' THEN
      _email_local := split_part(NEW.email, '@', 1);
      UPDATE public.athletes
      SET user_id = NEW.id
      WHERE user_id IS NULL
        AND public.normalize_phone(phone) = _email_local;
    END IF;
  END IF;

  -- Também vincular pelo telefone do auth.users (caso seja preenchido)
  IF NEW.phone IS NOT NULL THEN
    _phone_digits := public.normalize_phone(NEW.phone);
    UPDATE public.athletes
    SET user_id = NEW.id
    WHERE user_id IS NULL
      AND public.normalize_phone(phone) = _phone_digits;
  END IF;

  RETURN NEW;
END;
$function$;

-- Garantir trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC para admins descobrirem user_id por telefone
CREATE OR REPLACE FUNCTION public.find_user_by_phone(_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _digits text;
  _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  _digits := public.normalize_phone(_phone);
  IF _digits IS NULL OR length(_digits) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _uid
  FROM auth.users
  WHERE email = _digits || '@phone.beachclub'
  LIMIT 1;

  RETURN _uid;
END;
$$;
