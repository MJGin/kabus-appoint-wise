-- ===========================================
-- COMBINED SUPABASE MIGRATIONS FOR KABUS-APPOINT-WISE
-- Generated: 2026-10-08T15:41:37.971Z
-- ===========================================

-- ===========================================
-- MIGRATION: 20260919193205_81a90124-21a1-49a7-b625-382574d8c180.sql
-- ===========================================


-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('student','lecturer','dean','administrator','it_support');
CREATE TYPE public.time_block AS ENUM ('block_1','block_2','block_3');
CREATE TYPE public.appointment_status AS ENUM ('pending','accepted','declined','cancelled');
CREATE TYPE public.log_category AS ENUM ('operational','credential');

-- ========== ROLES ==========
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_role_is(_roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles));
$$;

CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "oversight roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['administrator','it_support','dean']::public.app_role[]));

-- ========== APPROVED STAFF ALLOW LIST ==========
CREATE TABLE public.approved_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role public.app_role NOT NULL CHECK (role IN ('lecturer','dean','it_support')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approved_staff TO authenticated;
GRANT ALL ON public.approved_staff TO service_role;
ALTER TABLE public.approved_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages allow list" ON public.approved_staff FOR ALL TO authenticated
  USING (public.current_role_is(ARRAY['administrator']::public.app_role[]))
  WITH CHECK (public.current_role_is(ARRAY['administrator']::public.app_role[]));
CREATE POLICY "it reads allow list" ON public.approved_staff FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['it_support']::public.app_role[]));

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  reg_number text UNIQUE,
  email text,
  title text,
  department text,
  bio text,
  photo_url text,
  office_location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "published staff profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(id, 'lecturer'));
CREATE POLICY "oversight profile read" ON public.profiles FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['administrator','it_support','dean']::public.app_role[]));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ========== SEMESTERS ==========
CREATE TABLE public.semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  exam_start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semesters TO authenticated;
GRANT ALL ON public.semesters TO service_role;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in reads semesters" ON public.semesters FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin writes semesters" ON public.semesters FOR ALL TO authenticated
  USING (public.current_role_is(ARRAY['administrator']::public.app_role[]))
  WITH CHECK (public.current_role_is(ARRAY['administrator']::public.app_role[]));

-- ========== TIMETABLE ==========
CREATE TABLE public.timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  lecturer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_code text NOT NULL,
  unit_name text NOT NULL,
  year_group int NOT NULL CHECK (year_group BETWEEN 1 AND 6),
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  block public.time_block NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_slots TO authenticated;
GRANT ALL ON public.timetable_slots TO service_role;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in reads timetable" ON public.timetable_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin writes timetable" ON public.timetable_slots FOR ALL TO authenticated
  USING (public.current_role_is(ARRAY['administrator']::public.app_role[]))
  WITH CHECK (public.current_role_is(ARRAY['administrator']::public.app_role[]));

-- ========== MAKE-UP SESSIONS ==========
CREATE TABLE public.makeup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecturer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  block public.time_block NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lecturer_id, session_date, block)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makeup_sessions TO authenticated;
GRANT ALL ON public.makeup_sessions TO service_role;
ALTER TABLE public.makeup_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in reads makeups" ON public.makeup_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "lecturer manages own makeups" ON public.makeup_sessions FOR ALL TO authenticated
  USING (lecturer_id = auth.uid() AND public.has_role(auth.uid(),'lecturer'))
  WITH CHECK (lecturer_id = auth.uid() AND public.has_role(auth.uid(),'lecturer'));

-- ========== EXAM SLOTS ==========
CREATE TABLE public.exam_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  lecturer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_code text NOT NULL,
  unit_name text,
  exam_date date NOT NULL,
  block public.time_block NOT NULL,
  venue text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_slots TO authenticated;
GRANT ALL ON public.exam_slots TO service_role;
ALTER TABLE public.exam_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in reads exams" ON public.exam_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin writes exams" ON public.exam_slots FOR ALL TO authenticated
  USING (public.current_role_is(ARRAY['administrator']::public.app_role[]))
  WITH CHECK (public.current_role_is(ARRAY['administrator']::public.app_role[]));

-- ========== APPOINTMENTS ==========
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lecturer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appt_date date NOT NULL,
  block public.time_block NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student reads own appointments" ON public.appointments FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "lecturer reads own appointments" ON public.appointments FOR SELECT TO authenticated
  USING (lecturer_id = auth.uid());
CREATE POLICY "oversight reads appointments" ON public.appointments FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['dean','administrator']::public.app_role[]));
CREATE POLICY "student books own appointment" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.has_role(auth.uid(),'student') AND status = 'pending');
CREATE POLICY "student cancels own pending" ON public.appointments FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending')
  WITH CHECK (student_id = auth.uid() AND status = 'cancelled');
CREATE POLICY "lecturer decides own appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (lecturer_id = auth.uid() AND public.has_role(auth.uid(),'lecturer'))
  WITH CHECK (lecturer_id = auth.uid());

-- ========== PRIVATE REASONS ==========
CREATE TABLE public.appointment_reasons (
  appointment_id uuid PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.appointment_reasons TO authenticated;
ALTER TABLE public.appointment_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "only the two parties read the reason" ON public.appointment_reasons FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_id AND (a.student_id = auth.uid() OR a.lecturer_id = auth.uid())
  ));
CREATE POLICY "student writes own reason" ON public.appointment_reasons FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_id AND a.student_id = auth.uid()
  ));

-- ========== ACTIVITY LOG ==========
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  category public.log_category NOT NULL DEFAULT 'operational',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin and it read full log" ON public.activity_log FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['administrator','it_support']::public.app_role[]));
CREATE POLICY "dean reads operational log" ON public.activity_log FOR SELECT TO authenticated
  USING (category = 'operational' AND public.current_role_is(ARRAY['dean']::public.app_role[]));

CREATE OR REPLACE FUNCTION public.write_log(_action text, _entity_type text, _entity_id uuid, _category public.log_category, _details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, category, details)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _category, COALESCE(_details, '{}'::jsonb));
END;
$$;

-- ========== ERROR REPORTS ==========
CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  context text,
  url text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.error_reports TO authenticated;
GRANT ALL ON public.error_reports TO service_role;
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone signed in files an error" ON public.error_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "it and admin read errors" ON public.error_reports FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['it_support','administrator']::public.app_role[]));
CREATE POLICY "it resolves errors" ON public.error_reports FOR UPDATE TO authenticated
  USING (public.current_role_is(ARRAY['it_support']::public.app_role[]))
  WITH CHECK (public.current_role_is(ARRAY['it_support']::public.app_role[]));

-- ========== THROTTLING ==========
CREATE TABLE public.auth_throttle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  identifier text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  UNIQUE (scope, identifier)
);
GRANT SELECT ON public.auth_throttle TO authenticated;
GRANT ALL ON public.auth_throttle TO service_role;
ALTER TABLE public.auth_throttle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "it and admin read throttle" ON public.auth_throttle FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['it_support','administrator']::public.app_role[]));

-- ========== BOOKING RULES ==========
CREATE OR REPLACE FUNCTION public.is_chapel(_date date, _block public.time_block)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT EXTRACT(ISODOW FROM _date) = 3 AND _block = 'block_2'::public.time_block;
$$;

CREATE OR REPLACE FUNCTION public.lecturer_is_available(_lecturer uuid, _date date, _block public.time_block)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sem RECORD;
  in_exam boolean := false;
BEGIN
  IF public.is_chapel(_date, _block) THEN RETURN false; END IF;

  SELECT * INTO sem FROM public.semesters WHERE is_active LIMIT 1;
  IF sem IS NULL THEN RETURN false; END IF;
  IF _date < sem.start_date OR _date > sem.end_date THEN RETURN false; END IF;

  IF EXISTS (SELECT 1 FROM public.makeup_sessions m
             WHERE m.lecturer_id = _lecturer AND m.session_date = _date AND m.block = _block) THEN
    RETURN true;
  END IF;

  in_exam := _date >= sem.exam_start_date;

  IF in_exam THEN
    RETURN EXISTS (SELECT 1 FROM public.exam_slots e
      WHERE e.lecturer_id = _lecturer AND e.exam_date = _date AND e.block = _block);
  END IF;

  RETURN EXISTS (SELECT 1 FROM public.timetable_slots t
    WHERE t.lecturer_id = _lecturer
      AND t.semester_id = sem.id
      AND t.day_of_week = EXTRACT(ISODOW FROM _date)
      AND t.block = _block);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_appointment_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('pending','accepted') THEN
    IF public.is_chapel(NEW.appt_date, NEW.block) THEN
      RAISE EXCEPTION 'Wednesday 11:00-14:00 is Chapel; no appointment may be placed there.';
    END IF;
    IF NOT public.lecturer_is_available(NEW.lecturer_id, NEW.appt_date, NEW.block) THEN
      RAISE EXCEPTION 'The lecturer has no recorded availability at that date and time.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER appointments_rules BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_rules();

CREATE OR REPLACE FUNCTION public.enforce_no_chapel_session()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d date;
BEGIN
  d := CASE TG_TABLE_NAME WHEN 'makeup_sessions' THEN NEW.session_date ELSE NEW.exam_date END;
  IF public.is_chapel(d, NEW.block) THEN
    RAISE EXCEPTION 'Wednesday 11:00-14:00 is Chapel; nothing may be scheduled there.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER makeups_no_chapel BEFORE INSERT OR UPDATE ON public.makeup_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_no_chapel_session();
CREATE TRIGGER exams_no_chapel BEFORE INSERT OR UPDATE ON public.exam_slots
FOR EACH ROW EXECUTE FUNCTION public.enforce_no_chapel_session();

CREATE OR REPLACE FUNCTION public.enforce_timetable_no_chapel()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.day_of_week = 3 AND NEW.block = 'block_2'::public.time_block THEN
    RAISE EXCEPTION 'Wednesday 11:00-14:00 is Chapel; it cannot be timetabled.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER timetable_no_chapel BEFORE INSERT OR UPDATE ON public.timetable_slots
FOR EACH ROW EXECUTE FUNCTION public.enforce_timetable_no_chapel();

-- ========== AUDIT TRIGGERS ==========
CREATE OR REPLACE FUNCTION public.audit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE payload jsonb;
BEGIN
  payload := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP);
  IF TG_TABLE_NAME = 'appointments' THEN
    payload := payload || jsonb_build_object('status', NEW.status, 'date', NEW.appt_date, 'block', NEW.block);
  END IF;
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, category, details)
  VALUES (auth.uid(), lower(TG_OP) || '_' || TG_TABLE_NAME, TG_TABLE_NAME, NEW.id, 'operational', payload);
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_appointments AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE TRIGGER audit_timetable AFTER INSERT OR UPDATE ON public.timetable_slots
FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE TRIGGER audit_exams AFTER INSERT OR UPDATE ON public.exam_slots
FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE TRIGGER audit_makeups AFTER INSERT OR UPDATE ON public.makeup_sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE TRIGGER audit_semesters AFTER INSERT OR UPDATE ON public.semesters
FOR EACH ROW EXECUTE FUNCTION public.audit_change();

-- ========== SIGN-UP GATE ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  requested text := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  reg text := NEW.raw_user_meta_data->>'reg_number';
  full_name text := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  resolved public.app_role;
BEGIN
  IF requested = 'administrator' THEN
    RAISE EXCEPTION 'Administrator accounts cannot be created through sign-up.';
  END IF;

  IF requested = 'student' THEN
    -- LAW/M/REG NO/REG DATE/YEAR — year is two digits (e.g. 25)
    IF reg IS NULL OR upper(reg) !~ '^LAW/M/[0-9]+/[0-9]{4}/[0-9]{2}$' THEN
      RAISE EXCEPTION 'Use the School of Law format LAW/M/REG NO/REG DATE/YEAR.';
    END IF;
    resolved := 'student';
    INSERT INTO public.profiles (id, full_name, reg_number, email)
    VALUES (NEW.id, full_name, upper(reg), NEW.email);
  ELSIF requested IN ('lecturer','dean','it_support') THEN
    IF NEW.email IS NULL OR lower(NEW.email) NOT LIKE '%@kabarak.ac.ke' THEN
      RAISE EXCEPTION 'Staff accounts require a @kabarak.ac.ke university email.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.approved_staff s
      WHERE lower(s.email) = lower(NEW.email) AND s.role::text = requested
    ) THEN
      RAISE EXCEPTION 'This email is not on the approved list for that kind of account.';
    END IF;
    resolved := requested::public.app_role;
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id, full_name, NEW.email);
  ELSE
    RAISE EXCEPTION 'Unknown account type.';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, resolved);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ===========================================
-- MIGRATION: 20260919193225_102c70c0-ecc2-40b5-8f42-5037d2b01e19.sql
-- ===========================================


CREATE OR REPLACE FUNCTION public.is_chapel(_date date, _block public.time_block)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT EXTRACT(ISODOW FROM _date) = 3 AND _block = 'block_2'::public.time_block;
$$;

REVOKE ALL ON FUNCTION public.write_log(text, text, uuid, public.log_category, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_appointment_rules() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_no_chapel_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_timetable_no_chapel() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_role_is(public.app_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lecturer_is_available(uuid, date, public.time_block) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_chapel(date, public.time_block) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_is(public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lecturer_is_available(uuid, date, public.time_block) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chapel(date, public.time_block) TO authenticated;


-- ===========================================
-- MIGRATION: 20260920065501_947775d8-c3b5-4f62-915e-60366eb870dc.sql
-- ===========================================

-- Require a completed second authentication step whenever an Administrator or IT Support role is used.
CREATE OR REPLACE FUNCTION public.current_role_is(_roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY(_roles)
      AND (
        ur.role NOT IN ('administrator'::public.app_role, 'it_support'::public.app_role)
        OR COALESCE(auth.jwt()->>'aal', 'aal1') = 'aal2'
      )
  );
$$;

-- Semester dates must be ordered, with examinations beginning no earlier than week eleven.
ALTER TABLE public.semesters
  ADD CONSTRAINT semesters_dates_ordered
  CHECK (
    start_date <= end_date
    AND exam_start_date >= start_date + 70
    AND exam_start_date <= end_date
  );

CREATE OR REPLACE FUNCTION public.enforce_exam_period()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE sem public.semesters%ROWTYPE;
BEGIN
  SELECT * INTO sem FROM public.semesters WHERE id = NEW.semester_id;
  IF sem.id IS NULL OR NEW.exam_date < sem.exam_start_date OR NEW.exam_date > sem.end_date THEN
    RAISE EXCEPTION 'Exam slots must fall inside the configured examination period.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER exams_period
BEFORE INSERT OR UPDATE ON public.exam_slots
FOR EACH ROW EXECUTE FUNCTION public.enforce_exam_period();

-- Appointments and reasons are changed only through narrow, transactional functions.
REVOKE INSERT, UPDATE ON public.appointments FROM authenticated;
REVOKE INSERT ON public.appointment_reasons FROM authenticated;

DROP POLICY "student books own appointment" ON public.appointments;
DROP POLICY "student cancels own pending" ON public.appointments;
DROP POLICY "lecturer decides own appointments" ON public.appointments;
DROP POLICY "student writes own reason" ON public.appointment_reasons;

CREATE OR REPLACE FUNCTION public.book_appointment(
  _lecturer_id uuid,
  _appt_date date,
  _block public.time_block,
  _reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'student') THEN
    RAISE EXCEPTION 'Only students can request appointments.';
  END IF;
  IF char_length(trim(_reason)) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'Provide a reason between 5 and 1000 characters.';
  END IF;
  IF NOT public.has_role(_lecturer_id, 'lecturer') THEN
    RAISE EXCEPTION 'Appointments can only be requested with a lecturer.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.lecturer_id = _lecturer_id
      AND a.appt_date = _appt_date
      AND a.block = _block
      AND a.status IN ('pending', 'accepted')
  ) THEN
    RAISE EXCEPTION 'That appointment time is no longer available.';
  END IF;

  INSERT INTO public.appointments (student_id, lecturer_id, appt_date, block, status)
  VALUES (auth.uid(), _lecturer_id, _appt_date, _block, 'pending')
  RETURNING id INTO new_id;

  INSERT INTO public.appointment_reasons (appointment_id, reason)
  VALUES (new_id, trim(_reason));
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment(_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.appointments
  SET status = 'cancelled', decided_at = now()
  WHERE id = _appointment_id
    AND student_id = auth.uid()
    AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'This appointment cannot be cancelled.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_appointment(
  _appointment_id uuid,
  _decision public.appointment_status,
  _new_date date DEFAULT NULL,
  _new_block public.time_block DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE existing public.appointments%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'lecturer') THEN
    RAISE EXCEPTION 'Only lecturers can decide appointments.';
  END IF;
  SELECT * INTO existing FROM public.appointments
  WHERE id = _appointment_id AND lecturer_id = auth.uid() FOR UPDATE;
  IF existing.id IS NULL OR existing.status NOT IN ('pending', 'accepted') THEN
    RAISE EXCEPTION 'This appointment cannot be changed.';
  END IF;
  IF _decision NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'The decision must be accepted or declined.';
  END IF;
  IF (_new_date IS NULL) <> (_new_block IS NULL) THEN
    RAISE EXCEPTION 'A reschedule needs both a date and a time block.';
  END IF;
  IF _new_date IS NOT NULL AND NOT public.lecturer_is_available(auth.uid(), _new_date, _new_block) THEN
    RAISE EXCEPTION 'The new time is outside recorded availability.';
  END IF;
  IF _new_date IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id <> _appointment_id
      AND a.lecturer_id = auth.uid()
      AND a.appt_date = _new_date
      AND a.block = _new_block
      AND a.status IN ('pending', 'accepted')
  ) THEN
    RAISE EXCEPTION 'The new appointment time is already occupied.';
  END IF;

  UPDATE public.appointments
  SET status = _decision,
      appt_date = COALESCE(_new_date, appt_date),
      block = COALESCE(_new_block, block),
      decided_at = now()
  WHERE id = _appointment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment(uuid, date, public.time_block, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_appointment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_appointment(uuid, public.appointment_status, date, public.time_block) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, date, public.time_block, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_appointment(uuid, public.appointment_status, date, public.time_block) TO authenticated;

-- Service-only helpers for login throttling. Identifiers supplied by the application are one-way hashes.
CREATE OR REPLACE FUNCTION public.check_auth_throttle(_scope text, _identifier text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.auth_throttle
    WHERE scope = _scope AND identifier = _identifier AND locked_until > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.record_auth_attempt(_scope text, _identifier text, _succeeded boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _succeeded THEN
    DELETE FROM public.auth_throttle WHERE scope = _scope AND identifier = _identifier;
    RETURN;
  END IF;
  INSERT INTO public.auth_throttle (scope, identifier, attempts, window_started_at, locked_until)
  VALUES (_scope, _identifier, 1, now(), NULL)
  ON CONFLICT (scope, identifier) DO UPDATE SET
    attempts = CASE WHEN public.auth_throttle.window_started_at < now() - interval '15 minutes' THEN 1 ELSE public.auth_throttle.attempts + 1 END,
    window_started_at = CASE WHEN public.auth_throttle.window_started_at < now() - interval '15 minutes' THEN now() ELSE public.auth_throttle.window_started_at END,
    locked_until = CASE
      WHEN (CASE WHEN public.auth_throttle.window_started_at < now() - interval '15 minutes' THEN 1 ELSE public.auth_throttle.attempts + 1 END) >= 5
      THEN now() + interval '15 minutes'
      ELSE public.auth_throttle.locked_until
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.check_auth_throttle(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_auth_attempt(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_throttle(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_auth_attempt(text, text, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.enforce_exam_period() FROM PUBLIC, anon, authenticated;

-- ===========================================
-- MIGRATION: 20260920065529_260a23d0-2677-45ac-9638-6703879e1440.sql
-- ===========================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.current_role_is(_roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = ANY(_roles)
      AND (ur.role NOT IN ('administrator'::public.app_role, 'it_support'::public.app_role)
        OR COALESCE(auth.jwt()->>'aal', 'aal1') = 'aal2')
  );
$$;

CREATE OR REPLACE FUNCTION private.lecturer_is_available(_lecturer uuid, _date date, _block public.time_block)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE sem RECORD;
BEGIN
  IF public.is_chapel(_date, _block) THEN RETURN false; END IF;
  SELECT * INTO sem FROM public.semesters WHERE is_active LIMIT 1;
  IF sem IS NULL OR _date < sem.start_date OR _date > sem.end_date THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.makeup_sessions m WHERE m.lecturer_id = _lecturer AND m.session_date = _date AND m.block = _block) THEN RETURN true; END IF;
  IF _date >= sem.exam_start_date THEN
    RETURN EXISTS (SELECT 1 FROM public.exam_slots e WHERE e.lecturer_id = _lecturer AND e.exam_date = _date AND e.block = _block);
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.timetable_slots t WHERE t.lecturer_id = _lecturer AND t.semester_id = sem.id AND t.day_of_week = EXTRACT(ISODOW FROM _date) AND t.block = _block);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS $$
  SELECT private.has_role(_user_id, _role);
$$;
CREATE OR REPLACE FUNCTION public.current_role_is(_roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS $$
  SELECT private.current_role_is(_roles);
$$;
CREATE OR REPLACE FUNCTION public.lecturer_is_available(_lecturer uuid, _date date, _block public.time_block)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS $$
  SELECT private.lecturer_is_available(_lecturer, _date, _block);
$$;

CREATE OR REPLACE FUNCTION private.book_appointment(_lecturer_id uuid, _appt_date date, _block public.time_block, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'student') THEN RAISE EXCEPTION 'Only students can request appointments.'; END IF;
  IF char_length(trim(_reason)) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Provide a reason between 5 and 1000 characters.'; END IF;
  IF NOT private.has_role(_lecturer_id, 'lecturer') THEN RAISE EXCEPTION 'Appointments can only be requested with a lecturer.'; END IF;
  IF EXISTS (SELECT 1 FROM public.appointments a WHERE a.lecturer_id = _lecturer_id AND a.appt_date = _appt_date AND a.block = _block AND a.status IN ('pending','accepted')) THEN RAISE EXCEPTION 'That appointment time is no longer available.'; END IF;
  INSERT INTO public.appointments (student_id, lecturer_id, appt_date, block, status) VALUES (auth.uid(), _lecturer_id, _appt_date, _block, 'pending') RETURNING id INTO new_id;
  INSERT INTO public.appointment_reasons (appointment_id, reason) VALUES (new_id, trim(_reason));
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.cancel_appointment(_appointment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.appointments SET status = 'cancelled', decided_at = now() WHERE id = _appointment_id AND student_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'This appointment cannot be cancelled.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.decide_appointment(_appointment_id uuid, _decision public.appointment_status, _new_date date, _new_block public.time_block)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE existing public.appointments%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'lecturer') THEN RAISE EXCEPTION 'Only lecturers can decide appointments.'; END IF;
  SELECT * INTO existing FROM public.appointments WHERE id = _appointment_id AND lecturer_id = auth.uid() FOR UPDATE;
  IF existing.id IS NULL OR existing.status NOT IN ('pending','accepted') THEN RAISE EXCEPTION 'This appointment cannot be changed.'; END IF;
  IF _decision NOT IN ('accepted','declined') THEN RAISE EXCEPTION 'The decision must be accepted or declined.'; END IF;
  IF (_new_date IS NULL) <> (_new_block IS NULL) THEN RAISE EXCEPTION 'A reschedule needs both a date and a time block.'; END IF;
  IF _new_date IS NOT NULL AND NOT private.lecturer_is_available(auth.uid(), _new_date, _new_block) THEN RAISE EXCEPTION 'The new time is outside recorded availability.'; END IF;
  IF _new_date IS NOT NULL AND EXISTS (SELECT 1 FROM public.appointments a WHERE a.id <> _appointment_id AND a.lecturer_id = auth.uid() AND a.appt_date = _new_date AND a.block = _new_block AND a.status IN ('pending','accepted')) THEN RAISE EXCEPTION 'The new appointment time is already occupied.'; END IF;
  UPDATE public.appointments SET status = _decision, appt_date = COALESCE(_new_date, appt_date), block = COALESCE(_new_block, block), decided_at = now() WHERE id = _appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.book_appointment(_lecturer_id uuid, _appt_date date, _block public.time_block, _reason text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = private AS $$ SELECT private.book_appointment(_lecturer_id, _appt_date, _block, _reason); $$;
CREATE OR REPLACE FUNCTION public.cancel_appointment(_appointment_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = private AS $$ SELECT private.cancel_appointment(_appointment_id); $$;
CREATE OR REPLACE FUNCTION public.decide_appointment(_appointment_id uuid, _decision public.appointment_status, _new_date date DEFAULT NULL, _new_block public.time_block DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = private AS $$ SELECT private.decide_appointment(_appointment_id, _decision, _new_date, _new_block); $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_role_is(public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.lecturer_is_available(uuid, date, public.time_block) TO authenticated;
GRANT EXECUTE ON FUNCTION private.book_appointment(uuid, date, public.time_block, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.cancel_appointment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.decide_appointment(uuid, public.appointment_status, date, public.time_block) TO authenticated;

-- ===========================================
-- MIGRATION: 20260923065002_a43163d4-7fe4-459a-9f62-59ee9d20fcda.sql
-- ===========================================

CREATE POLICY "lecturer reads booked student identity"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'lecturer'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.lecturer_id = auth.uid()
      AND a.student_id = profiles.id
  )
);

CREATE OR REPLACE FUNCTION public.consume_action_throttle(
  _scope text,
  _identifier text,
  _maximum integer,
  _window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.auth_throttle%ROWTYPE;
BEGIN
  IF _scope NOT IN ('booking:account', 'booking:ip', 'reschedule:account', 'reschedule:ip')
     OR _maximum < 1
     OR _window_minutes < 1 THEN
    RAISE EXCEPTION 'Invalid action throttle configuration.';
  END IF;

  INSERT INTO public.auth_throttle (scope, identifier, attempts, window_started_at, locked_until)
  VALUES (_scope, _identifier, 1, now(), NULL)
  ON CONFLICT (scope, identifier) DO UPDATE SET
    attempts = CASE
      WHEN public.auth_throttle.window_started_at < now() - make_interval(mins => _window_minutes)
        THEN 1
      ELSE public.auth_throttle.attempts + 1
    END,
    window_started_at = CASE
      WHEN public.auth_throttle.window_started_at < now() - make_interval(mins => _window_minutes)
        THEN now()
      ELSE public.auth_throttle.window_started_at
    END,
    locked_until = CASE
      WHEN public.auth_throttle.locked_until > now() THEN public.auth_throttle.locked_until
      WHEN (
        CASE
          WHEN public.auth_throttle.window_started_at < now() - make_interval(mins => _window_minutes)
            THEN 1
          ELSE public.auth_throttle.attempts + 1
        END
      ) > _maximum THEN now() + make_interval(mins => _window_minutes)
      ELSE NULL
    END
  RETURNING * INTO current_row;

  RETURN current_row.locked_until IS NULL OR current_row.locked_until <= now();
END;
$$;

REVOKE ALL ON FUNCTION public.consume_action_throttle(text, text, integer, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_action_throttle(text, text, integer, integer)
TO service_role;

-- ===========================================
-- MIGRATION: 20261001093907_5d7db282-263d-4e51-aa18-bdd2da239d1b.sql
-- ===========================================

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
    IF NEW.email IS NULL OR lower(NEW.email) NOT LIKE '%@kabarak.ac.ke' THEN
      RAISE EXCEPTION 'Staff accounts require a @kabarak.ac.ke university email.';
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

