-- ============================================================
-- Notification preferences + device token support
-- ============================================================

-- Store the user's per-category notification preferences as a JSON blob.
-- Keys map 1:1 to the toggles in NotificationsScreen:
--   session_reminders, booking_updates, new_messages,
--   reviews_ratings, announcements
-- Default: everything enabled.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT
    '{"session_reminders": true, "booking_updates": true, "new_messages": true, "reviews_ratings": true, "announcements": true}'::jsonb;

-- Device push token (set by the app after the user grants permission).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS device_token text DEFAULT NULL;

-- Make the booking-notification trigger respect the recipient's
-- "booking_updates" preference so a user who turns it off receives nothing.
CREATE OR REPLACE FUNCTION handle_booking_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mentor_profile_id uuid;
  v_mentee_name text;
  v_mentor_name text;
  v_scheduled_at text;
  v_mentee_prefs jsonb;
  v_mentor_prefs jsonb;
BEGIN
  SELECT profile_id INTO v_mentor_profile_id
  FROM mentors WHERE id = NEW.mentor_id;

  SELECT full_name INTO v_mentee_name
  FROM profiles WHERE id = NEW.mentee_id;

  SELECT full_name INTO v_mentor_name
  FROM profiles WHERE id = v_mentor_profile_id;

  v_scheduled_at := to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'Mon DD, YYYY at HH12:MI AM') || ' UTC';

  -- Fetch recipient preferences (default all-true if missing).
  SELECT notification_preferences INTO v_mentee_prefs
  FROM profiles WHERE id = NEW.mentee_id;
  v_mentee_prefs := COALESCE(v_mentee_prefs,
    '{"session_reminders": true, "booking_updates": true, "new_messages": true, "reviews_ratings": true, "announcements": true}'::jsonb);

  SELECT notification_preferences INTO v_mentor_prefs
  FROM profiles WHERE id = v_mentor_profile_id;
  v_mentor_prefs := COALESCE(v_mentor_prefs,
    '{"session_reminders": true, "booking_updates": true, "new_messages": true, "reviews_ratings": true, "announcements": true}'::jsonb);

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    IF (v_mentor_prefs ->> 'booking_updates')::boolean THEN
      INSERT INTO notifications(user_id, type, title, body, booking_id)
      VALUES (
        v_mentor_profile_id,
        'booking_requested',
        'New Appointment Request',
        v_mentee_name || ' has requested a ' || NEW.duration_minutes || '-min session on ' || v_scheduled_at || '.',
        NEW.id
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    IF (v_mentee_prefs ->> 'booking_updates')::boolean THEN
      INSERT INTO notifications(user_id, type, title, body, booking_id)
      VALUES (
        NEW.mentee_id,
        'booking_confirmed',
        'Appointment Confirmed!',
        v_mentor_name || ' has accepted your session request for ' || v_scheduled_at || '. Get ready!',
        NEW.id
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    IF (v_mentee_prefs ->> 'booking_updates')::boolean THEN
      INSERT INTO notifications(user_id, type, title, body, booking_id)
      VALUES (
        NEW.mentee_id,
        'booking_declined',
        'Appointment Declined',
        v_mentor_name || ' was unable to accept your session request for ' || v_scheduled_at || '. Please try another time.',
        NEW.id
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
    IF (v_mentee_prefs ->> 'booking_updates')::boolean THEN
      INSERT INTO notifications(user_id, type, title, body, booking_id)
      VALUES (
        NEW.mentee_id,
        'booking_cancelled',
        'Session Cancelled',
        'Your confirmed session with ' || v_mentor_name || ' on ' || v_scheduled_at || ' has been cancelled.',
        NEW.id
      );
    END IF;
    IF (v_mentor_prefs ->> 'booking_updates')::boolean THEN
      INSERT INTO notifications(user_id, type, title, body, booking_id)
      VALUES (
        v_mentor_profile_id,
        'booking_cancelled',
        'Session Cancelled',
        'Your session with ' || v_mentee_name || ' on ' || v_scheduled_at || ' has been cancelled.',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_booking_change ON bookings;
CREATE TRIGGER notify_on_booking_change
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION handle_booking_notification();
