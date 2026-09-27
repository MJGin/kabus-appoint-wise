-- KABUSLotIn test data seed
-- Run in Supabase SQL Editor as the project owner (service role / SQL editor).
-- Do NOT run this in production with real people.

-- 1) Approved staff (required before any staff sign-up succeeds)
INSERT INTO public.approved_staff (email, role) VALUES
  ('lecturer.test@kabarak.ac.ke', 'lecturer'),
  ('dean.test@kabarak.ac.ke', 'dean'),
  ('it.test@kabarak.ac.ke', 'it_support')
ON CONFLICT DO NOTHING;

-- 2) Administrator account (blocked from normal sign-up; create once outside the app)
-- Use the Supabase dashboard Auth > Add user, or the Admin API, with:
--   email:    admin.test@kabarak.ac.ke
--   password: KabusAdmin2026!
--   user_metadata: { "full_name": "Test Admin", "requested_role": "administrator" }
-- Then force the administrator role (sign-up trigger refuses this path on purpose):
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin.test@kabarak.ac.ke';
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (admin_id, 'Test Admin', 'admin.test@kabarak.ac.ke')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_id, 'administrator'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
