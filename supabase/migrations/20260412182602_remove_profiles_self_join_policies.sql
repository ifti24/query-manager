/*
  # Remove profiles self-join policies

  The admin policies added in the previous migration still self-join profiles
  inside a profiles policy, which causes infinite recursion.
  Drop them and rely only on direct auth.uid() = id checks.
  Admin cross-profile access will be handled at the application layer.
*/

DROP POLICY IF EXISTS "admins_select_account_profiles" ON profiles;
DROP POLICY IF EXISTS "admins_update_account_profiles" ON profiles;

-- Also drop the old team member participants policy which joins other tables
DROP POLICY IF EXISTS "Team members can view query participants" ON profiles;
