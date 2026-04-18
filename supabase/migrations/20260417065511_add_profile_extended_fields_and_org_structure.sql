/*
  # Add Extended Profile Fields and Organisational Structure Tables

  ## Summary
  Extends the user profiles with personal/HR information and adds
  organisation-scoped departments and divisions management.

  ## Profile Changes
  - `gender` (text) - 'male', 'female', 'other', 'prefer_not_to_say'
  - `employee_id` (text) - unique per account; auto-generated (system:XXXXXXXX) for account owners
  - `photo_url` (text) - reserved for future photo upload feature
  - Unique constraint on (account_id, employee_id) so IDs are unique within a company

  ## New Tables
  - `departments`
    - id, account_id, name, is_active, created_at
  - `divisions`
    - id, account_id, name, is_active, created_at

  ## Security
  - RLS on both new tables
  - Account owners can manage their own departments/divisions
  - All members of an account can read departments/divisions
*/

-- Add new columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'gender'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gender text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN employee_id text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN photo_url text DEFAULT '';
  END IF;
END $$;

-- Unique employee_id per account (partial, ignoring blank/null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_account_employee_id
  ON profiles(account_id, employee_id)
  WHERE account_id IS NOT NULL AND employee_id IS NOT NULL AND employee_id <> '' AND NOT starts_with(employee_id, 'sys:');

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, name)
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = departments.account_id
    )
  );

CREATE POLICY "Account owners can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = departments.account_id
        AND user_roles.role = 'account_owner'
    )
  );

CREATE POLICY "Account owners can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = departments.account_id
        AND user_roles.role = 'account_owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = departments.account_id
        AND user_roles.role = 'account_owner'
    )
  );

CREATE POLICY "Account owners can delete departments"
  ON departments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = departments.account_id
        AND user_roles.role = 'account_owner'
    )
  );

-- Create divisions table
CREATE TABLE IF NOT EXISTS divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, name)
);

ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view divisions"
  ON divisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = divisions.account_id
    )
  );

CREATE POLICY "Account owners can insert divisions"
  ON divisions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = divisions.account_id
        AND user_roles.role = 'account_owner'
    )
  );

CREATE POLICY "Account owners can update divisions"
  ON divisions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = divisions.account_id
        AND user_roles.role = 'account_owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = divisions.account_id
        AND user_roles.role = 'account_owner'
    )
  );

CREATE POLICY "Account owners can delete divisions"
  ON divisions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.account_id = divisions.account_id
        AND user_roles.role = 'account_owner'
    )
  );

CREATE INDEX IF NOT EXISTS idx_departments_account_id ON departments(account_id);
CREATE INDEX IF NOT EXISTS idx_divisions_account_id ON divisions(account_id);
