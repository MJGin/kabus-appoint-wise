-- ========== FIREBASE INTEGRATION ==========
-- Add firebase_uid column to profiles and Firebase-aware functions

-- Add firebase_uid column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS firebase_uid text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS profiles_firebase_uid_idx ON public.profiles (firebase_uid);

-- ========== FIREBASE-AWARE FUNCTIONS ==========

-- Function to check if user has Firebase UID mapped
CREATE OR REPLACE FUNCTION public.is_firebase_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND firebase_uid IS NOT NULL
  );
$$;

-- Function to get Firebase UID for a user
CREATE OR REPLACE FUNCTION public.get_firebase_user_uid(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT firebase_uid FROM public.profiles WHERE user_id = _user_id;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_firebase_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_firebase_user_uid(uuid) TO authenticated;

-- ========== UPDATE RLS POLICIES FOR FIREBASE USERS ==========

-- Profiles policies
DROP POLICY IF EXISTS "own profile read" ON public.profiles;
DROP POLICY IF EXISTS "published staff profiles" ON public.profiles;
DROP POLICY IF EXISTS "oversight profile read" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_firebase_user(auth.uid()));

CREATE POLICY "published staff profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(id, 'lecturer') OR public.is_firebase_user(auth.uid()));

CREATE POLICY "oversight profile read" ON public.profiles FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['administrator','it_support','dean']::public.app_role[]) OR public.is_firebase_user(auth.uid()));

CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Appointments policies
DROP POLICY IF EXISTS "student books own appointment" ON public.appointments;
DROP POLICY IF EXISTS "student cancels own pending" ON public.appointments;
DROP POLICY IF EXISTS "lecturer decides own appointments" ON public.appointments;

CREATE POLICY "student books own appointment" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid() 
    AND (public.has_role(auth.uid(), 'student') OR public.is_firebase_user(auth.uid()))
  );

CREATE POLICY "student cancels own pending" ON public.appointments FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid() 
    AND status = 'pending'
    AND (status = 'cancelled' OR public.is_firebase_user(auth.uid()))
  );

CREATE POLICY "lecturer decides own appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (
    lecturer_id = auth.uid() 
    AND (public.has_role(auth.uid(), 'lecturer') OR public.is_firebase_user(auth.uid()))
  );

-- Appointment reasons policies
DROP POLICY IF EXISTS "only the two parties read the reason" ON public.appointment_reasons;
DROP POLICY IF EXISTS "student writes own reason" ON public.appointment_reasons;

CREATE POLICY "only the two parties read the reason" ON public.appointment_reasons FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id 
      AND (a.student_id = auth.uid() OR a.lecturer_id = auth.uid())
      AND (public.has_role(auth.uid(), 'student') OR public.is_firebase_user(auth.uid()))
    )
  );

CREATE POLICY "student writes own reason" ON public.appointment_reasons FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id 
      AND a.student_id = auth.uid()
      AND (public.has_role(auth.uid(), 'student') OR public.is_firebase_user(auth.uid()))
    )
  );

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION public.is_firebase_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_firebase_user_uid(uuid) TO authenticated;