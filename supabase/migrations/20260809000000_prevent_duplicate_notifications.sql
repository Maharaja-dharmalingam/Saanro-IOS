-- Remove duplicate booking notifications, keeping the oldest row per (booking_id, type, user_id)
DELETE FROM notifications a USING notifications b
WHERE a.id > b.id
  AND a.booking_id = b.booking_id
  AND a.type = b.type
  AND a.user_id = b.user_id;

-- Prevent future duplicates at the DB level
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_booking_type_user_unique;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_booking_type_user_unique
  UNIQUE (booking_id, type, user_id);

-- Idempotent trigger function: one notification per (booking, type, recipient)
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
      ) ON CONFLICT ON CONSTRAINT notifications_booking_type_user_unique DO NOTHING;
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
      ) ON CONFLICT ON CONSTRAINT notifications_booking_type_user_unique DO NOTHING;
    END IF;
    IF (v_mentor_prefs ->> 'booking_updates')::boolean THEN
      INSERT INTO notifications(user_id, type, title, body, booking_id)
      VALUES (
        v_mentor_profile_id,
        'booking_confirmed',
        'Payment Received',
        v_mentee_name || '''s session on ' || v_scheduled_at || ' is confirmed. Payment has been received.',
        NEW.id
      ) ON CONFLICT ON CONSTRAINT notifications_booking_type_user_unique DO NOTHING;
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
      ) ON CONFLICT ON CONSTRAINT notifications_booking_type_user_unique DO NOTHING;
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
      ) ON CONFLICT ON CONSTRAINT notifications_booking_type_user_unique DO NOTHING;
    END IF;
    IF (v_mentor_prefs ->> 'booking_updates')::boolean THEN
      INSERT INTO notifications(user_id, type, title, body, booking_id)
      VALUES (
        v_mentor_profile_id,
        'booking_cancelled',
        'Session Cancelled',
        'Your session with ' || v_mentee_name || ' on ' || v_scheduled_at || ' has been cancelled.',
        NEW.id
      ) ON CONFLICT ON CONSTRAINT notifications_booking_type_user_unique DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_booking_notification() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS notify_on_booking_change ON bookings;
CREATE TRIGGER notify_on_booking_change
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_booking_notification();
