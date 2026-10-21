-- The approved lists are the source of truth for every account's name.
--
--   * Editing a name in the admin area (or approving one) instantly updates
--     that person's profile — no round-trip to the Supabase dashboard.
--   * New logins (Create login or manual) take the name from the approved
--     list first, then any typed name, then the email prefix.
--   * One-off catch-up: pushes names already on the lists onto existing
--     accounts that were created before names existed.

ALTER TABLE public.approved_staff ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.approved_students ADD COLUMN IF NOT EXISTS full_name text;

-- Catch up existing accounts.
UPDATE public.profiles p
SET full_name = a.full_name
FROM public.approved_staff a
WHERE lower(p.email) = lower(a.email)
  AND COALESCE(a.full_name, '') <> ''
  AND COALESCE(NULLIF(p.full_name, ''), '') IS DISTINCT FROM a.full_name;

UPDATE public.profiles p
SET full_name = s.full_name
FROM public.approved_students s
WHERE lower(p.email) = lower(s.email)
  AND COALESCE(s.full_name, '') <> ''
  AND COALESCE(NULLIF(p.full_name, ''), '') IS DISTINCT FROM s.full_name;

-- Keep-in-sync: approve/rename on a list -> profile follows immediately.
CREATE OR REPLACE FUNCTION public.sync_approved_name()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  tgt uuid;
BEGIN
  IF NEW.full_name IS NULL OR trim(NEW.full_name) = '' THEN
    RETURN NEW;
  END IF;
  SELECT id INTO tgt FROM public.profiles WHERE lower(email) = lower(NEW.email);
  IF tgt IS NOT NULL THEN
    UPDATE public.profiles SET full_name = trim(NEW.full_name) WHERE id = tgt;
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

-- New logins: approved-list name wins over the metadata name.
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
      VALUES (NEW.id, COALESCE(NULLIF(approved_name, ''), NULLIF(typed_name, ''), listing.full_name),
              NEW.email, listing.title, listing.department, listing.bio, listing.photo_url, listing.office_location);
      UPDATE public.staff_listings SET user_id = NEW.id WHERE id = listing.id;
    ELSE
      INSERT INTO public.profiles (id, full_name, email)
      VALUES (NEW.id, COALESCE(NULLIF(approved_name, ''), NULLIF(typed_name, ''), split_part(addr, '@', 1)), NEW.email);
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

  ELSE
    SELECT s.full_name INTO approved_name
    FROM public.approved_students s
    WHERE lower(s.email) = addr
    LIMIT 1;

    IF approved_name IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.approved_students WHERE lower(email) = addr
    ) THEN
      RAISE EXCEPTION 'This email is not on an approved list.';
    END IF;

    -- Student: approved-list name first, then any name typed at sign-up,
    -- then the email prefix.
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id,
            COALESCE(NULLIF(trim(COALESCE(approved_name, '')), ''), NULLIF(typed_name, ''),
                     split_part(addr, '@', 1)),
            NEW.email);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
