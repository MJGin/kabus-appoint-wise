-- Changing the active semester in one statement, so a failed or offline
-- attempt can never leave the school with NO active semester (which used to
-- hide every timetabled block until the administrator tried again twice).
CREATE OR REPLACE FUNCTION public.activate_semester_lotin(_semester_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.current_role_is(ARRAY['administrator']::public.app_role[]) THEN
    RAISE EXCEPTION 'Only the School Administrator can change the active semester.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.semesters WHERE id = _semester_id) THEN
    RAISE EXCEPTION 'That semester does not exist.';
  END IF;
  UPDATE public.semesters SET is_active = (id = _semester_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_semester_lotin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_semester_lotin(uuid) TO authenticated;
