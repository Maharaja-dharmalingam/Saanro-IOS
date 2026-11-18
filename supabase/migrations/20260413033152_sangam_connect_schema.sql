
/*
  # Sangam Connect – Cultural Mentorship Platform Schema

  ## Summary
  Full schema for the Sangam Connect platform connecting Tamil mentors and mentees globally.

  ## New Tables

  ### 1. profiles
  - Linked optionally to auth.users (nullable user_id for demo seeding)
  - Stores role (mentor/mentee), native region, dialect, bio, avatar

  ### 2. mentors
  - Mentor-specific metadata: industry, expertise array, Tamil proficiency level
  - Ratings, session pricing, availability flag

  ### 3. time_slots
  - Availability slots set by mentors (30 or 60 minute blocks)
  - Timezone stored as IANA text

  ### 4. bookings
  - Links mentee profile → mentor → time_slot
  - Status lifecycle: pending → confirmed → completed | cancelled

  ### 5. questions
  - Pre-session "Question Box" threads linked to a booking

  ### 6. thirukkurals
  - Classical Tamil proverbs for "Word of the Day" dashboard feature

  ## Security
  - RLS enabled on all tables with appropriate policies
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  role text NOT NULL CHECK (role IN ('mentor', 'mentee')),
  avatar_url text,
  native_region text DEFAULT '',
  primary_dialect text DEFAULT 'Casual',
  bio text DEFAULT '',
  location text DEFAULT '',
  linkedin_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- MENTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  industry text NOT NULL DEFAULT 'Technology',
  expertise text[] NOT NULL DEFAULT '{}',
  tamil_proficiency text NOT NULL DEFAULT 'Casual' CHECK (tamil_proficiency IN ('Formal', 'Casual', 'Both')),
  years_experience integer DEFAULT 0,
  session_price_30min integer DEFAULT 0,
  session_price_60min integer DEFAULT 0,
  rating numeric(3,2) DEFAULT 4.5,
  total_sessions integer DEFAULT 0,
  is_available boolean DEFAULT true,
  languages text[] DEFAULT '{"Tamil","English"}',
  headline text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mentors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available mentors"
  ON mentors FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated mentors can insert own record"
  ON mentors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Mentors can update own record"
  ON mentors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_id
      AND profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- ============================================================
-- TIME SLOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid REFERENCES mentors(id) ON DELETE CASCADE NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (30, 60)),
  is_booked boolean DEFAULT false,
  timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view time slots"
  ON time_slots FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Mentors can insert own time slots"
  ON time_slots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mentors m
      JOIN profiles p ON p.id = m.profile_id
      WHERE m.id = mentor_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Mentors can update own time slots"
  ON time_slots FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mentors m
      JOIN profiles p ON p.id = m.profile_id
      WHERE m.id = mentor_id
      AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mentors m
      JOIN profiles p ON p.id = m.profile_id
      WHERE m.id = mentor_id
      AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id uuid REFERENCES profiles(id) NOT NULL,
  mentor_id uuid REFERENCES mentors(id) NOT NULL,
  time_slot_id uuid REFERENCES time_slots(id),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (30, 60)),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  meeting_link text DEFAULT '',
  notes text DEFAULT '',
  mentee_timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    mentee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    mentor_id IN (
      SELECT m.id FROM mentors m
      JOIN profiles p ON p.id = m.profile_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Mentees can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    mentee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Participants can update booking status"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    mentee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    mentor_id IN (
      SELECT m.id FROM mentors m
      JOIN profiles p ON p.id = m.profile_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    mentee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    mentor_id IN (
      SELECT m.id FROM mentors m
      JOIN profiles p ON p.id = m.profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- ============================================================
-- QUESTIONS (Pre-session Discussion Threads)
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES profiles(id) NOT NULL,
  content text NOT NULL,
  is_answered boolean DEFAULT false,
  answer text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking participants can view questions"
  ON questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
      AND (
        b.mentee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR b.mentor_id IN (
          SELECT m.id FROM mentors m
          JOIN profiles p ON p.id = m.profile_id
          WHERE p.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Booking participants can insert questions"
  ON questions FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
      AND (
        b.mentee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR b.mentor_id IN (
          SELECT m.id FROM mentors m
          JOIN profiles p ON p.id = m.profile_id
          WHERE p.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Authors can update own questions"
  ON questions FOR UPDATE
  TO authenticated
  USING (author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================================
-- THIRUKKURALS
-- ============================================================
CREATE TABLE IF NOT EXISTS thirukkurals (
  id integer PRIMARY KEY,
  kural_number integer UNIQUE NOT NULL,
  tamil_text text NOT NULL,
  transliteration text NOT NULL,
  english_meaning text NOT NULL,
  career_application text NOT NULL,
  chapter text NOT NULL
);

ALTER TABLE thirukkurals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view thirukkurals"
  ON thirukkurals FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO thirukkurals (id, kural_number, tamil_text, transliteration, english_meaning, career_application, chapter)
VALUES
  (1, 1, 'அகர முதல எழுத்தெல்லாம் ஆதி பகவன் முதற்றே உலகு', 'Agara mudala ezhuttellam aadhi bhagavan mudatre ulagu', 'As the letter A is the first of all letters, so the eternal God is first in the world.', 'Every great career starts with a single foundational skill. Master your fundamentals before building complexity.', 'The Praise of God'),
  (2, 2, 'கற்க கசடறக் கற்பவை கற்றபின் நிற்க அதற்குத் தக', 'Karka kasadarak karpavai katrappin nirka adharku thaka', 'Learn thoroughly what ought to be learned, and live accordingly.', 'Continuous learning is not optional — it is the bedrock of every thriving career. Commit to mastery, not mediocrity.', 'The Praise of Learning'),
  (3, 6, 'தனக்குவமை இல்லாதான் தாள்சேர்ந்தார்க் கல்லால் மனக்கவலை மாற்றல் அரிது', 'Thanakkuvamai illadhaan thaalserndhaarkku allaal manakkavalai maatral aridhu', 'None can remove the anxiety of mind except those who have joined the feet of the incomparable One.', 'Finding a good mentor is like finding peace of mind. The right guidance clears the fog of career uncertainty.', 'The Praise of God'),
  (4, 21, 'செயற்கரிய செய்வார் பெரியர் சிறியர் செயற்கரிய செய்யாதவர்', 'Seyarkaria seyvaar periyar siriyar seyarkaria seyyaadavar', 'Those who do the difficult are the great; those who do not do the difficult are the small.', 'True leaders tackle the hard problems others avoid. Embrace difficult challenges as your path to distinction.', 'Industriousness'),
  (5, 33, 'மடியிலா மன்னவன் எய்தும் அடியளந்தான் தாஅய தெல்லாம் ஒருங்கு', 'Madiyilaa mannavan eydhum adiyalandhan thaya thellaam orungu', 'The king who is free from sloth will obtain all the wealth of the world.', 'Consistency over brilliance. Show up every day, eliminate procrastination, and success becomes inevitable.', 'The Avoidance of Sloth'),
  (6, 44, 'அரன்நாடி ஆன்றவர் கட்சேறல் தீரா மரன்நாடி மேய மகன்', 'Aran naadi aanravar katseral theera maran naadi meiya makan', 'It is like seeking shelter under a lifeless tree to approach the base instead of the virtuous.', 'Choose your professional circle wisely. Mentors with integrity will elevate your entire career trajectory.', 'Seeking the Good'),
  (7, 61, 'அறத்தாறு இதுவென வேண்டா சிவிகை பொறுத்தானோடு ஊர்ந்தான் இடை', 'Aratharu idhuvenaa venda sivigai poruthanoadu oorndhaan idai', 'The contrast between the one who carries the palanquin and the one who rides tells the way of virtue.', 'Hard work and smart work are complementary. Seek mentors who have done the carrying before they rode.', 'The Way of Virtue'),
  (8, 101, 'மனத்துக்கண் மாசிலன் ஆதல் அனைத்தறன் ஆகுல நீர பிற', 'Manathukkann maasilan aadhal anaitharann aagula neera pira', 'To be pure in mind — that is virtue. All else is but a noisy show.', 'In your career, authentic integrity is your most durable brand. Skills can be copied; character cannot.', 'Purity of Mind'),
  (9, 121, 'உழுவார் உலகத்தார்க்கு ஆணி அஃதாற்றாது எழுவாரை எல்லாம் பொறுத்து', 'Uzhuvaar ulagathaarkku aani ahatru ezhuvaarai ellaam porutthu', 'Farmers are the linchpin of society; they support all who cannot sustain themselves.', 'Every successful person stands on the shoulders of foundational work. Honor the builders in your field.', 'The Nobility of Farming'),
  (10, 391, 'எண்ணிய எண்ணியாங்கு எய்துப எண்ணியார் திண்ணியர் ஆகப் பெறின்', 'Enniya enniyaangu eydhupa enniyaar thinniyar aagap perin', 'Those who think with firm resolve will achieve exactly what they have thought.', 'Clarity of vision plus firmness of resolve equals career success. Ambiguity is the enemy of achievement.', 'Firmness of Purpose')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED DATA: Demo Mentor Profiles
-- ============================================================
INSERT INTO profiles (id, user_id, full_name, email, role, native_region, primary_dialect, bio, location, avatar_url)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL, 'Arun Selvakumar', 'arun@demo.com', 'mentor', 'Chennai', 'Formal', 'Senior Software Engineer at Google with 12 years of experience. Passionate about helping Tamil youth break into Big Tech.', 'San Francisco, USA', 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400'),
  ('b2c3d4e5-f6a7-8901-bcde-fa2345678901', NULL, 'Kavitha Ramasamy', 'kavitha@demo.com', 'mentor', 'Madurai', 'Casual', 'Founder of an EdTech startup in London. Previously at McKinsey. Helping aspiring entrepreneurs navigate the startup ecosystem.', 'London, UK', 'https://images.pexels.com/photos/3756679/pexels-photo-3756679.jpeg?auto=compress&cs=tinysrgb&w=400'),
  ('c3d4e5f6-a7b8-9012-cdef-ab3456789012', NULL, 'Priya Chandrasekaran', 'priya@demo.com', 'mentor', 'Coimbatore', 'Both', 'Award-winning classical Bharatanatyam dancer and arts educator. Connecting Tamil diaspora youth with their cultural roots.', 'Toronto, Canada', 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400'),
  ('d4e5f6a7-b8c9-0123-defa-bc4567890123', NULL, 'Vijay Annamalai', 'vijay@demo.com', 'mentor', 'Jaffna', 'Formal', 'Investment Banker turned VC Partner. Tamil Sri Lankan diaspora advocate. Helping professionals transition into finance.', 'Singapore', 'https://images.pexels.com/photos/1587009/pexels-photo-1587009.jpeg?auto=compress&cs=tinysrgb&w=400'),
  ('e5f6a7b8-c9d0-1234-efab-cd5678901234', NULL, 'Meena Subramaniam', 'meena@demo.com', 'mentor', 'Singapore', 'Casual', 'Chief People Officer at a Fortune 500. 20+ years in HR. Helping professionals navigate workplace politics and negotiations.', 'Kuala Lumpur, Malaysia', 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=400'),
  ('f6a7b8c9-d0e1-2345-fabc-de6789012345', NULL, 'Karthik Muthusamy', 'karthik@demo.com', 'mentor', 'Trichy', 'Both', 'Lead AI Researcher at DeepMind. PhD from IIT Madras. Helping Tamil students navigate AI research and PhD applications.', 'London, UK', 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400'),
  ('a7b8c9d0-e1f2-3456-abcd-ef7890123456', NULL, 'Sudha Arumugam', 'sudha@demo.com', 'mentor', 'Chennai', 'Formal', 'Practicing Physician and healthcare entrepreneur. Guiding pre-med students and healthcare startup founders.', 'New York, USA', 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400'),
  ('b8c9d0e1-f2a3-4567-bcde-fa8901234567', NULL, 'Rajan Krishnamoorthy', 'rajan@demo.com', 'mentor', 'Jaffna', 'Casual', 'Senior Product Manager at Meta. Helping PMs and aspiring PMs build strong product intuition and grow their careers.', 'Seattle, USA', 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400')
ON CONFLICT (id) DO NOTHING;

INSERT INTO mentors (id, profile_id, industry, expertise, tamil_proficiency, years_experience, session_price_30min, session_price_60min, rating, total_sessions, headline)
VALUES
  ('11a2b3c4-d5e6-7890-abcd-ef1234567891', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Technology', '{"System Design","Career Transition","Big Tech","Coding Interviews","Leadership"}', 'Formal', 12, 30, 50, 4.9, 148, 'Senior SWE @ Google · Big Tech Career Coach'),
  ('22b3c4d5-e6f7-8901-bcde-fa2345678902', 'b2c3d4e5-f6a7-8901-bcde-fa2345678901', 'Business', '{"Entrepreneurship","Fundraising","Strategy","EdTech","Product-Market Fit"}', 'Casual', 15, 40, 70, 4.8, 97, 'Startup Founder · Ex-McKinsey · Investor'),
  ('33c4d5e6-f7a8-9012-cdef-ab3456789013', 'c3d4e5f6-a7b8-9012-cdef-ab3456789012', 'Arts & Culture', '{"Bharatanatyam","Arts Education","Cultural Identity","Creative Entrepreneurship"}', 'Both', 18, 25, 45, 5.0, 203, 'Bharatanatyam Guru · Arts Entrepreneur'),
  ('44d5e6f7-a8b9-0123-defa-bc4567890124', 'd4e5f6a7-b8c9-0123-defa-bc4567890123', 'Finance', '{"Investment Banking","Venture Capital","Wealth Building","Financial Literacy"}', 'Formal', 16, 45, 80, 4.7, 112, 'VC Partner · Ex-Investment Banker'),
  ('55e6f7a8-b9c0-1234-efab-cd5678901235', 'e5f6a7b8-c9d0-1234-efab-cd5678901234', 'Business', '{"HR Leadership","Salary Negotiation","Executive Presence","Career Coaching"}', 'Casual', 22, 35, 60, 4.8, 189, 'Chief People Officer · Career Strategist'),
  ('66f7a8b9-c0d1-2345-fabc-de6789012346', 'f6a7b8c9-d0e1-2345-fabc-de6789012345', 'Technology', '{"AI Research","Machine Learning","PhD Applications","Academic Research"}', 'Both', 10, 30, 55, 4.9, 76, 'AI Researcher @ DeepMind · PhD Coach'),
  ('77a8b9c0-d1e2-3456-abcd-ef7890123457', 'a7b8c9d0-e1f2-3456-abcd-ef7890123456', 'Healthcare', '{"Medicine","Healthcare Entrepreneurship","Research","Pre-Med Guidance"}', 'Formal', 14, 35, 65, 4.9, 134, 'Physician & Healthcare Entrepreneur'),
  ('88b9c0d1-e2f3-4567-bcde-fa8901234568', 'b8c9d0e1-f2a3-4567-bcde-fa8901234567', 'Technology', '{"Product Management","PM Interviews","Product Strategy","Career Growth"}', 'Casual', 9, 30, 55, 4.8, 91, 'Senior PM @ Meta · PM Career Coach')
ON CONFLICT (id) DO NOTHING;
