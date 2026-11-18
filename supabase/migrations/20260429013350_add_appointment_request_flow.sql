/*
  # Appointment Request Flow

  ## Summary
  Adds support for the appointment request flow where mentees request a specific
  date/time and mentors accept or decline. On acceptance the booking is confirmed
  and the time slot becomes unavailable to others.

  ## Changes

  ### bookings table
  - Add `requested_at` timestamptz column — the date/time the mentee requested
  - Add `mentee_message` text column — optional message from mentee with request

  ### time_slots table
  - Ensure `is_booked` default is false (already exists, no change needed)

  ## Notes
  - Existing rows are unaffected; new columns have safe defaults
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'requested_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN requested_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'mentee_message'
  ) THEN
    ALTER TABLE bookings ADD COLUMN mentee_message text NOT NULL DEFAULT '';
  END IF;
END $$;
