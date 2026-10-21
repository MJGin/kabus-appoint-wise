-- Rescheduling now follows the same rule as booking.
--
-- Until now a lecturer could only move a request to a time that private.lecturer_is_available accepted
-- (an older rule), while students book against private.slot_is_free. The two disagree, so moving a request
-- to a time students can book was refused with "The new time is outside recorded availability" and the
-- Reschedule button appeared to do nothing.
--
-- From here on:
--   * a new time must be one private.slot_is_free accepts (the green times a student sees);
--   * the appointment keeps its length when it moves (a 30 minute request stays 30 minutes);
--   * the lecturer may choose the new start time; if they do not, the earliest start that fits and does
--     not overlap another appointment is used;
--   * the student is told when the time of an appointment changes, even if it was already accepted.
--
-- Safe to run whether or not 20261020010000_reschedule_clears_flexible_time.sql was applied: that file cannot be
-- applied on top of the September functions ("cannot remove parameter defaults from existing function"), so this
-- one removes every older version of decide_appointment first and leaves exactly one.

DROP FUNCTION IF EXISTS public.decide_appointment(uuid, public.appointment_status, date, public.time_block);
DROP FUNCTION IF EXISTS public.decide_appointment(uuid, public.appointment_status, date, public.time_block, time, integer);
DROP FUNCTION IF EXISTS private.decide_appointment(uuid, public.appointment_status, date, public.time_block);
DROP FUNCTION IF EXISTS private.decide_appointment(uuid, public.appointment_status, date, public.time_block, time, integer);

CREATE FUNCTION private.decide_appointment(
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
  dur integer;
  begin_t time;
  s time;
  chosen time;
  local_now timestamp := (now() AT TIME ZONE 'Africa/Nairobi');
BEGIN
  IF NOT private.has_role(auth.uid(), 'lecturer') THEN
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

  -- Nothing new chosen: a plain accept or decline keeps every time.
  IF _new_date IS NULL AND _new_block IS NULL AND _new_start IS NULL AND _new_duration IS NULL THEN
    UPDATE public.appointments SET status = _decision, decided_at = now() WHERE id = _appointment_id;
    RETURN;
  END IF;

  IF _decision <> 'accepted' THEN
    RAISE EXCEPTION 'Only an accepted appointment can be moved.';
  END IF;
  IF _new_date IS NULL OR _new_block IS NULL THEN
    RAISE EXCEPTION 'To reschedule, choose both a new date and a period.';
  END IF;

  IF _new_date < local_now::date THEN
    RAISE EXCEPTION 'That date has already passed.';
  END IF;

  -- A different date or period must be one students can book too.
  IF (_new_date, _new_block) IS DISTINCT FROM (existing.appt_date, existing.block)
     AND NOT private.slot_is_free(auth.uid(), NULL, _new_date, _new_block) THEN
    RAISE EXCEPTION 'That is not one of your available times. Choose a green time from your availability.';
  END IF;

  dur := COALESCE(_new_duration, existing.duration_minutes, 180);
  IF dur NOT BETWEEN 15 AND 180 OR dur % 15 <> 0 THEN
    RAISE EXCEPTION 'An appointment runs 15 minutes to 3 hours, in steps of 15 minutes.';
  END IF;

  begin_t := private.block_start(_new_block);
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || _new_date::text));

  IF _new_start IS NOT NULL THEN
    IF EXTRACT(MINUTE FROM _new_start)::integer % 15 <> 0 OR EXTRACT(SECOND FROM _new_start) <> 0 THEN
      RAISE EXCEPTION 'Choose a start time on a quarter of an hour.';
    END IF;
    IF _new_start < begin_t OR (_new_start - begin_t) + make_interval(mins => dur) > interval '3 hours' THEN
      RAISE EXCEPTION 'That start time and length do not fit inside the chosen period.';
    END IF;
    chosen := _new_start;
  ELSE
    -- Keep the old start if the appointment stays in the same period and it still fits; otherwise the earliest free start.
    IF (_new_date, _new_block) IS NOT DISTINCT FROM (existing.appt_date, existing.block) AND existing.start_time IS NOT NULL THEN
      chosen := existing.start_time;
    ELSE
      s := begin_t;
      WHILE s + make_interval(mins => dur) <= begin_t + interval '3 hours' LOOP
        IF (_new_date + s) > local_now
           AND NOT EXISTS (
             SELECT 1 FROM public.appointments a
             WHERE a.id <> _appointment_id AND a.lecturer_id = auth.uid()
               AND a.appt_date = _new_date AND a.block = _new_block
               AND a.status IN ('pending', 'accepted')
               AND COALESCE(a.start_time, private.block_start(a.block)) < s + make_interval(mins => dur)
               AND s < COALESCE(a.start_time, private.block_start(a.block)) + make_interval(mins => COALESCE(a.duration_minutes, 180))
           ) THEN
          chosen := s;
          EXIT;
        END IF;
        s := s + interval '15 minutes';
      END LOOP;
      IF chosen IS NULL THEN
        RAISE EXCEPTION 'There is no room for % minutes in that period. Choose another period or a shorter time.', dur;
      END IF;
    END IF;
  END IF;

  IF (_new_date + chosen) <= local_now THEN
    RAISE EXCEPTION 'That time has already passed.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id <> _appointment_id AND a.lecturer_id = auth.uid()
      AND a.appt_date = _new_date AND a.block = _new_block
      AND a.status IN ('pending', 'accepted')
      AND COALESCE(a.start_time, private.block_start(a.block)) < chosen + make_interval(mins => dur)
      AND chosen < COALESCE(a.start_time, private.block_start(a.block)) + make_interval(mins => COALESCE(a.duration_minutes, 180))
  ) THEN
    RAISE EXCEPTION 'That time overlaps another appointment. Choose a different start time.';
  END IF;

  UPDATE public.appointments
  SET status = _decision, decided_at = now(),
      appt_date = _new_date, block = _new_block,
      start_time = chosen, duration_minutes = dur
  WHERE id = _appointment_id;
END;
$$;

-- One public function. The screen may send just an id and a decision (plain accept / decline), a date and a
-- period (reschedule), or a date, period, start time and length.
CREATE FUNCTION public.decide_appointment(
  _appointment_id uuid,
  _decision public.appointment_status,
  _new_date date DEFAULT NULL,
  _new_block public.time_block DEFAULT NULL,
  _new_start time DEFAULT NULL,
  _new_duration integer DEFAULT NULL
) RETURNS void
 LANGUAGE sql SECURITY INVOKER SET search_path = private AS $$
  SELECT private.decide_appointment(_appointment_id, _decision, _new_date, _new_block, _new_start, _new_duration);
$$;

REVOKE ALL ON FUNCTION private.decide_appointment(uuid, public.appointment_status, date, public.time_block, time, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_appointment(uuid, public.appointment_status, date, public.time_block, time, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.decide_appointment(uuid, public.appointment_status, date, public.time_block, time, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_appointment(uuid, public.appointment_status, date, public.time_block, time, integer) TO authenticated;

-- ========== TELL THE STUDENT WHEN THE TIME CHANGES ==========
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
        VALUES (NEW.student_id, 'appointment_accepted',
                CASE WHEN (OLD.appt_date, OLD.block, OLD.start_time) IS DISTINCT FROM (NEW.appt_date, NEW.block, NEW.start_time)
                     THEN 'Appointment accepted at a new time' ELSE 'Appointment accepted' END,
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
    ELSIF NEW.status IN ('pending', 'accepted')
          AND (OLD.appt_date, OLD.block, OLD.start_time) IS DISTINCT FROM (NEW.appt_date, NEW.block, NEW.start_time) THEN
      INSERT INTO public.notifications (user_id, type, title, body)
      VALUES (NEW.student_id, 'appointment_rescheduled', 'Appointment moved',
              lecturer.full_name || ' moved your appointment to ' || when_text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_appointment_change() FROM PUBLIC, anon, authenticated;
