/*
  # Add meeting_link column to bookings

  1. Changes
    - Adds `meeting_link` (text, nullable) column to the `bookings` table if it doesn't already exist
    - This stores a Google Meet (or any video call) URL that the mentor provides when accepting a booking

  2. Notes
    - Column is nullable — not every booking requires a link upfront
    - No RLS changes needed; bookings table policies already cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'meeting_link'
  ) THEN
    ALTER TABLE bookings ADD COLUMN meeting_link text DEFAULT '';
  END IF;
END $$;
