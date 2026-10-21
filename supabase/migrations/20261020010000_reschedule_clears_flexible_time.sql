-- Rescheduling joins the flexible-booking era.
--
-- decide_appointment still came from September: it ignored start times and
-- durations, so moving a request could be refused across times that never
-- actually touch. The lecturer_is_available function that the live database
-- uses is intentionally left as-is (a newer version is already deployed and
-- matches the data).

CREATE OR REPLACE FUNCTION private.decide_appointment(
  _appointment_id uuid,
  _decision public.appointment_status,
  _new_date date DEFAULT NULL,
  _new_block public.time_block DEFAULT NULL,
  _new_start time DEFAULT NULL,
  _new_duration integer DEFAULT NULL
) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  existing public.appointments%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'lecturer') THEN
    RAISE EXCEPTION 'Only lecturers can decide appointments.';
  END IF;

  SELECT * INTO existing FROM public.appointments
  WHERE id = _appointment_id AND lecturer_id = auth.uid() FOR UPDATE;
  IF existing.id IS NULL OR existing.status NOT IN ('pending','accepted') THEN
    RAISE EXCEPTION 'This appointment cannot be changed.';
  END IF;
  IF _decision NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'The decision must be accepted or declined.';
  END IF;

  -- Nothing new was chosen: a plain accept or decline keeps every time.
  IF _new_date IS NULL AND _new_block IS NULL AND _new_start IS NULL AND _new_duration IS NULL THEN
    UPDATE public.appointments SET status = _decision, decided_at = now()
    WHERE id = _appointment_id;
    RETURN;
  END IF;

  -- A replacement is chosen; date, period and (when given) a start time must
  -- arrive together.
  IF (_new_date IS NULL) <> (_new_block IS NULL) OR (_new_block IS NULL) <> (_new_start IS NULL) OR (_new_start IS NULL) <> (_new_duration IS NULL) THEN
    RAISE EXCEPTION 'A reschedule needs both a date and a time, one way or the other.';
  END IF;

  -- A different window must be one the lecturer is really available in.
  IF (_new_date, _new_block) IS DISTINCT FROM (existing.appt_date, existing.block)
     AND NOT private.lecturer_is_available(auth.uid(), _new_date, _new_block) THEN
    RAISE EXCEPTION 'The new time is outside recorded availability.';
  END IF;

  IF _new_start IS NOT NULL THEN
    -- Flexible move: chosen minutes, 15 to 180.
    IF _new_duration IS NULL OR _new_duration NOT BETWEEN 15 AND 180 THEN
      RAISE EXCEPTION 'An appointment runs 15 minutes to 3 hours.';
    END IF;
    UPDATE public.appointments
    SET status = _decision, decided_at = now(),
        appt_date = _new_date, block = _new_block,
        start_time = _new_start, duration_minutes = _new_duration
    WHERE id = _appointment_id;
    RETURN;
  END IF;

  -- Whole-period move. One appointment per lecturer, day and period, the same
  -- rule the booking screen shows; and the old chosen minutes no longer
  -- describe the appointment, so they are cleared.
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id <> _appointment_id AND a.lecturer_id = auth.uid()
      AND a.appt_date = _new_date AND a.block = _new_block
      AND a.status IN ('pending','accepted')
  ) THEN
    RAISE EXCEPTION 'The new appointment time is already occupied.';
  END IF;
  UPDATE public.appointments
  SET status = _decision, decided_at = now(),
      appt_date = _new_date, block = _new_block,
      start_time = NULL, duration_minutes = NULL
  WHERE id = _appointment_id;
END;
$$;

-- Keep every client call shape working: the screen sends date + period, the
-- four-argument form covers it.
CREATE OR REPLACE FUNCTION public.decide_appointment(
  _appointment_id uuid, _decision public.appointment_status, _new_date date, _new_block public.time_block
) RETURNS void
 LANGUAGE sql SECURITY INVOKER SET search_path = private AS $$
  SELECT private.decide_appointment(_appointment_id, _decision, _new_date, _new_block);
$$;

CREATE OR REPLACE FUNCTION public.decide_appointment(
  _appointment_id uuid, _decision public.appointment_status,
  _new_date date, _new_block public.time_block,
  _new_start time, _new_duration integer
) RETURNS void
 LANGUAGE sql SECURITY INVOKER SET search_path = private AS $$
  SELECT private.decide_appointment(_appointment_id, _decision, _new_date, _new_block, _new_start, _new_duration);
$$;

REVOKE ALL ON FUNCTION public.decide_appointment(uuid, public.appointment_status, date, public.time_block) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_appointment(uuid, public.appointment_status, date, public.time_block, time, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_appointment(uuid, public.appointment_status, date, public.time_block) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_appointment(uuid, public.appointment_status, date, public.time_block, time, integer) TO authenticated;
