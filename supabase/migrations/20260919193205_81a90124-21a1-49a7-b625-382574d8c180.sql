
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
    IF reg IS NULL OR upper(reg) NOT LIKE 'LAW/%' THEN
      RAISE EXCEPTION 'A School of Law registration number must start with LAW/.';
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
