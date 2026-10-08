-- ===========================================
-- NOTIFICATIONS TABLE
-- ===========================================

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins and IT support can see all notifications
CREATE POLICY "oversight notifications" ON public.notifications FOR SELECT TO authenticated
  USING (public.current_role_is(ARRAY['administrator','it_support']::public.app_role[]));

-- Trigger function to create notifications on appointment events
CREATE OR REPLACE FUNCTION public.notify_appointment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_type text;
  n_title text;
  n_body text;
  student RECORD;
  lecturer RECORD;
BEGIN
  -- Get student and lecturer info
  SELECT full_name INTO student FROM public.profiles WHERE id = NEW.student_id;
  SELECT full_name INTO lecturer FROM public.profiles WHERE id = NEW.lecturer_id;

  IF (TG_OP = 'INSERT') THEN
    -- New appointment request
    n_type := 'appointment_requested';
    n_title := 'New appointment request';
    n_body := student.full_name || ' requested an appointment for ' || to_char(NEW.appt_date, 'Mon DD, YYYY') || ' at ' || NEW.block;
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (NEW.lecturer_id, n_type, n_title, n_body);
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.status != NEW.status) THEN
      IF (NEW.status = 'accepted') THEN
        n_type := 'appointment_accepted';
        n_title := 'Appointment accepted';
        n_body := lecturer.full_name || ' accepted your appointment for ' || to_char(NEW.appt_date, 'Mon DD, YYYY') || ' at ' || NEW.block;
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (NEW.student_id, n_type, n_title, n_body);
      ELSIF (NEW.status = 'declined') THEN
        n_type := 'appointment_declined';
        n_title := 'Appointment declined';
        n_body := lecturer.full_name || ' declined your appointment for ' || to_char(NEW.appt_date, 'Mon DD, YYYY') || ' at ' || NEW.block;
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (NEW.student_id, n_type, n_title, n_body);
      ELSIF (NEW.status = 'cancelled') THEN
        n_type := 'appointment_cancelled';
        n_title := 'Appointment cancelled';
        n_body := student.full_name || ' cancelled the appointment for ' || to_char(NEW.appt_date, 'Mon DD, YYYY') || ' at ' || NEW.block;
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (NEW.lecturer_id, n_type, n_title, n_body);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on appointments table
CREATE TRIGGER trigger_notify_appointment_change
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_change();

-- Index for performance
CREATE INDEX idx_notifications_user_read ON public.notifications (user_id, read);
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);