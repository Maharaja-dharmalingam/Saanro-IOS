/*
  # Revoke public EXECUTE on handle_booking_notification

  The function had EXECUTE granted to PUBLIC (which covers anon and authenticated).
  Previous migration revoked named roles but the PUBLIC grant remained.
  This revokes EXECUTE from PUBLIC so the function is only callable by
  postgres and service_role (trigger path), not via the REST API.
*/
REVOKE EXECUTE ON FUNCTION public.handle_booking_notification() FROM PUBLIC;
