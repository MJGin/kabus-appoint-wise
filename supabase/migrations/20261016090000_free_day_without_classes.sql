-- A lecturer with no class on a day is free that whole day.
--
-- Until now a time counted as free only if it came AFTER the lecturer's last class. Since the
-- timetable was removed from the stored data, no lecturer had any class, so no lecturer had any
-- free time and nothing could be booked. A day with no class now leaves every block free (Chapel
-- is still never free); a day with classes is free only after the last one, as before.
-- The student screen applies the same rule (StudentDash.openBlocks).

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

    IF blk > last_class THEN RETURN true; END IF;
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

  RETURN blk > last_class;
END;
$$;

REVOKE ALL ON FUNCTION private.slot_is_free(uuid, uuid, date, public.time_block) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.slot_is_free(uuid, uuid, date, public.time_block) TO authenticated;
