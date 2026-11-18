/*
  # Add 'accepted' booking status

  ## Summary
  Adds an intermediate 'accepted' status to the bookings workflow.

  ## Changes
  - Alters the `bookings.status` column to allow a new 'accepted' value
  - 'accepted' means: mentor approved the request, waiting for mentee payment
  - After payment completes, status moves to 'confirmed'

  ## Status flow
  pending → accepted (mentor approves) → confirmed (mentee pays) → completed
  pending → cancelled (mentor declines or mentee cancels)
*/

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'accepted', 'confirmed', 'completed', 'cancelled'));
