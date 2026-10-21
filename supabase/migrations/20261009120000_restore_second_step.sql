-- Restore the second-step (aal2) requirement for Administrator and IT Support.
--
-- 20261009000000_remove_admin_restrictions.sql replaced public.current_role_is with a
-- SECURITY DEFINER version that ignores the authenticator assurance level. The checked
-- implementation still lives in private.current_role_is (created in
-- 20260920065529), which requires aal2 for the administrator and it_support roles.
-- Point the public entry point back at it, exactly as that migration originally did.

CREATE OR REPLACE FUNCTION public.current_role_is(_roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.current_role_is(_roles);
$$;

REVOKE ALL ON FUNCTION public.current_role_is(public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_role_is(public.app_role[]) TO authenticated;

-- Sign-in failure counter with a caller-chosen limit.
-- record_auth_attempt locks after 5 failures on every scope, which is right for one account
-- but would let a few mistyped passwords lock out a whole campus network address. This
-- version lets the application use a strict limit per account and a looser one per address.
CREATE OR REPLACE FUNCTION public.record_auth_failure(
  _scope text,
  _identifier text,
  _max_failures integer,
  _window_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _scope NOT IN ('login:account', 'login:ip')
     OR _max_failures < 1
     OR _window_minutes < 1 THEN
    RAISE EXCEPTION 'Invalid throttle configuration.';
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
      WHEN (
        CASE
          WHEN public.auth_throttle.window_started_at < now() - make_interval(mins => _window_minutes)
            THEN 1
          ELSE public.auth_throttle.attempts + 1
        END
      ) >= _max_failures THEN now() + make_interval(mins => _window_minutes)
      ELSE public.auth_throttle.locked_until
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.record_auth_failure(text, text, integer, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_auth_failure(text, text, integer, integer)
TO service_role;
