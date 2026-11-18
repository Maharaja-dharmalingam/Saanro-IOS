/*
  # Allow mentees to insert and update time slots during booking

  ## Problem
  The existing INSERT policy on time_slots only allows the mentor who owns the slot
  to insert rows. But when a mentee books or requests a session, the client code
  inserts a time_slots row on their behalf (to record the reserved window).

  ## Changes
  1. Add INSERT policy: any authenticated user may insert a time_slot for any mentor
     (the mentor_id is validated at the application layer; availability is enforced
     by the booking flow itself).
  2. Add UPDATE policy for mentees: a mentee who has a booking linked to a time_slot
     may update that time_slot (e.g. to mark it as booked after payment succeeds).
*/

-- Allow any authenticated user to insert a time slot (needed for booking/request flow)
CREATE POLICY "Authenticated users can insert time slots for booking"
  ON time_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow mentees to update a time slot linked to one of their bookings
CREATE POLICY "Mentees can update time slots linked to their bookings"
  ON time_slots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN profiles p ON p.id = b.mentee_id
      WHERE b.time_slot_id = time_slots.id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN profiles p ON p.id = b.mentee_id
      WHERE b.time_slot_id = time_slots.id
        AND p.user_id = auth.uid()
    )
  );
