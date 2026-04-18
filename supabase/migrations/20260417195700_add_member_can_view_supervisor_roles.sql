/*
  # Allow members to view supervisor and account_owner roles in their account

  ## Problem
  Members querying "My Supervisors" get empty results because RLS on user_roles
  only allows account owners and supervisors to see other roles. Members can only
  see their own role row.

  ## Change
  Add a SELECT policy that allows members to view supervisor and account_owner
  roles within the same account they belong to.
*/

CREATE POLICY "Members can view supervisor roles in their account"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    role IN ('supervisor', 'account_owner')
    AND account_id IN (
      SELECT ur2.account_id
      FROM user_roles ur2
      WHERE ur2.user_id = auth.uid()
        AND ur2.account_id = user_roles.account_id
    )
  );
