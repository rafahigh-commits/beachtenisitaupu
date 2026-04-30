-- 1. Update handle_new_user to also link athletes by email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');

  -- Auto-link athlete record if email matches
  UPDATE public.athletes
  SET user_id = NEW.id
  WHERE user_id IS NULL
    AND email IS NOT NULL
    AND lower(email) = lower(NEW.email);

  RETURN NEW;
END;
$function$;

-- 2. One-shot backfill of existing unlinked athletes
UPDATE public.athletes a
SET user_id = u.id
FROM auth.users u
WHERE a.user_id IS NULL
  AND a.email IS NOT NULL
  AND lower(a.email) = lower(u.email);

-- 3. Admin RPC to find a user id by email
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT id INTO _uid
  FROM auth.users
  WHERE lower(email) = lower(_email)
  LIMIT 1;

  RETURN _uid;
END;
$function$;