-- Flexible booking
--
--   1. A student can book any FREE time of a lecturer (the green times), for as long as they need
--      inside that block: a start time plus a length of 15 minutes up to 3 hours.
--   2. Lecturers who have not signed in yet (staff_listings) can be booked too. The request waits
--      against the listing and is handed to the lecturer the moment they activate their account.
--   3. The old rule that a lecturer must be TEACHING in a block before it could be booked is gone.
--      It contradicted the screen, which offers the free time AFTER a lecturer's classes, so every
--      booking of a green time was refused by the database.
--
-- Existing appointments keep working: a row with no start time simply means "the whole block".

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'staff_listings' AND column_name = 'id') IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION 'staff_listings.id is expected to be a uuid.';
  END IF;
END $$;

-- ========== COLUMNS ==========
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.staff_listings(id) ON DELETE CASCADE;

ALTER TABLE public.appointments ALTER COLUMN lecturer_id DROP NOT NULL;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_target_chk;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_target_chk CHECK (lecturer_id IS NOT NULL OR listing_id IS NOT NULL);

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_duration_chk;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_duration_chk
  CHECK (duration_minutes IS NULL OR (duration_minutes BETWEEN 15 AND 180 AND duration_minutes % 15 = 0));

CREATE INDEX IF NOT EXISTS appointments_listing_idx ON public.appointments (listing_id) WHERE listing_id IS NOT NULL;

-- ========== SMALL HELPERS ==========
CREATE OR REPLACE FUNCTION private.block_index(_block public.time_block)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _block WHEN 'block_1' THEN 0 WHEN 'block_2' THEN 1 ELSE 2 END;
$$;

CREATE OR REPLACE FUNCTION private.block_start(_block public.time_block)
RETURNS time LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _block WHEN 'block_1' THEN time '08:00' WHEN 'block_2' THEN time '11:00' ELSE time '14:00' END;
$$;

CREATE OR REPLACE FUNCTION private.appt_when(_date date, _block public.time_block, _start time, _minutes integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(_date, 'Mon DD, YYYY') || ' ' ||
    CASE
      WHEN _start IS NULL THEN _block::text
      ELSE to_char(_start, 'HH24:MI') || '-' || to_char(_start + make_interval(mins => COALESCE(_minutes, 180)), 'HH24:MI')
    END;
$$;

-- ========== WHAT COUNTS AS A FREE (GREEN) TIME ==========
-- Mirrors the student screen exactly: a weekday inside the active semester, not Chapel, and either
-- later in the day than the lecturer's last class, or a make-up session / exam slot they added.
-- For a lecturer who has not signed in yet, the classes come from their staff listing.
CREATE OR REPLACE FUNCTION private.slot_is_free(_lecturer uuid, _listing uuid, _date date, _block public.time_block)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sem RECORD;
  dow integer := EXTRACT(ISODOW FROM _date)::integer;
  blk integer := private.block_index(_block);
  last_class integer := -1;
BEGIN
  IF dow NOT BETWEEN 1 AND 5 THEN RETURN false; END IF;
  IF public.is_chapel(_date, _block) THEN RETURN false; END IF;

  SELECT * INTO sem FROM public.semesters WHERE is_active LIMIT 1;
  IF FOUND AND (_date < sem.start_date OR _date > sem.end_date) THEN RETURN false; END IF;

  IF _lecturer IS NOT NULL THEN
    SELECT COALESCE(MAX(private.block_index(t.block)), -1) INTO last_class
    FROM public.timetable_slots t
    WHERE t.lecturer_id = _lecturer AND t.day_of_week = dow;

    IF last_class >= 0 AND blk > last_class THEN RETURN true; END IF;
    IF EXISTS (SELECT 1 FROM public.makeup_sessions m
               WHERE m.lecturer_id = _lecturer AND m.session_date = _date AND m.block = _block) THEN RETURN true; END IF;
    IF EXISTS (SELECT 1 FROM public.exam_slots e
               WHERE e.lecturer_id = _lecturer AND e.exam_date = _date AND e.block = _block) THEN RETURN true; END IF;
    RETURN false;
  END IF;

  SELECT COALESCE(MAX(private.block_index((c->>'block')::public.time_block)), -1) INTO last_class
  FROM public.staff_listings l,
       jsonb_array_elements(CASE WHEN jsonb_typeof(l.classes) = 'array' THEN l.classes ELSE '[]'::jsonb END) c
  WHERE l.id = _listing AND (c->>'day_of_week')::integer = dow;

  RETURN last_class >= 0 AND blk > last_class;
END;
$$;

-- ========== BOOKING ==========
CREATE OR REPLACE FUNCTION private.book_appointment_slot(
  _lecturer_id uuid,
  _listing_id uuid,
  _appt_date date,
  _block public.time_block,
  _start_time time,
  _duration_minutes integer,
  _reason text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  new_id uuid;
  target_lecturer uuid := _lecturer_id;
  target_listing uuid := _listing_id;
  listed RECORD;
  block_begin time := private.block_start(_block);
  local_now timestamp := (now() AT TIME ZONE 'Africa/Nairobi');
BEGIN
  IF NOT private.has_role(auth.uid(), 'student') THEN
    RAISE EXCEPTION 'Only students can request appointments.';
  END IF;
  IF char_length(trim(COALESCE(_reason, ''))) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'Provide a reason between 5 and 1000 characters.';
  END IF;
  IF (_lecturer_id IS NULL) = (_listing_id IS NULL) THEN
    RAISE EXCEPTION 'Choose a lecturer to book.';
  END IF;

  IF _listing_id IS NOT NULL THEN
    SELECT id, user_id INTO listed FROM public.staff_listings WHERE id = _listing_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'That lecturer could not be found.'; END IF;
    IF listed.user_id IS NOT NULL THEN
      -- They activated in the meantime: book the real account instead.
      target_lecturer := listed.user_id;
      target_listing := NULL;
    END IF;
  END IF;

  IF target_lecturer IS NOT NULL AND NOT private.has_role(target_lecturer, 'lecturer') THEN
    RAISE EXCEPTION 'Appointments can only be requested with a lecturer.';
  END IF;

  IF _duration_minutes IS NULL OR _duration_minutes NOT BETWEEN 15 AND 180 OR _duration_minutes % 15 <> 0 THEN
    RAISE EXCEPTION 'Choose a length between 15 minutes and 3 hours, in steps of 15 minutes.';
  END IF;
  IF _start_time IS NULL OR EXTRACT(MINUTE FROM _start_time)::integer % 15 <> 0 OR EXTRACT(SECOND FROM _start_time) <> 0 THEN
    RAISE EXCEPTION 'Choose a start time on a quarter of an hour.';
  END IF;
  IF _start_time < block_begin OR (_start_time - block_begin) + make_interval(mins => _duration_minutes) > interval '3 hours' THEN
    RAISE EXCEPTION 'The chosen time does not fit inside that free period.';
  END IF;

  IF (_appt_date + _start_time) <= local_now THEN
    RAISE EXCEPTION 'That time has already passed.';
  END IF;
  IF NOT private.slot_is_free(target_lecturer, target_listing, _appt_date, _block) THEN
    RAISE EXCEPTION 'That time is not free for booking.';
  END IF;

  -- Two students pressing Book on the same time at once must not both succeed.
  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(target_lecturer::text, target_listing::text) || _appt_date::text));

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.appt_date = _appt_date
      AND a.block = _block
      AND a.status IN ('pending', 'accepted')
      AND ((target_lecturer IS NOT NULL AND a.lecturer_id = target_lecturer)
        OR (target_listing IS NOT NULL AND a.listing_id = target_listing))
      AND COALESCE(a.start_time, private.block_start(a.block)) < _start_time + make_interval(mins => _duration_minutes)
      AND _start_time < COALESCE(a.start_time, private.block_start(a.block)) + make_interval(mins => COALESCE(a.duration_minutes, 180))
  ) THEN
    RAISE EXCEPTION 'That appointment time is no longer available.';
  END IF;

  INSERT INTO public.appointments
    (student_id, lecturer_id, listing_id, appt_date, block, start_time, duration_minutes, status)
  VALUES
    (auth.uid(), target_lecturer, target_listing, _appt_date, _block, _start_time, _duration_minutes, 'pending')
  RETURNING id INTO new_id;

  INSERT INTO public.appointment_reasons (appointment_id, reason) VALUES (new_id, trim(_reason));
  RETURN new_id;
END;
$$;

-- The original whole-block function stays, so requests queued offline by an older copy of the app still go through.
CREATE OR REPLACE FUNCTION private.book_appointment(_lecturer_id uuid, _appt_date date, _block public.time_block, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  RETURN private.book_appointment_slot(_lecturer_id, NULL, _appt_date, _block, private.block_start(_block), 180, _reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.book_appointment_slot(
  _lecturer_id uuid,
  _listing_id uuid,
  _appt_date date,
  _block public.time_block,
  _start_time time,
  _duration_minutes integer,
  _reason text
)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = private AS $$
  SELECT private.book_appointment_slot(_lecturer_id, _listing_id, _appt_date, _block, _start_time, _duration_minutes, _reason);
$$;

-- ========== WHAT IS ALREADY TAKEN (times only, never who booked) ==========
CREATE OR REPLACE FUNCTION private.busy_times(_lecturer_id uuid, _listing_id uuid)
RETURNS TABLE (appt_date date, block public.time_block, start_time time, duration_minutes integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT a.appt_date, a.block,
         COALESCE(a.start_time, private.block_start(a.block)),
         COALESCE(a.duration_minutes, 180)
  FROM public.appointments a
  WHERE auth.uid() IS NOT NULL
    AND a.status IN ('pending', 'accepted')
    AND a.appt_date >= (now() AT TIME ZONE 'Africa/Nairobi')::date
    AND ((_lecturer_id IS NOT NULL AND a.lecturer_id = _lecturer_id)
      OR (_listing_id IS NOT NULL AND a.listing_id = _listing_id));
$$;

CREATE OR REPLACE FUNCTION public.busy_times(_lecturer_id uuid DEFAULT NULL, _listing_id uuid DEFAULT NULL)
RETURNS TABLE (appt_date date, block public.time_block, start_time time, duration_minutes integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = private AS $$
  SELECT * FROM private.busy_times(_lecturer_id, _listing_id);
$$;

-- ========== RULES TRIGGER ==========
-- Chapel stays protected. Whether a time is free is now decided when the request is made
-- (private.slot_is_free), not on every later change such as accepting or declining it.
CREATE OR REPLACE FUNCTION public.enforce_appointment_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('pending', 'accepted') THEN
    IF public.is_chapel(NEW.appt_date, NEW.block) THEN
      RAISE EXCEPTION 'Wednesday 11:00-14:00 is Chapel; no appointment may be placed there.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ========== NOTIFICATIONS ==========
-- A request to a lecturer who has not signed in yet has nobody to notify; that happens on activation instead.
CREATE OR REPLACE FUNCTION public.notify_appointment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  student RECORD;
  lecturer RECORD;
  when_text text := private.appt_when(NEW.appt_date, NEW.block, NEW.start_time, NEW.duration_minutes);
BEGIN
  SELECT full_name INTO student FROM public.profiles WHERE id = NEW.student_id;
  SELECT full_name INTO lecturer FROM public.profiles WHERE id = NEW.lecturer_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.lecturer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body)
      VALUES (NEW.lecturer_id, 'appointment_requested', 'New appointment request',
              student.full_name || ' requested an appointment for ' || when_text);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> NEW.status THEN
      IF NEW.status = 'accepted' THEN
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (NEW.student_id, 'appointment_accepted', 'Appointment accepted',
                lecturer.full_name || ' accepted your appointment for ' || when_text);
      ELSIF NEW.status = 'declined' THEN
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (NEW.student_id, 'appointment_declined', 'Appointment declined',
                lecturer.full_name || ' declined your appointment for ' || when_text);
      ELSIF NEW.status = 'cancelled' AND NEW.lecturer_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (NEW.lecturer_id, 'appointment_cancelled', 'Appointment cancelled',
                student.full_name || ' cancelled the appointment for ' || when_text);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ========== SIGN-UP: HAND WAITING REQUESTS TO THE NEW LECTURER ==========
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

      -- Students may already have asked for this lecturer's free times: they now belong to the real account.
      UPDATE public.appointments
      SET lecturer_id = NEW.id, listing_id = NULL
      WHERE listing_id = listing.id;

      INSERT INTO public.notifications (user_id, type, title, body)
      SELECT NEW.id, 'appointment_requested', 'New appointment request',
             p.full_name || ' requested an appointment for ' ||
             private.appt_when(a.appt_date, a.block, a.start_time, a.duration_minutes)
      FROM public.appointments a
      JOIN public.profiles p ON p.id = a.student_id
      WHERE a.lecturer_id = NEW.id AND a.status = 'pending';
    END IF;

  ELSIF EXISTS (SELECT 1 FROM public.approved_students WHERE lower(email) = addr) THEN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id, COALESCE(NULLIF(typed_name, ''), split_part(addr, '@', 1)), NEW.email);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');

  ELSE
    RAISE EXCEPTION 'This email is not on an approved list.';
  END IF;

  RETURN NEW;
END;
$function$;

-- ========== PERMISSIONS ==========
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_appointment_rules() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_appointment_change() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION private.block_index(public.time_block) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.block_start(public.time_block) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.appt_when(date, public.time_block, time, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.slot_is_free(uuid, uuid, date, public.time_block) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.book_appointment_slot(uuid, uuid, date, public.time_block, time, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.busy_times(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.book_appointment_slot(uuid, uuid, date, public.time_block, time, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.busy_times(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.block_index(public.time_block) TO authenticated;
GRANT EXECUTE ON FUNCTION private.block_start(public.time_block) TO authenticated;
GRANT EXECUTE ON FUNCTION private.appt_when(date, public.time_block, time, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION private.slot_is_free(uuid, uuid, date, public.time_block) TO authenticated;
GRANT EXECUTE ON FUNCTION private.book_appointment_slot(uuid, uuid, date, public.time_block, time, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.busy_times(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_appointment_slot(uuid, uuid, date, public.time_block, time, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.busy_times(uuid, uuid) TO authenticated;
