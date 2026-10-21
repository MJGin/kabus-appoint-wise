CREATE OR REPLACE FUNCTION private.lecturer_is_available(_lecturer uuid, _date date, _block time_block)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sem RECORD; last_block public.time_block;
BEGIN
  IF public.is_chapel(_date, _block) THEN RETURN false; END IF;
  SELECT * INTO sem FROM public.semesters WHERE is_active LIMIT 1;
  IF sem IS NULL OR _date < sem.start_date OR _date > sem.end_date THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.makeup_sessions m WHERE m.lecturer_id = _lecturer AND m.session_date = _date AND m.block = _block) THEN RETURN true; END IF;
  IF _date >= sem.exam_start_date THEN
    RETURN EXISTS (SELECT 1 FROM public.exam_slots e WHERE e.lecturer_id = _lecturer AND e.exam_date = _date AND e.block = _block);
  END IF;
  -- On a teaching day the lecturer is on campus and free in every block after the last class.
  SELECT max(t.block) INTO last_block FROM public.timetable_slots t
   WHERE t.lecturer_id = _lecturer AND t.semester_id = sem.id AND t.day_of_week = EXTRACT(ISODOW FROM _date);
  RETURN last_block IS NOT NULL AND _block > last_block;
END;
$function$;