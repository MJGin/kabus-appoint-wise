-- Names on the approved lists, shown in the admin area next to each email
-- and used as the account name when a login is minted for that address.
ALTER TABLE public.approved_staff ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.approved_students ADD COLUMN IF NOT EXISTS full_name text;
