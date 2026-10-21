-- Free means the lecturer's timetabled window itself (plus any make-up /
-- exam time they added) — never Chapel, never outside the semester.
-- Matches StudentDash openBlocks exactly: anything shown green must book.
CREATE OR REPLACE FUNCTION private.slot_is_free(_lecturer uuid, _listing uuid, _date date, _block public.time_block)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sem RECORD;
  dow integer := EXTRACT(ISODOW FROM _date)::integer;
BEGIN
  IF dow NOT BETWEEN 1 AND 5 THEN RETURN false; END IF;
  IF public.is_chapel(_date, _block) THEN RETURN false; END IF;

  SELECT * INTO sem FROM public.semesters WHERE is_active LIMIT 1;
  IF FOUND AND (_date < sem.start_date OR _date > sem.end_date) THEN RETURN false; END IF;

  IF _lecturer IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.timetable_slots t
               WHERE t.lecturer_id = _lecturer AND t.day_of_week = dow AND t.block = _block) THEN RETURN true; END IF;
    IF EXISTS (SELECT 1 FROM public.makeup_sessions m
               WHERE m.lecturer_id = _lecturer AND m.session_date = _date AND m.block = _block) THEN RETURN true; END IF;
    IF EXISTS (SELECT 1 FROM public.exam_slots e
               WHERE e.lecturer_id = _lecturer AND e.exam_date = _date AND e.block = _block) THEN RETURN true; END IF;
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.staff_listings l,
      jsonb_array_elements(CASE WHEN jsonb_typeof(l.classes) = 'array' THEN l.classes ELSE '[]'::jsonb END) c
    WHERE l.id = _listing
      AND (c->>'day_of_week')::integer = dow
      AND (c->>'block')::public.time_block = _block
  );
END;
$$;
