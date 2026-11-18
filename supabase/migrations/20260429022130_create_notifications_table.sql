/*
  # Create Notifications Table

  ## Summary
  Adds a notifications table to support in-app booking notifications for both
  mentees and mentors. Notifications are created automatically via database
  triggers whenever a booking changes state.

  ## New Tables

  ### notifications
  - `id` (uuid, primary key)
  - `user_id` (uuid) — the profile.id of the recipient
  - `type` (text) — one of: booking_requested, booking_confirmed, booking_declined, booking_cancelled
  - `title` (text) — short heading shown in the notification
  - `body` (text) — fuller description
  - `booking_id` (uuid, nullable) — link back to the relevant booking
  - `is_read` (boolean, default false)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled; users can only read/update their own notifications

  ## Triggers
  - `notify_on_booking_change` fires AFTER INSERT OR UPDATE on bookings
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('booking_requested', 'booking_confirmed', 'booking_declined', 'booking_cancelled')),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Trigger function: fires on booking insert or status update
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

DROP TRIGGER IF EXISTS notify_on_booking_change ON bookings;

CREATE TRIGGER notify_on_booking_change
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION handle_booking_notification();
