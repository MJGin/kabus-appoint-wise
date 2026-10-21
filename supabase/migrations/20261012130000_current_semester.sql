-- Current semester + carry the timetable forward.
--
-- The student screen only offers free times on weekdays INSIDE the active
-- semester (September to December, exams in December). This creates that
-- semester, makes it active, and copies the existing timetable rows onto
-- it (once only).

DO $$
DECLARE
  new_sem uuid;
  src_sem uuid;
BEGIN
  -- Reuse the September - December 2026 semester if it is already there.
  SELECT id INTO new_sem FROM public.semesters WHERE name = 'September - December 2026' LIMIT 1;

  IF new_sem IS NULL THEN
    INSERT INTO public.semesters (name, start_date, exam_start_date, end_date, is_active)
    VALUES ('September - December 2026', '2026-09-01', '2026-12-01', '2026-12-31', true)
    RETURNING id INTO new_sem;
  END IF;

  -- Only one active semester at a time.
  UPDATE public.semesters SET is_active = false WHERE id <> new_sem;
  UPDATE public.semesters SET is_active = true WHERE id = new_sem;

  -- Copy timetable rows from the semester that has them (the 2025/2026 seed),
  -- but only if the new semester has none yet (safe to re-run).
  IF NOT EXISTS (SELECT 1 FROM public.timetable_slots WHERE semester_id = new_sem) THEN
    SELECT id INTO src_sem
    FROM public.semesters s
    WHERE s.id <> new_sem
      AND EXISTS (SELECT 1 FROM public.timetable_slots t WHERE t.semester_id = s.id)
    ORDER BY s.start_date DESC
    LIMIT 1;

    IF src_sem IS NOT NULL THEN
      INSERT INTO public.timetable_slots
        (semester_id, lecturer_id, unit_code, unit_name, year_group, day_of_week, block)
      SELECT new_sem, lecturer_id, unit_code, unit_name, year_group, day_of_week, block
      FROM public.timetable_slots
      WHERE semester_id = src_sem;
    END IF;
  END IF;
END;
$$;
