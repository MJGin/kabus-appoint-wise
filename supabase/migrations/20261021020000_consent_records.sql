-- =====================================================================================
-- Participation consent (KABUSlotIn consent form, August 2026).
-- Records are append-only: every decision (consent / decline / withdraw) is a new row and the
-- newest row is the person's current position. Nobody can insert, edit or delete rows directly;
-- the only way in is public.record_consent(), which takes identity from the login session, so a
-- user cannot record consent on someone else's behalf or back-date a record.
-- =====================================================================================
CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_version text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('consent','decline','withdraw')),
  participant_category text NOT NULL CHECK (participant_category IN ('student','staff')),
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 200),
  email text NOT NULL,
  age_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_requires_age CHECK (decision <> 'consent' OR age_confirmed)
);
CREATE INDEX consent_records_user_latest ON public.consent_records (user_id, created_at DESC);

GRANT SELECT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own consent records" ON public.consent_records FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "administrator reads consent records" ON public.consent_records FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['administrator']::public.app_role[]));

CREATE OR REPLACE FUNCTION public.record_consent(
  _decision text,
  _form_version text,
  _full_name text,
  _age_confirmed boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  mail text;
  category text;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;
  IF _decision NOT IN ('consent','decline','withdraw') THEN
    RAISE EXCEPTION 'Unknown decision.';
  END IF;
  IF _form_version IS NULL OR btrim(_form_version) = '' THEN
    RAISE EXCEPTION 'Missing form version.';
  END IF;
  IF _decision = 'consent' AND NOT COALESCE(_age_confirmed, false) THEN
    RAISE EXCEPTION 'You must confirm you are 18 or older to consent.';
  END IF;
  IF _decision = 'withdraw' AND NOT EXISTS (
    SELECT 1 FROM public.consent_records WHERE user_id = uid AND decision = 'consent'
  ) THEN
    RAISE EXCEPTION 'There is no consent to withdraw.';
  END IF;

  SELECT u.email INTO mail FROM auth.users u WHERE u.id = uid;
  category := CASE WHEN public.has_role(uid, 'student') THEN 'student' ELSE 'staff' END;

  INSERT INTO public.consent_records
    (user_id, form_version, decision, participant_category, full_name, email, age_confirmed)
  VALUES
    (uid, btrim(_form_version), _decision, category, btrim(_full_name), lower(mail),
     _decision = 'consent' AND COALESCE(_age_confirmed, false))
  RETURNING id INTO new_id;

  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, category, details)
  VALUES (uid, 'consent_' || _decision, 'consent_record', new_id, 'operational',
          jsonb_build_object('form_version', btrim(_form_version)));

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_consent(text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_consent(text, text, text, boolean) TO authenticated;
