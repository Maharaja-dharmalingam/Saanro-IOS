/*
  # Add preferred_currency to profiles

  1. Changes
    - `profiles`: add `preferred_currency` column (text, default 'USD')
      Stores the user's explicitly chosen currency code (e.g., 'INR', 'CAD').
      When set, this overrides the location-derived currency on the profile page.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'preferred_currency'
  ) THEN
    ALTER TABLE profiles ADD COLUMN preferred_currency text DEFAULT 'USD';
  END IF;
END $$;
