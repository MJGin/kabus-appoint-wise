-- Names come from the approved lists.
--
-- The Supabase dashboard "Add user" screen only asks for an email (and a password); there is nowhere in it to
-- type a name. The person's name therefore lives on the APPROVED LIST in the admin area (name + email + role,
-- then Approve), and the database copies it onto the account:
--
--   * a new account (made from the Supabase dashboard OR the "Create login" button) takes the approved-list name;
--     if the list has none, any name typed at sign-up, then the staff listing's name, then the email prefix;
--   * renaming someone on the approved list renames their account straight away (and their staff listing,
--     while they have not signed in yet);
--   * accounts that were created before this and still show only their email prefix get their name now.
--
-- This also puts back what an earlier version of handle_new_user dropped: when a lecturer signs in for the first
-- time, booking requests students made to their staff listing are handed to their real account and they are told.
--
-- Safe to run more than once, and whether or not the earlier name migrations (20261016020000, 20261016030000)
-- were applied.

ALTER TABLE public.approved_staff ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.approved_students ADD COLUMN IF NOT EXISTS full_name text;

-- ========== RENAME ON THE LIST -> RENAME THE ACCOUNT ==========
CREATE OR REPLACE FUNCTION public.sync_approved_name()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  clean text := trim(COALESCE(NEW.full_name, ''));
BEGIN
  IF clean = '' THEN
    RETURN NEW;
  END IF;
  UPDATE public.profiles SET full_name = clean WHERE lower(email) = lower(NEW.email);
  IF TG_TABLE_NAME = 'approved_staff' THEN
    UPDATE public.staff_listings SET full_name = clean
    WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_approved_name() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS approved_staff_name_sync ON public.approved_staff;
CREATE TRIGGER approved_staff_name_sync
  AFTER INSERT OR UPDATE OF full_name ON public.approved_staff
  FOR EACH ROW EXECUTE FUNCTION public.sync_approved_name();

DROP TRIGGER IF EXISTS approved_students_name_sync ON public.approved_students;
CREATE TRIGGER approved_students_name_sync
  AFTER INSERT OR UPDATE OF full_name ON public.approved_students
  FOR EACH ROW EXECUTE FUNCTION public.sync_approved_name();

-- ========== NEW ACCOUNTS ==========
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

    IF NOT FOUND THEN
      RAISE EXCEPTION 'This email is not on an approved list.';
    END IF;

    -- Student: approved-list name first, then any name typed at sign-up, then the email prefix.
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id,
            COALESCE(NULLIF(trim(COALESCE(approved_name, '')), ''), NULLIF(typed_name, ''), split_part(addr, '@', 1)),
            NEW.email);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ========== CATCH UP ACCOUNTS THAT ARE STILL SHOWING THEIR EMAIL PREFIX ==========
-- Only accounts with no name, or just the email prefix, are touched: a name someone chose for themselves stays.
UPDATE public.profiles p
SET full_name = trim(a.full_name)
FROM public.approved_staff a
WHERE lower(p.email) = lower(a.email)
  AND trim(COALESCE(a.full_name, '')) <> ''
  AND (trim(COALESCE(p.full_name, '')) = '' OR lower(p.full_name) = lower(split_part(p.email, '@', 1)));

UPDATE public.profiles p
SET full_name = trim(s.full_name)
FROM public.approved_students s
WHERE lower(p.email) = lower(s.email)
  AND trim(COALESCE(s.full_name, '')) <> ''
  AND (trim(COALESCE(p.full_name, '')) = '' OR lower(p.full_name) = lower(split_part(p.email, '@', 1)));

-- A staff listing that already carries a proper name fills the same gap.
UPDATE public.profiles p
SET full_name = trim(l.full_name)
FROM public.staff_listings l
WHERE lower(p.email) = lower(l.email)
  AND trim(COALESCE(l.full_name, '')) <> ''
  AND (trim(COALESCE(p.full_name, '')) = '' OR lower(p.full_name) = lower(split_part(p.email, '@', 1)));
