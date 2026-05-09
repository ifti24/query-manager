/*
  # Allow anon users to read require_email_verification from platform settings

  ## Problem
  During signup the user is not yet authenticated. The client needs to know
  whether email verification is required so it can show the correct success
  screen and sign the user out. The previous policy only allowed authenticated
  users to read the platform settings row — anon users got nothing and the
  flag defaulted to false, letting them bypass verification.

  ## Fix
  Allow both anon and authenticated roles to SELECT the single platform row
  (account_id IS NULL). This row contains only platform-wide configuration
  flags (verification requirement, password policy defaults) and no
  sensitive data.
*/

DROP POLICY IF EXISTS "Any authenticated user can read platform settings row" ON public.admin_settings;

CREATE POLICY "Anyone can read platform settings row"
  ON public.admin_settings
  FOR SELECT
  TO anon, authenticated
  USING (account_id IS NULL);
