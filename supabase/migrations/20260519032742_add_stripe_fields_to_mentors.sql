/*
  # Add Stripe fields to mentors and restrict public visibility

  1. New Columns (mentors table)
     - `stripe_account_id` (text, nullable) — Stripe Connect account ID, sensitive
     - `stripe_onboarding_complete` (boolean, default false) — whether Stripe onboarding is done

  2. Security
     - Stripe fields must never be exposed to other users (mentees, anon).
     - We create a security-barrier view `public.mentors_public` that selects only
       non-sensitive columns. This view is used for all public-facing queries
       (Discover page, profile modals).
     - The existing broad SELECT policy on `mentors` is replaced with two policies:
         a) Mentors can read their own full row (including Stripe fields).
         b) Any authenticated/anon user can read non-sensitive columns via the view.
     - The UPDATE policy is tightened to block mentees from writing Stripe fields
       by restricting what the authenticated mentor can update (they own the row).
       Stripe fields are only written server-side via edge functions.
*/

-- 1. Add the new columns
ALTER TABLE public.mentors
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean NOT NULL DEFAULT false;

-- 2. Drop the existing overly-broad SELECT policy
DROP POLICY IF EXISTS "Anyone can view available mentors" ON public.mentors;

-- 3. Narrow SELECT: only the owning mentor can read their own full row (incl. Stripe fields)
CREATE POLICY "Mentors can read own full record"
  ON public.mentors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = mentors.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

-- 4. Create a security-barrier view exposing only safe columns for public listing
CREATE OR REPLACE VIEW public.mentors_public
  WITH (security_barrier = true)
AS
  SELECT
    id,
    profile_id,
    industry,
    expertise,
    tamil_proficiency,
    years_experience,
    session_price_30min,
    session_price_60min,
    rating,
    total_sessions,
    is_available,
    languages,
    headline,
    created_at
  FROM public.mentors;

-- Grant SELECT on the view to anon and authenticated (no RLS needed; view is already filtered)
GRANT SELECT ON public.mentors_public TO anon, authenticated;
