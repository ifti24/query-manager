/*
  # Add platform admin read access to all profiles

  ## Problem
  Platform admins (super_admin, support) could read user_roles via the existing
  "Platform admins can view all user roles" policy, but had no corresponding policy
  to read the profiles joined to those roles. The profiles table only had account-scoped
  SELECT policies, so cross-account reads silently returned empty results.

  ## Changes
  - profiles: Add SELECT policy allowing platform admins to read any profile
  - This uses the existing `is_platform_admin()` security-definer helper function
*/

CREATE POLICY "Platform admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_platform_admin());
