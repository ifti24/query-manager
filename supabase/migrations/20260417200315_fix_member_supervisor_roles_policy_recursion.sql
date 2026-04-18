/*
  # Fix recursive RLS policy on user_roles

  ## Problem
  The previous policy "Members can view supervisor roles in their account" used a
  subquery back into user_roles to check account membership. This caused infinite
  RLS recursion whenever any query touched user_roles (including fetching the
  member's own role at login), making getUserRoles() return empty and leaving
  activeRole as null — which showed the "Account Setup in Progress" screen.

  ## Fix
  Drop the recursive policy and replace it with one that checks account membership
  via the profiles table (no self-reference, no recursion).
*/

DROP POLICY IF EXISTS "Members can view supervisor roles in their account" ON user_roles;

CREATE POLICY "Members can view supervisor roles in their account"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    role IN ('supervisor', 'account_owner')
    AND account_id IN (
      SELECT p.account_id
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.account_id IS NOT NULL
    )
  );
