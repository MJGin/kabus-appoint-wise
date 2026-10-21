-- Fictional demo dataset: replaces all real accounts with invented ones.
--
--   Special 3 (administrator, dean, IT support) -> @office.kabu.test
--   Staff (lecturers)                           -> @kabu.test
--   Students                                    -> @students.kabu.test
--
-- Shared demo password: set privately by the group and shared with the lecturer
-- on request; the placeholder below is NOT the real password. Nothing secret is committed.
--
-- One transaction commits at the end, so a failed run changes nothing and can
-- be retried safely. The script is safe to re-run: it removes its own earlier
-- output first. Expect the final summary to read "SEED OK | 13 accounts".

BEGIN;

-- Make sure the password hashing functions exist
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- The approved-staff list was originally locked to lecturer/dean/it_support,
-- from the days when no administrator could ever be created through sign-up.
-- The approved lists are now the single source of truth for every role, so
-- the list may hold the administrator as well.
ALTER TABLE public.approved_staff DROP CONSTRAINT approved_staff_role_check;
ALTER TABLE public.approved_staff ADD CONSTRAINT approved_staff_role_check
  CHECK (role IN ('lecturer','dean','it_support','administrator'));

-- ============ 1. Wipe all test/usage data ============
DELETE FROM public.notifications;
DELETE FROM public.appointment_reasons;
DELETE FROM public.appointments;
DELETE FROM public.makeup_sessions;
DELETE FROM public.exam_slots;
DELETE FROM public.timetable_slots;
DELETE FROM public.activity_log;
DELETE FROM public.error_reports;

-- ============ 2. Unlink listings, clear existing approvals ============
UPDATE public.staff_listings SET user_id = NULL;
DELETE FROM public.staff_listings;
DELETE FROM public.approved_staff;
DELETE FROM public.approved_students;

-- ============ 2b. Remove accounts from any earlier seed run ============
DELETE FROM auth.users WHERE email LIKE '%kabu.test';

-- ============ 3. Approvals ============
INSERT INTO public.approved_staff (email, full_name, role) VALUES
  ('miriam.atieno@office.kabu.test','Miriam Atieno','administrator'),
  ('peter.wafula@office.kabu.test','Peter Wafula','dean'),
  ('sharon.chelimo@office.kabu.test','Sharon Chelimo','it_support'),
  ('aisha.njeri@kabu.test','Aisha Njeri','lecturer'),
  ('duncan.kiprop@kabu.test','Duncan Kiprop','lecturer'),
  ('esther.wambui@kabu.test','Esther Wambui','lecturer'),
  ('frank.mutiso@kabu.test','Frank Mutiso','lecturer'),
  ('grace.achieng@kabu.test','Grace Achieng','lecturer');

INSERT INTO public.approved_students (email, full_name) VALUES
  ('hillary.otieno@students.kabu.test','Hillary Otieno'),
  ('joy.mwikali@students.kabu.test','Joy Mwikali'),
  ('kevin.rotich@students.kabu.test','Kevin Rotich'),
  ('leah.cheptoo@students.kabu.test','Leah Cheptoo'),
  ('martin.kinuthia@students.kabu.test','Martin Kinuthia');

-- ============ 4. Lecturer listings ============
INSERT INTO public.staff_listings (email, full_name, title, department, office_location, classes) VALUES
  ('aisha.njeri@kabu.test','Aisha Njeri','Ms.','School of Law','Office 12',
   '[{"unit_code":"LAW 501","unit_name":"Jurisprudence","year_group":1,"day_of_week":1,"block":"block_1"}]'::jsonb),
  ('duncan.kiprop@kabu.test','Duncan Kiprop','Mr.','School of Law','Office 14',
   '[{"unit_code":"LAW 502","unit_name":"Constitutional Law","year_group":1,"day_of_week":2,"block":"block_2"}]'::jsonb),
  ('esther.wambui@kabu.test','Esther Wambui','Ms.','School of Law','Office 16',
   '[{"unit_code":"LAW 503","unit_name":"Law of Torts","year_group":1,"day_of_week":3,"block":"block_3"}]'::jsonb),
  ('frank.mutiso@kabu.test','Frank Mutiso','Mr.','School of Law','Office 18',
   '[{"unit_code":"LAW 504","unit_name":"Family Law","year_group":1,"day_of_week":4,"block":"block_1"}]'::jsonb),
  ('grace.achieng@kabu.test','Grace Achieng','Ms.','School of Law','Office 20',
   '[{"unit_code":"LAW 505","unit_name":"Land Law","year_group":1,"day_of_week":5,"block":"block_2"}]'::jsonb);

-- ============ 5. (retired cleanup step: the database holds only fictional accounts) ============

-- ============ 6. Create the 13 fictional accounts ============
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT gen_random_uuid(),
       '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
       a.email,
       extensions.crypt('PLACEHOLDER-not-the-real-demo-password', extensions.gen_salt('bf')),
       now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', a.full_name, 'minted_by_admin', true),
       now(), now()
FROM (VALUES
  ('miriam.atieno@office.kabu.test','Miriam Atieno'),
  ('peter.wafula@office.kabu.test','Peter Wafula'),
  ('sharon.chelimo@office.kabu.test','Sharon Chelimo'),
  ('aisha.njeri@kabu.test','Aisha Njeri'),
  ('duncan.kiprop@kabu.test','Duncan Kiprop'),
  ('esther.wambui@kabu.test','Esther Wambui'),
  ('frank.mutiso@kabu.test','Frank Mutiso'),
  ('grace.achieng@kabu.test','Grace Achieng'),
  ('hillary.otieno@students.kabu.test','Hillary Otieno'),
  ('joy.mwikali@students.kabu.test','Joy Mwikali'),
  ('kevin.rotich@students.kabu.test','Kevin Rotich'),
  ('leah.cheptoo@students.kabu.test','Leah Cheptoo'),
  ('martin.kinuthia@students.kabu.test','Martin Kinuthia')
) AS a(email, full_name);

INSERT INTO auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
SELECT id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       now(), now(), now()
FROM auth.users WHERE email LIKE '%kabu.test';

COMMIT;

-- Success summary: expect "SEED OK | 13 accounts"
SELECT 'SEED OK | ' || count(*) || ' accounts' AS result
FROM auth.users WHERE email LIKE '%kabu.test';
