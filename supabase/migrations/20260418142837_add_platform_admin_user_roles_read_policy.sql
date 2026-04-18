/*
  # Allow platform admins to read all user_roles

  ## Changes
  - Adds a SELECT policy on user_roles for platform admins (super_admin / support)
    so the platform dashboard can correctly count owners, supervisors, and members.

  ## Security
  - Uses the existing `is_platform_admin()` security-definer function to avoid recursion
*/

CREATE POLICY "Platform admins can view all user roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (is_platform_admin());
