/*
  # Add Invitation Tokens Table and Extended Profile Fields

  ## Summary
  This migration adds support for the team member invitation flow including:
  - Storing invitation tokens with expiry
  - Extended profile fields: designation, unit/department, division, supervisor_id
  - Configurable invite link expiry in admin_settings

  ## New Tables
  - `invitation_tokens`
    - `id` (uuid, primary key)
    - `token` (text, unique) - secure random token sent in email link
    - `user_id` (uuid) - the invited user's auth id
    - `account_id` (uuid) - which account this invite belongs to
    - `invited_by` (uuid) - who sent the invite (account owner)
    - `temp_password` (text) - the generated temporary password (used once)
    - `role` (text) - 'supervisor' or 'member'
    - `supervisor_id` (uuid, nullable) - assigned supervisor for members
    - `is_used` (boolean) - whether the token has been redeemed
    - `expires_at` (timestamptz) - when this token expires
    - `created_at` (timestamptz)

  ## Modified Tables
  - `profiles`
    - Added `designation` (text) - job title/designation
    - Added `unit_department` (text) - unit or department name
    - Added `division` (text) - division name
    - Added `supervisor_id` (uuid) - FK to profiles for members assigned to a supervisor

  - `admin_settings`
    - Added `invite_link_validity_hours` (integer, default 24) - configurable invite link expiry

  ## Security
  - RLS enabled on invitation_tokens
  - Policies allow account owners to manage tokens for their account
  - Service role has full access for edge function operations
*/

-- Add new columns to profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'designation'
  ) THEN
    ALTER TABLE profiles ADD COLUMN designation text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'unit_department'
  ) THEN
    ALTER TABLE profiles ADD COLUMN unit_department text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'division'
  ) THEN
    ALTER TABLE profiles ADD COLUMN division text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'supervisor_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN supervisor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add invite_link_validity_hours to admin_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'invite_link_validity_hours'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN invite_link_validity_hours integer NOT NULL DEFAULT 24;
  END IF;
END $$;

-- Create invitation_tokens table
CREATE TABLE IF NOT EXISTS invitation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  temp_password text NOT NULL,
  role text NOT NULL CHECK (role IN ('supervisor', 'member')),
  supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  supervisor_name text DEFAULT '',
  is_used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invitation_tokens ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Account owners can insert invitation tokens for their account"
  ON invitation_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = invitation_tokens.account_id
        AND user_roles.role = 'account_owner'
    )
  );

CREATE POLICY "Invited users can view their own token"
  ON invitation_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_invitation_tokens_token ON invitation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_user_id ON invitation_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_account_id ON invitation_tokens(account_id);
