CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  requested text := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  reg text := upper(trim(NEW.raw_user_meta_data->>'reg_number'));
  full_name text := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  resolved public.app_role;
BEGIN
  IF requested = 'administrator' THEN
    RAISE EXCEPTION 'Administrator accounts cannot be created through sign-up.';
  END IF;
  IF requested = 'student' THEN
    IF reg IS NULL OR reg !~ '^LAW/M/[0-9]{1,6}/(0[1-9]|1[0-2])/[0-9]{2}$' THEN
      RAISE EXCEPTION 'Use the format LAW/M/REG NO/MONTH/YEAR, e.g. LAW/M/1178/05/26.';
    END IF;
    resolved := 'student';
    INSERT INTO public.profiles (id, full_name, reg_number, email)
    VALUES (NEW.id, full_name, reg, NEW.email);
  ELSIF requested IN ('lecturer','dean','it_support') THEN
    IF NEW.email IS NULL OR lower(NEW.email) NOT LIKE '%@kabu.test' THEN
      RAISE EXCEPTION 'Staff accounts require the approved fictional @kabu.test university email domain.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.approved_staff s
      WHERE lower(s.email) = lower(NEW.email) AND s.role::text = requested) THEN
      RAISE EXCEPTION 'This email is not on the approved list for that kind of account.';
    END IF;
    resolved := requested::public.app_role;
    INSERT INTO public.profiles (id, full_name, email) VALUES (NEW.id, full_name, NEW.email);
  ELSE
    RAISE EXCEPTION 'Unknown account type.';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, resolved);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;