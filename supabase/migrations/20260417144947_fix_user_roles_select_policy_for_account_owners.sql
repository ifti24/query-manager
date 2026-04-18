/*
  # Fix user_roles SELECT policy for account owners and supervisors

  1. Problem
    - The only SELECT policy on user_roles is `user_id = auth.uid()` 
    - This means account owners and supervisors can only see their own role row
    - TeamManagement fetches all member roles via a join — returns empty for other users

  2. Fix
    - Add a policy allowing account owners to see all roles in their account
    - Add a policy allowing supervisors to see member roles in their account
*/

CREATE POLICY "Account owners can view all roles in their account"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur2
      WHERE ur2.user_id = auth.uid()
        AND ur2.account_id = user_roles.account_id
        AND ur2.role = 'account_owner'
    )
  );

CREATE POLICY "Supervisors can view member roles in their account"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur2
      WHERE ur2.user_id = auth.uid()
        AND ur2.account_id = user_roles.account_id
        AND ur2.role = 'supervisor'
    )
    AND user_roles.role = 'member'
  );
