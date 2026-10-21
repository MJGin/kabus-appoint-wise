-- Run this in the Supabase SQL editor after applying the migrations. Every row should say OK.
-- It only reads; it changes nothing.

SELECT 'second step enforced for Administrator and IT' AS check,
       CASE WHEN pg_get_functiondef('public.current_role_is(public.app_role[])'::regprocedure) ILIKE '%private.current_role_is%'
            THEN 'OK' ELSE 'FAIL: run 20261009120000_restore_second_step.sql' END AS result
UNION ALL
SELECT 'approved student list exists',
       CASE WHEN to_regclass('public.approved_students') IS NOT NULL THEN 'OK'
            ELSE 'FAIL: run 20261010090000_email_classified_signup.sql' END
UNION ALL
SELECT 'sign-up refuses unlisted emails',
       CASE WHEN pg_get_functiondef('public.handle_new_user()'::regprocedure) ILIKE '%not on an approved list%'
            THEN 'OK' ELSE 'FAIL: run 20261012000000_flexible_booking.sql' END
UNION ALL
SELECT 'sign-up cannot create an Administrator',
       CASE WHEN pg_get_functiondef('public.handle_new_user()'::regprocedure) ILIKE '%administrator%'
            THEN 'FAIL: handle_new_user mentions administrator' ELSE 'OK' END
UNION ALL
SELECT 'flexible booking installed',
       CASE WHEN to_regprocedure('public.book_appointment_slot(uuid,uuid,date,public.time_block,time,integer,text)') IS NOT NULL
            THEN 'OK' ELSE 'FAIL: run 20261012000000_flexible_booking.sql' END
UNION ALL
SELECT 'lecturers with no class are free all day',
       CASE WHEN pg_get_functiondef('private.slot_is_free(uuid,uuid,date,public.time_block)'::regprocedure) ILIKE '%IF blk > last_class THEN RETURN true%'
            THEN 'OK' ELSE 'FAIL: run 20261016090000_free_day_without_classes.sql' END
UNION ALL
SELECT 'an active semester covers today',
       CASE WHEN EXISTS (SELECT 1 FROM public.semesters WHERE is_active AND current_date BETWEEN start_date AND end_date)
            THEN 'OK' ELSE 'FAIL: no active semester covers today, so nothing can be booked' END
UNION ALL
SELECT 'every account has a role',
       CASE WHEN NOT EXISTS (SELECT 1 FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id))
            THEN 'OK' ELSE 'FAIL: some accounts have no role: ' || (SELECT string_agg(u.email, ', ') FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)) END
UNION ALL
SELECT 'the special accounts are all there',
       CASE WHEN (SELECT count(DISTINCT role) FROM public.user_roles WHERE role IN ('administrator','it_support','dean')) = 3
            THEN 'OK' ELSE 'FAIL: one of Administrator, IT Support or Dean has no account' END;
