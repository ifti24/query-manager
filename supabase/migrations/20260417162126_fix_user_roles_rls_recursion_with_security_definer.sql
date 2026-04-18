/*
  # Fix user_roles RLS infinite recursion

  1. Problem
    - The "Account owners can view all roles" policy queries user_roles inside its own
      USING clause, causing infinite recursion when RLS evaluates the inner query.
    - This causes getUserRoles() to fail/return empty, leaving the user with no activeRole.

  2. Fix
    - Drop the recursive policies added in the previous migration
    - Create SECURITY DEFINER helper functions that bypass RLS for the role check
    - Recreate the policies using these safe helper functions
*/

DROP POLICY IF EXISTS "Account owners can view all roles in their account" ON user_roles;
DROP POLICY IF EXISTS "Supervisors can view member roles in their account" ON user_roles;

CREATE OR REPLACE FUNCTION is_account_owner_for_account(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND account_id = p_account_id
      AND role = 'account_owner'
  );
$$;

CREATE OR REPLACE FUNCTION is_supervisor_for_account(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND account_id = p_account_id
      AND role = 'supervisor'
  );
$$;

CREATE POLICY "Account owners can view all roles in their account"
  ON user_roles FOR SELECT
  TO authenticated
  USING (is_account_owner_for_account(account_id));

CREATE POLICY "Supervisors can view member roles in their account"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    role = 'member'
    AND is_supervisor_for_account(account_id)
  );
