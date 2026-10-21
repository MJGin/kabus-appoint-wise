-- The Dean signs in with the second step, like Administrator and IT Support:
-- all three roles only count at authenticator assurance level 2 (aal2).
CREATE OR REPLACE FUNCTION private.current_role_is(_roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = ANY(_roles)
      AND (ur.role NOT IN ('administrator'::public.app_role, 'it_support'::public.app_role, 'dean'::public.app_role)
        OR COALESCE(auth.jwt()->>'aal', 'aal1') = 'aal2')
  );
$$;
