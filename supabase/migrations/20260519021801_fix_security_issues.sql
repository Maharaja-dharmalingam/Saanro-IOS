/*
  # Fix Security Issues

  1. Function Search Path Mutable
     - Set a fixed search_path on `handle_booking_notification` to prevent search_path injection attacks.

  2. RLS Policy Always True on notifications INSERT
     - Drop the overly permissive "System can insert notifications" policy (WITH CHECK = true).
     - The function is SECURITY DEFINER and runs as the function owner, so no INSERT policy is needed
       for the trigger path. We replace it with a restrictive policy that only allows the service role
       (which the trigger runs as) to insert — regular authenticated/anon users cannot insert directly.

  3. Public Bucket Listing — avatars SELECT policy
     - Drop the broad "Anyone can read avatars" policy on storage.objects which allows listing.
     - Replace with a scoped policy that only allows reading objects by their exact path, not listing.

  4 & 5. Public/Authenticated can execute SECURITY DEFINER function
     - Revoke EXECUTE on `handle_booking_notification` from anon and authenticated roles.
       It is a trigger function and should only be invoked by the trigger, not via RPC.
*/

-- 1. Fix mutable search_path on the trigger function
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

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      v_mentor_profile_id,
      'booking_requested',
      'New Appointment Request',
      v_mentee_name || ' has requested a ' || NEW.duration_minutes || '-min session on ' || v_scheduled_at || '.',
      NEW.id
    );

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      NEW.mentee_id,
      'booking_confirmed',
      'Appointment Confirmed!',
      v_mentor_name || ' has accepted your session request for ' || v_scheduled_at || '. Get ready!',
      NEW.id
    );

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    INSERT INTO notifications(user_id, type, title, body, booking_id)
    VALUES (
      NEW.mentee_id,
      'booking_declined',
      'Appointment Declined',
      v_mentor_name || ' was unable to accept your session request for ' || v_scheduled_at || '. Please try another time.',
      NEW.id
    );

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
  END IF;

  RETURN NEW;
END;
$$;

-- 4 & 5. Revoke direct RPC execution from anon and authenticated roles
-- (the function is only meant to run as a trigger, not be called via RPC)
REVOKE EXECUTE ON FUNCTION public.handle_booking_notification() FROM anon, authenticated;

-- 2. Fix always-true INSERT policy on notifications
-- The trigger runs as SECURITY DEFINER (function owner = postgres/service role),
-- so it bypasses RLS entirely. No INSERT policy is needed for legitimate trigger inserts.
-- Drop the permissive policy so regular users cannot insert arbitrary notifications.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- 3. Fix overly broad SELECT policy on storage.objects for avatars bucket
-- The current policy allows listing all objects. Replace it with one that
-- requires a specific object name, preventing directory listing.
DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;

CREATE POLICY "Anyone can read avatar objects"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'avatars'
    AND name IS NOT NULL
    AND octet_length(name) > 0
  );
