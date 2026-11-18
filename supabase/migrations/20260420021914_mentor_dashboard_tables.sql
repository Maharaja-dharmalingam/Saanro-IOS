/*
  # Mentor Dashboard Tables

  ## Summary
  Creates all tables needed for the mentor dashboard features:
  mentorship packages, testimonials, availability slots, mentee requests,
  earnings records, mentee notes (CRM), and resource library items.

  ## New Tables

  ### mentorship_packages
  - Mentor-defined service offerings (name, description, price, duration)

  ### testimonials
  - Reviews left by mentees; mentors can feature them on their profile

  ### mentor_availability
  - Weekly recurring time slots set by the mentor (day of week + time range)

  ### mentee_requests
  - Incoming session requests from mentees; mentors accept or decline

  ### earnings
  - Per-session earnings records for the mentor earnings dashboard

  ### mentee_notes
  - Mentor CRM: private notes per mentee, linked to a booking or standalone

  ### resources
  - Files/links uploaded or saved by mentors for their mentees

  ## Security
  - RLS enabled on all tables
  - Mentors can only manage their own records
  - Mentees can read relevant records (requests, testimonials)
*/

-- Mentorship packages
CREATE TABLE IF NOT EXISTS mentorship_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  price_usd numeric(8,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mentorship_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors can manage own packages"
  ON mentorship_packages FOR SELECT
  TO authenticated
  USING (
    mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR true
  );

CREATE POLICY "Mentors can insert own packages"
  ON mentorship_packages FOR INSERT
  TO authenticated
  WITH CHECK (
    mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "Mentors can update own packages"
  ON mentorship_packages FOR UPDATE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can delete own packages"
  ON mentorship_packages FOR DELETE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

-- Testimonials (sourced from completed bookings)
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  mentee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content text NOT NULL DEFAULT '',
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read testimonials"
  ON testimonials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Mentees can insert testimonials"
  ON testimonials FOR INSERT
  TO authenticated
  WITH CHECK (mentee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Mentors can update featured flag on own testimonials"
  ON testimonials FOR UPDATE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

-- Mentor availability (weekly recurring slots)
CREATE TABLE IF NOT EXISTS mentor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_hour integer NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  start_minute integer NOT NULL DEFAULT 0 CHECK (start_minute IN (0, 30)),
  duration_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mentor_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors can manage own availability"
  ON mentor_availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Mentors can insert own availability"
  ON mentor_availability FOR INSERT
  TO authenticated
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can update own availability"
  ON mentor_availability FOR UPDATE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can delete own availability"
  ON mentor_availability FOR DELETE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

-- Mentee requests
CREATE TABLE IF NOT EXISTS mentee_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  mentee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  preferred_time text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mentee_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors can read own requests"
  ON mentee_requests FOR SELECT
  TO authenticated
  USING (
    mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR mentee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Mentees can insert requests"
  ON mentee_requests FOR INSERT
  TO authenticated
  WITH CHECK (mentee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Mentors can update request status"
  ON mentee_requests FOR UPDATE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

-- Earnings records
CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  amount_usd numeric(8,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded')),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors can read own earnings"
  ON earnings FOR SELECT
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can insert own earnings"
  ON earnings FOR INSERT
  TO authenticated
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can update own earnings"
  ON earnings FOR UPDATE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

-- Mentee notes (CRM)
CREATE TABLE IF NOT EXISTS mentee_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  mentee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mentee_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors can manage own notes"
  ON mentee_notes FOR SELECT
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can insert own notes"
  ON mentee_notes FOR INSERT
  TO authenticated
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can update own notes"
  ON mentee_notes FOR UPDATE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can delete own notes"
  ON mentee_notes FOR DELETE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

-- Resource library
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  resource_type text NOT NULL DEFAULT 'link' CHECK (resource_type IN ('link', 'file')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors and mentees can read resources"
  ON resources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Mentors can insert own resources"
  ON resources FOR INSERT
  TO authenticated
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can update own resources"
  ON resources FOR UPDATE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Mentors can delete own resources"
  ON resources FOR DELETE
  TO authenticated
  USING (mentor_id IN (SELECT id FROM mentors WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mentorship_packages_mentor ON mentorship_packages(mentor_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_mentor ON testimonials(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_availability_mentor ON mentor_availability(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentee_requests_mentor ON mentee_requests(mentor_id);
CREATE INDEX IF NOT EXISTS idx_earnings_mentor ON earnings(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentee_notes_mentor ON mentee_notes(mentor_id);
CREATE INDEX IF NOT EXISTS idx_resources_mentor ON resources(mentor_id);
