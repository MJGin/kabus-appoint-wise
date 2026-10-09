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