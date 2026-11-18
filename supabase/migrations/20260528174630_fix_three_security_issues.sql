/*
  # Fix three security issues

  ## 1. mentors_public view — remove SECURITY DEFINER property
  The view was created with `security_barrier = true` but without explicitly
  setting `security_invoker = true`, causing scanners to flag it as SECURITY DEFINER
  (Postgres default for views). Re-create it with `security_invoker = true` so it
  runs as the calling user. The `security_barrier` option already prevents predicate
  pushdown leaks; no SECURITY DEFINER escalation is needed or wanted here.

  ## 2. handle_booking_notification — pin search_path
  The latest version of this function (recreated in migration
  20260522024209_add_booking_accepted_notification.sql) lost the
  `SET search_path = public` clause that was added in
  20260519021801_fix_security_issues.sql. A mutable search_path on a
  SECURITY DEFINER function can be exploited via schema-injection. Re-create
  the function body unchanged but with the fixed search_path restored.

  ## 3. time_slots INSERT policy — replace always-true WITH CHECK
  The policy "Authenticated users can insert time slots for booking" used
  `WITH CHECK (true)`, which lets any authenticated user insert arbitrary rows.
  Replace it with a real check: the `mentor_id` on the new row must reference
  an existing mentor, and the inserting user must have a profile record
  (i.e. they are a real app user, not just any JWT holder).
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Re-create mentors_public as SECURITY INVOKER (explicit, not default)
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.mentors_public;

CREATE VIEW public.mentors_public
  WITH (security_barrier = true, security_invoker = true)
AS
  SELECT
    id,
    profile_id,
    industry,
    expertise,
    tamil_proficiency,
    years_experience,
    session_price_30min,
    session_price_60min,
    rating,
    total_sessions,
    is_available,
    languages,
    headline,
    created_at
  FROM public.mentors;

GRANT SELECT ON public.mentors_public TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Re-create handle_booking_notification with fixed search_path
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_booking_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mentor_profile_id uuid;
  v_mentee_name text;
  v_mentor_name text;
  v_scheduled_at text;
BEGIN
  SELECT profile_id INTO v_mentor_profile_id
  FROM mentors WHERE id = NEW.mentor_id;

  SELECT full_name INTO v_mentee_name
  FROM profiles WHERE id = NEW.mentee_id;

  SELECT full_name INTO v_mentor_name
  FROM profiles WHERE id = v_mentor_profile_id;

  v_scheduled_at := to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'Mon DD, YYYY at HH12:MI AM') || ' UTC';

  -- New request submitted
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      v_mentor_profile_id,
      'booking_requested',
      'New Appointment Request',
      v_mentee_name || ' has requested a ' || NEW.duration_minutes || '-min session on ' || v_scheduled_at || '.',
      NEW.id
    );

  -- Mentor accepted → awaiting mentee payment
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      NEW.mentee_id,
      'booking_accepted',
      'Request Accepted — Pay Now',
      v_mentor_name || ' has accepted your request for ' || v_scheduled_at || '. Complete payment to confirm your session.',
      NEW.id
    );

  -- Payment completed → session confirmed
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'accepted' AND NEW.status = 'confirmed' THEN
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      NEW.mentee_id,
      'booking_confirmed',
      'Session Confirmed!',
      'Your session with ' || v_mentor_name || ' on ' || v_scheduled_at || ' is confirmed. Get ready!',
      NEW.id
    );
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      v_mentor_profile_id,
      'booking_confirmed',
      'Payment Received',
      v_mentee_name || '''s session on ' || v_scheduled_at || ' is confirmed. Payment has been received.',
      NEW.id
    );

  -- Mentor declined
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      NEW.mentee_id,
      'booking_declined',
      'Appointment Declined',
      v_mentor_name || ' was unable to accept your session request for ' || v_scheduled_at || '. Please try another time.',
      NEW.id
    );

  -- Confirmed session cancelled
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      NEW.mentee_id,
      'booking_cancelled',
      'Session Cancelled',
      'Your confirmed session with ' || v_mentor_name || ' on ' || v_scheduled_at || ' has been cancelled.',
      NEW.id
    );
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      v_mentor_profile_id,
      'booking_cancelled',
      'Session Cancelled',
      'Your session with ' || v_mentee_name || ' on ' || v_scheduled_at || ' has been cancelled.',
      NEW.id
    );

  -- Accepted (unpaid) request cancelled by mentee
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'accepted' AND NEW.status = 'cancelled' THEN
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      v_mentor_profile_id,
      'booking_cancelled',
      'Booking Cancelled',
      v_mentee_name || ' cancelled their accepted session on ' || v_scheduled_at || '.',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure execute is still revoked (idempotent re-application)
REVOKE EXECUTE ON FUNCTION public.handle_booking_notification() FROM anon, authenticated, PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Replace the always-true INSERT policy on time_slots
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can insert time slots for booking" ON public.time_slots;

-- An authenticated user may insert a time slot only when:
--   a) the mentor_id references a real mentor row, AND
--   b) the inserting user has a profile record in the app (is a real user, not just a JWT)
CREATE POLICY "Authenticated users can insert time slots for booking"
  ON public.time_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.mentors WHERE id = time_slots.mentor_id)
    AND
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
  );
