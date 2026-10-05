REVOKE SELECT ON public.staff_listings FROM authenticated;
GRANT SELECT (id, full_name, title, department, bio, photo_url, office_location, user_id) ON public.staff_listings TO authenticated;