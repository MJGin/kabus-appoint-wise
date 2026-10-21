-- Remove AAL2 requirement for administrator and it_support roles
-- This allows all accounts to sign in without enforced second factor

CREATE OR REPLACE FUNCTION public.current_role_is(_roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY(_roles)
  );
$$;