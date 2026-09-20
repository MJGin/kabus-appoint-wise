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