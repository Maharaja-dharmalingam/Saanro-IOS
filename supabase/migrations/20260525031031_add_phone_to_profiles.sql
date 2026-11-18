/*
  # Add phone number to profiles

  1. Changes
    - `profiles`: adds `phone` column (text, nullable) to store the user's verified phone number

  2. Notes
    - Phone is collected during registration and verified via Supabase phone OTP (SMS)
    - Nullable because existing users don't have a phone number yet
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text DEFAULT NULL;
  END IF;
END $$;
