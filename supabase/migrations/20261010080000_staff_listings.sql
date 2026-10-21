-- Staff listings: lecturers known from the timetable who have not signed in yet.
-- A student can request a free time against a listing; the request is handed to
-- the real account the moment that lecturer signs in for the first time.
-- (No migration created this table before; the sign-up trigger and the
-- flexible-booking functions both read it, so it must exist first.)

CREATE TABLE IF NOT EXISTS public.staff_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  title text,
  department text,
  bio text,
  photo_url text,
  office_location text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_listings_email_key
  ON public.staff_listings (lower(email));
CREATE INDEX IF NOT EXISTS staff_listings_user_idx
  ON public.staff_listings (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.staff_listings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.staff_listings TO authenticated;
GRANT ALL ON public.staff_listings TO service_role;

-- Signed-in users see only lecturers who have not activated yet (the bookable ones).
DROP POLICY IF EXISTS "public listings readable" ON public.staff_listings;
CREATE POLICY "public listings readable" ON public.staff_listings
  FOR SELECT TO authenticated USING (user_id IS NULL);

DROP POLICY IF EXISTS "admin manages listings" ON public.staff_listings;
CREATE POLICY "admin manages listings" ON public.staff_listings
  FOR ALL TO authenticated
  USING (public.current_role_is(ARRAY['administrator']::public.app_role[]))
  WITH CHECK (public.current_role_is(ARRAY['administrator']::public.app_role[]));
