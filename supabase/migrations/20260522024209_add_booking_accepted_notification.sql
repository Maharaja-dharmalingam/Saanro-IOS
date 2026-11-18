/*
  # Add 'booking_accepted' notification type and update trigger

  ## Summary
  Adds a new notification type for when a mentor accepts a request (status: pending → accepted).
  Updates the trigger to fire for this new transition and for the final payment confirmation
  (accepted → confirmed).

  ## Changes
  - Adds 'booking_accepted' to the notifications type check constraint
  - Updates handle_booking_notification() trigger function to:
    - Notify mentee when booking moves from 'pending' to 'accepted' (mentor approved, awaiting payment)
    - Notify mentee when booking moves from 'accepted' to 'confirmed' (payment received)
    - Notify mentor when booking moves from 'accepted' to 'confirmed'
*/

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('booking_requested', 'booking_accepted', 'booking_confirmed', 'booking_declined', 'booking_cancelled'));

CREATE OR REPLACE FUNCTION handle_booking_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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

DROP TRIGGER IF EXISTS notify_on_booking_change ON bookings;

CREATE TRIGGER notify_on_booking_change
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION handle_booking_notification();
