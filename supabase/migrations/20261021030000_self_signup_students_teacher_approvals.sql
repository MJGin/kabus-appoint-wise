-- Self sign-up: students join instantly, teaching logins wait for the
-- Administrator.
--
-- From now on the app's Create-account page works in two ways:
--   * Student: email, name and password -> account created right away.
--   * Teacher: email and name -> an application that the School
--     Administrator sees in the admin panel and can Approve or Dismiss.
--
-- Dean, IT Support and Administrator logins remain created only by the
-- School Administrator (Create login), never by self sign-up. A self
-- sign-up that claims an approved staff email is refused too, so nobody
-- can claim someone else's staff account with their own password.

-- ========== 1. Teacher applications ==========
CREATE TABLE IF NOT EXISTS public.teacher_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_requests_email_key
  ON public.teacher_requests (lower(email));

-- Keep applications tidy: one email, lowercase; a real name is required.
CREATE OR REPLACE FUNCTION public.normalize_teacher_request()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  NEW.email := lower(trim(NEW.email));
  NEW.full_name := trim(NEW.full_name);
  IF NEW.email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'That is not a valid email address.';
  END IF;
  IF length(NEW.full_name) < 2 THEN
    RAISE EXCEPTION 'A full name is required.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS teacher_requests_normalize ON public.teacher_requests;
CREATE TRIGGER teacher_requests_normalize
  BEFORE INSERT OR UPDATE ON public.teacher_requests
  FOR EACH ROW EXECUTE FUNCTION public.normalize_teacher_request();

ALTER TABLE public.teacher_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (even signed out) may apply for a teaching login.
DROP POLICY IF EXISTS "anyone may apply" ON public.teacher_requests;
CREATE POLICY "anyone may apply" ON public.teacher_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only the Administrator sees and decides the applications.
DROP POLICY IF EXISTS "admin sees teacher applications" ON public.teacher_requests;
CREATE POLICY "admin sees teacher applications" ON public.teacher_requests
  FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['administrator']::public.app_role[]));

DROP POLICY IF EXISTS "admin decides teacher applications" ON public.teacher_requests;
CREATE POLICY "admin decides teacher applications" ON public.teacher_requests
  FOR DELETE TO authenticated
  USING (public.current_role_is(ARRAY['administrator']::public.app_role[]));

GRANT INSERT ON public.teacher_requests TO anon;
GRANT SELECT, INSERT, DELETE ON public.teacher_requests TO authenticated;
GRANT ALL ON public.teacher_requests TO service_role;

-- ========== 2. The sign-up rule, rewritten ==========
-- * An approved staff email only ever becomes a login when the School
--   Administrator created it (Create login marks the account
--   minted_by_admin). Any other attempt is refused.
-- * An approved student email keeps its approved-list name.
-- * Any other email declaring itself a student joins instantly.
-- * Anything else (including an unapproved teacher attempt straight at the
--   signup endpoint) is refused: they must apply from the Create account
--   page and wait for the Administrator.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  addr text := lower(trim(COALESCE(NEW.email, '')));
  typed_name text := trim(COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  approved_name text;
  staff_role public.app_role;
  listing RECORD;
  has_listing boolean := false;
  sem uuid;
  c jsonb;
BEGIN
  IF addr = '' THEN
    RAISE EXCEPTION 'An email address is required.';
  END IF;

  SELECT s.role, s.full_name INTO staff_role, approved_name
  FROM public.approved_staff s
  WHERE lower(s.email) = addr
  LIMIT 1;

  IF staff_role IS NOT NULL THEN
    -- Staff: lecturer, dean or IT support, exactly as the approved list says.
    -- Only the Administrator's own creation path (Create login) is allowed to
    -- mint these, so nobody can claim a staff account with their own password.
    IF COALESCE(NEW.raw_user_meta_data->>'minted_by_admin', '') <> 'true' THEN
      RAISE EXCEPTION 'Staff logins are created only by the School Administrator. Use the Create account page to apply for a teaching login.';
    END IF;

    SELECT * INTO listing
    FROM public.staff_listings
    WHERE lower(email) = addr AND user_id IS NULL
    LIMIT 1;
    has_listing := FOUND;

    IF has_listing THEN
      INSERT INTO public.profiles (id, full_name, email, title, department, bio, photo_url, office_location)
      VALUES (NEW.id,
              COALESCE(NULLIF(trim(COALESCE(approved_name, '')), ''), NULLIF(typed_name, ''),
                       NULLIF(trim(COALESCE(listing.full_name, '')), ''), split_part(addr, '@', 1)),
              NEW.email, listing.title, listing.department, listing.bio, listing.photo_url, listing.office_location);
      UPDATE public.staff_listings SET user_id = NEW.id WHERE id = listing.id;
    ELSE
      INSERT INTO public.profiles (id, full_name, email)
      VALUES (NEW.id,
              COALESCE(NULLIF(trim(COALESCE(approved_name, '')), ''), NULLIF(typed_name, ''), split_part(addr, '@', 1)),
              NEW.email);
    END IF;

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, staff_role);

    IF has_listing AND staff_role = 'lecturer' THEN
      SELECT id INTO sem FROM public.semesters WHERE is_active ORDER BY start_date DESC LIMIT 1;
      IF sem IS NOT NULL THEN
        FOR c IN SELECT * FROM jsonb_array_elements(CASE WHEN jsonb_typeof(listing.classes) = 'array' THEN listing.classes ELSE '[]'::jsonb END) LOOP
          INSERT INTO public.timetable_slots
            (semester_id, lecturer_id, unit_code, unit_name, year_group, day_of_week, block)
          VALUES
            (sem, NEW.id, c->>'unit_code', c->>'unit_name', (c->>'year_group')::int,
             (c->>'day_of_week')::int, (c->>'block')::public.time_block);
        END LOOP;
      END IF;

      -- Students may already have asked for this lecturer's free times: they now belong to the real account.
      -- (Only runs once the flexible-booking columns exist.)
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'listing_id') THEN
        EXECUTE 'UPDATE public.appointments SET lecturer_id = $1, listing_id = NULL WHERE listing_id = $2'
          USING NEW.id, listing.id;
        EXECUTE 'INSERT INTO public.notifications (user_id, type, title, body)
                 SELECT $1, ''appointment_requested'', ''New appointment request'',
                        p.full_name || '' requested an appointment for '' ||
                        private.appt_when(a.appt_date, a.block, a.start_time, a.duration_minutes)
                 FROM public.appointments a
                 JOIN public.profiles p ON p.id = a.student_id
                 WHERE a.lecturer_id = $1 AND a.status = ''pending'''
          USING NEW.id;
      END IF;
    END IF;

  ELSE
    SELECT s.full_name INTO approved_name
    FROM public.approved_students s
    WHERE lower(s.email) = addr
    LIMIT 1;

    IF FOUND THEN
      -- Student: approved-list name first, then any name typed at sign-up, then the email prefix.
      INSERT INTO public.profiles (id, full_name, email)
      VALUES (NEW.id,
              COALESCE(NULLIF(trim(COALESCE(approved_name, '')), ''), NULLIF(typed_name, ''), split_part(addr, '@', 1)),
              NEW.email);
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
    ELSIF NEW.raw_user_meta_data->>'requested_role' = 'student' THEN
      -- Instant student self-registration with the name they typed.
      INSERT INTO public.profiles (id, full_name, email)
      VALUES (NEW.id,
              COALESCE(NULLIF(typed_name, ''), split_part(addr, '@', 1)),
              NEW.email);
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
    ELSE
      RAISE EXCEPTION 'This email is not approved. Students join instantly from the Create account page; teaching logins need the Administrator to approve an application.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
