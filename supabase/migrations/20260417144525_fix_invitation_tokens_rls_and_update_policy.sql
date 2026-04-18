/*
  # Fix invitation_tokens RLS policies

  1. Changes
    - Add UPDATE policy so account owners can update tokens (needed for resend)
    - Add SELECT policy for supervisors to view tokens in their account
    - Ensure account owners can see all tokens in their account
*/

DROP POLICY IF EXISTS "Account owners can view their account invitation tokens" ON invitation_tokens;
DROP POLICY IF EXISTS "Account owners can update their account invitation tokens" ON invitation_tokens;
DROP POLICY IF EXISTS "Supervisors can view invitation tokens in their account" ON invitation_tokens;

CREATE POLICY "Account owners can view their account invitation tokens"
  ON invitation_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = invitation_tokens.account_id
        AND user_roles.role = 'account_owner'
    )
  );

CREATE POLICY "Account owners can update their account invitation tokens"
  ON invitation_tokens FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = invitation_tokens.account_id
        AND user_roles.role = 'account_owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = invitation_tokens.account_id
        AND user_roles.role = 'account_owner'
    )
  );

CREATE POLICY "Supervisors can view invitation tokens in their account"
  ON invitation_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = invitation_tokens.account_id
        AND user_roles.role = 'supervisor'
    )
  );
