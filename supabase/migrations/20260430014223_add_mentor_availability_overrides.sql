/*
  # Add mentor_availability_overrides table

  ## Summary
  Adds a table to store date-specific availability overrides for mentors.
  This allows mentors to mark specific calendar dates as unavailable (blocked)
  or available with custom hours, overriding their weekly recurring schedule.

  ## New Tables
  ### mentor_availability_overrides
  - `id` - Primary key
  - `mentor_id` - References mentors(id)
  - `override_date` - The specific calendar date (DATE)
  - `is_unavailable` - When true, the mentor is blocked for the whole day
  - `start_hour` / `start_minute` / `duration_minutes` - Optional custom time window
  - `note` - Optional mentor note for the override

  ## Security
  - RLS enabled
  - Mentors can manage only their own overrides
*/

CREATE TABLE IF NOT EXISTS mentor_availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  is_unavailable boolean NOT NULL DEFAULT true,
  start_hour integer CHECK (start_hour BETWEEN 0 AND 23),
  start_minute integer DEFAULT 0 CHECK (start_minute IN (0, 30)),
  duration_minutes integer DEFAULT 60,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (mentor_id, override_date)
);

ALTER TABLE mentor_availability_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors can read own overrides"
  ON mentor_availability_overrides FOR SELECT
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can insert own overrides"
  ON mentor_availability_overrides FOR INSERT
  TO authenticated
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can update own overrides"
  ON mentor_availability_overrides FOR UPDATE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can delete own overrides"
  ON mentor_availability_overrides FOR DELETE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_availability_overrides_mentor ON mentor_availability_overrides(mentor_id);
CREATE INDEX IF NOT EXISTS idx_availability_overrides_date ON mentor_availability_overrides(mentor_id, override_date);
