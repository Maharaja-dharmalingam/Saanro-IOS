/*
  # Add unique constraint on mentors.profile_id

  Ensures one mentor row per profile to prevent duplicate entries causing query failures.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mentors_profile_id_key'
  ) THEN
    ALTER TABLE mentors ADD CONSTRAINT mentors_profile_id_key UNIQUE (profile_id);
  END IF;
END $$;
