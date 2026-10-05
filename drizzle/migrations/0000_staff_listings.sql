CREATE TABLE public.staff_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  title text,
  department text,
  bio text,
  photo_url text,
  office_location text,
  classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id, full_name, title, department, bio, photo_url, office_location, user_id) ON public.staff_listings TO authenticated;
GRANT ALL ON public.staff_listings TO service_role;
ALTER TABLE public.staff_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in reads staff listings" ON public.staff_listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages staff listings" ON public.staff_listings FOR ALL TO authenticated
  USING (public.current_role_is(ARRAY['administrator'::public.app_role]))
  WITH CHECK (public.current_role_is(ARRAY['administrator'::public.app_role]));
GRANT INSERT, UPDATE, DELETE, SELECT ON public.staff_listings TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  requested text := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  reg text := upper(trim(NEW.raw_user_meta_data->>'reg_number'));
  full_name text := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  resolved public.app_role;
  listing public.staff_listings%ROWTYPE;
  sem uuid;
  c jsonb;
BEGIN
  IF requested = 'administrator' THEN
    RAISE EXCEPTION 'Administrator accounts cannot be created through sign-up.';
  END IF;
  IF requested = 'student' THEN
    IF reg IS NULL OR reg !~ '^LAW/M/[0-9]{1,6}/(0[1-9]|1[0-2])/[0-9]{2}$' THEN
      RAISE EXCEPTION 'Use the format LAW/M/REG NO/MONTH/YEAR, e.g. LAW/M/1178/05/26.';
    END IF;
    resolved := 'student';
    INSERT INTO public.profiles (id, full_name, reg_number, email) VALUES (NEW.id, full_name, reg, NEW.email);
  ELSIF requested IN ('lecturer','dean','it_support') THEN
    IF NEW.email IS NULL OR lower(NEW.email) NOT LIKE '%@kabarak.ac.ke' THEN
      RAISE EXCEPTION 'Staff accounts require a @kabarak.ac.ke university email.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.approved_staff s
      WHERE lower(s.email) = lower(NEW.email) AND s.role::text = requested) THEN
      RAISE EXCEPTION 'This email is not on the approved list for that kind of account.';
    END IF;
    resolved := requested::public.app_role;
    SELECT * INTO listing FROM public.staff_listings WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;
    IF listing.id IS NOT NULL THEN
      INSERT INTO public.profiles (id, full_name, email, title, department, bio, photo_url, office_location)
      VALUES (NEW.id, COALESCE(NULLIF(full_name, ''), listing.full_name), NEW.email, listing.title,
              listing.department, listing.bio, listing.photo_url, listing.office_location);
      UPDATE public.staff_listings SET user_id = NEW.id WHERE id = listing.id;
    ELSE
      INSERT INTO public.profiles (id, full_name, email) VALUES (NEW.id, full_name, NEW.email);
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown account type.';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, resolved);
  IF listing.id IS NOT NULL AND resolved = 'lecturer' THEN
    SELECT id INTO sem FROM public.semesters WHERE is_active ORDER BY start_date DESC LIMIT 1;
    IF sem IS NOT NULL THEN
      FOR c IN SELECT * FROM jsonb_array_elements(listing.classes) LOOP
        INSERT INTO public.timetable_slots (semester_id, lecturer_id, unit_code, unit_name, year_group, day_of_week, block)
        VALUES (sem, NEW.id, c->>'unit_code', c->>'unit_name', (c->>'year_group')::int, (c->>'day_of_week')::int, (c->>'block')::public.time_block);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE POLICY "staff photos public read" ON storage.objects FOR SELECT USING (bucket_id = 'staff-photos');
CREATE POLICY "lecturer uploads own photo" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'staff-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "lecturer updates own photo" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'staff-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "lecturer deletes own photo" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'staff-photos' AND (storage.foldername(name))[1] = auth.uid()::text);