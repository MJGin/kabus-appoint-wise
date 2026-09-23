CREATE POLICY "lecturer reads booked student identity"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'lecturer'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.lecturer_id = auth.uid()
      AND a.student_id = profiles.id
  )
);

CREATE OR REPLACE FUNCTION public.consume_action_throttle(
  _scope text,
  _identifier text,
  _maximum integer,
  _window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.auth_throttle%ROWTYPE;
BEGIN
  IF _scope NOT IN ('booking:account', 'booking:ip', 'reschedule:account', 'reschedule:ip')
     OR _maximum < 1
     OR _window_minutes < 1 THEN
    RAISE EXCEPTION 'Invalid action throttle configuration.';
  END IF;

  INSERT INTO public.auth_throttle (scope, identifier, attempts, window_started_at, locked_until)
  VALUES (_scope, _identifier, 1, now(), NULL)
  ON CONFLICT (scope, identifier) DO UPDATE SET
    attempts = CASE
      WHEN public.auth_throttle.window_started_at < now() - make_interval(mins => _window_minutes)
        THEN 1
      ELSE public.auth_throttle.attempts + 1
    END,
    window_started_at = CASE
      WHEN public.auth_throttle.window_started_at < now() - make_interval(mins => _window_minutes)
        THEN now()
      ELSE public.auth_throttle.window_started_at
    END,
    locked_until = CASE
      WHEN public.auth_throttle.locked_until > now() THEN public.auth_throttle.locked_until
      WHEN (
        CASE
          WHEN public.auth_throttle.window_started_at < now() - make_interval(mins => _window_minutes)
            THEN 1
          ELSE public.auth_throttle.attempts + 1
        END
      ) > _maximum THEN now() + make_interval(mins => _window_minutes)
      ELSE NULL
    END
  RETURNING * INTO current_row;

  RETURN current_row.locked_until IS NULL OR current_row.locked_until <= now();
END;
$$;

REVOKE ALL ON FUNCTION public.consume_action_throttle(text, text, integer, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_action_throttle(text, text, integer, integer)
TO service_role;