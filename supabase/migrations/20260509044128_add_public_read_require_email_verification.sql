/*
  # Allow any authenticated user to read require_email_verification from platform settings

  ## Problem
  The admin_settings SELECT policies only allow:
  - account managers/members to read their own account row (account_id IS NOT NULL)
  - platform admins to read any row

  The platform row (account_id IS NULL) was invisible to regular account owners,
  so the email verification gate in AuthContext always received null and failed open.

  ## Fix
  Add a narrow SELECT policy that lets any authenticated user read the single
  platform-level row. This is intentionally read-only and exposes only the
  platform-wide setting, not any account-specific data.
*/

CREATE POLICY "Any authenticated user can read platform settings row"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (account_id IS NULL);
