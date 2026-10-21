
CREATE OR REPLACE FUNCTION public.is_chapel(_date date, _block public.time_block)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT EXTRACT(ISODOW FROM _date) = 3 AND _block = 'block_2'::public.time_block;
$$;

REVOKE ALL ON FUNCTION public.write_log(text, text, uuid, public.log_category, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_appointment_rules() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_no_chapel_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_timetable_no_chapel() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_role_is(public.app_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lecturer_is_available(uuid, date, public.time_block) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_chapel(date, public.time_block) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_is(public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lecturer_is_available(uuid, date, public.time_block) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chapel(date, public.time_block) TO authenticated;
