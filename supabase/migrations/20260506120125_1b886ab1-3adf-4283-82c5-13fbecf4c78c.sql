
-- Force password change on first login
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Update handle_new_user to mark new accounts as needing password change
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
  INSERT INTO public.profiles (id, full_name, must_change_password)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), true);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');

  IF NEW.email IS NOT NULL THEN
    UPDATE public.athletes
    SET user_id = NEW.id
    WHERE user_id IS NULL
      AND email IS NOT NULL
      AND lower(email) = lower(NEW.email);

    IF NEW.email LIKE '%@phone.beachclub' THEN
      _email_local := split_part(NEW.email, '@', 1);
      UPDATE public.athletes
      SET user_id = NEW.id
      WHERE user_id IS NULL
        AND public.normalize_phone(phone) = _email_local;
    END IF;
  END IF;

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

-- Mark all existing non-admin profiles as needing password change (they still use default)
UPDATE public.profiles p
SET must_change_password = true
WHERE NOT public.has_role(p.id, 'admin');
