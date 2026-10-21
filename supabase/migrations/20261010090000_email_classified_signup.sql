-- Sign-up by email only. The database, not the browser, decides what kind of account an email is.
--
--   * email on approved_staff    -> lecturer, dean or it_support (the role stored against it)
--   * email on approved_students -> student
--   * anything else              -> sign-up is refused
--
-- No sign-up path can ever produce an administrator: that account is created once, outside the app.
-- Registration numbers are no longer used. This migration only adds a table and replaces the
-- sign-up trigger function; it does not touch existing accounts.

-- ========== APPROVED STUDENTS ==========
CREATE TABLE IF NOT EXISTS public.approved_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS approved_students_email_key
  ON public.approved_students (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approved_students TO authenticated;
GRANT ALL ON public.approved_students TO service_role;
ALTER TABLE public.approved_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manages approved students" ON public.approved_students;
CREATE POLICY "admin manages approved students" ON public.approved_students
  FOR ALL TO authenticated
  USING (public.current_role_is(ARRAY['administrator']::public.app_role[]))
  WITH CHECK (public.current_role_is(ARRAY['administrator']::public.app_role[]));

DROP POLICY IF EXISTS "it reads approved students" ON public.approved_students;
CREATE POLICY "it reads approved students" ON public.approved_students
  FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['it_support']::public.app_role[]));

-- ========== SIGN-UP TRIGGER ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  addr text := lower(trim(COALESCE(NEW.email, '')));
  typed_name text := trim(COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  staff_role public.app_role;
  listing RECORD;
  has_listing boolean := false;
  sem uuid;
  c jsonb;
BEGIN
  IF addr = '' THEN
    RAISE EXCEPTION 'An email address is required.';
  END IF;

  SELECT s.role INTO staff_role
  FROM public.approved_staff s
  WHERE lower(s.email) = addr
  LIMIT 1;

  IF staff_role IS NOT NULL THEN
    -- Staff: lecturer, dean or IT support, exactly as the approved list says.
    SELECT * INTO listing
    FROM public.staff_listings
    WHERE lower(email) = addr AND user_id IS NULL
    LIMIT 1;
    has_listing := FOUND;

    IF has_listing THEN
      INSERT INTO public.profiles (id, full_name, email, title, department, bio, photo_url, office_location)
      VALUES (NEW.id, COALESCE(NULLIF(typed_name, ''), listing.full_name), NEW.email, listing.title,
              listing.department, listing.bio, listing.photo_url, listing.office_location);
      UPDATE public.staff_listings SET user_id = NEW.id WHERE id = listing.id;
    ELSE
      INSERT INTO public.profiles (id, full_name, email)
      VALUES (NEW.id, COALESCE(NULLIF(typed_name, ''), split_part(addr, '@', 1)), NEW.email);
    END IF;

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, staff_role);

    IF has_listing AND staff_role = 'lecturer' THEN
      SELECT id INTO sem FROM public.semesters WHERE is_active ORDER BY start_date DESC LIMIT 1;
      IF sem IS NOT NULL THEN
        FOR c IN SELECT * FROM jsonb_array_elements(listing.classes) LOOP
          INSERT INTO public.timetable_slots
            (semester_id, lecturer_id, unit_code, unit_name, year_group, day_of_week, block)
          VALUES
            (sem, NEW.id, c->>'unit_code', c->>'unit_name', (c->>'year_group')::int,
             (c->>'day_of_week')::int, (c->>'block')::public.time_block);
        END LOOP;
      END IF;
    END IF;

  ELSIF EXISTS (SELECT 1 FROM public.approved_students WHERE lower(email) = addr) THEN
    -- Student: any name is accepted, the email is what counts.
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id, COALESCE(NULLIF(typed_name, ''), split_part(addr, '@', 1)), NEW.email);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');

  ELSE
    RAISE EXCEPTION 'This email is not on an approved list.';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ========== APPROVED EMAILS (emails only; no passwords, no timetable) ==========
INSERT INTO public.approved_students (email) VALUES
  ('hillary.otieno@students.kabu.test'),
  ('joy.mwikali@students.kabu.test'),
  ('kevin.rotich@students.kabu.test'),
  ('leah.cheptoo@students.kabu.test'),
  ('martin.kinuthia@students.kabu.test')
ON CONFLICT DO NOTHING;

INSERT INTO public.approved_staff (email, role) VALUES
  ('peter.wafula@office.kabu.test', 'dean'),
  ('sharon.chelimo@office.kabu.test', 'it_support'),
  ('aisha.njeri@kabu.test', 'lecturer'),
  ('duncan.kiprop@kabu.test', 'lecturer'),
  ('esther.wambui@kabu.test', 'lecturer'),
  ('frank.mutiso@kabu.test', 'lecturer'),
  ('grace.achieng@kabu.test', 'lecturer')
ON CONFLICT (email) DO NOTHING;
