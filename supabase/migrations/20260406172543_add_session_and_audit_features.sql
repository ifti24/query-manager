/*
  # Add Session Management and Audit Features

  1. Changes to admin_settings
    - Add session_idle_timeout_minutes (default 5 minutes)
    - Add session_warning_seconds (how many seconds before timeout to show warning)
    - Add password_reset_link_validity_hours (default 24 hours)
    - Add email_schedule_time (time to send daily emails, format HH:MM)
    
  2. New Tables
    - `login_audit` - Track all user login activities
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `email` (text)
      - `login_at` (timestamptz)
      - `ip_address` (text, optional)
      - `user_agent` (text, optional)
    
  3. Changes to profiles
    - Add `is_deleted` (boolean, default false) for soft delete
    - Add `deleted_at` (timestamptz, nullable)
    - Add `is_active` (boolean, default true) for activate/deactivate
    - Add `last_login_at` (timestamptz, nullable)
    
  4. Security
    - Enable RLS on login_audit table
    - Add policies for admins to view all audit logs
    - Add policies for users to view their own audit logs
    - Update profiles policies to handle soft-deleted users
*/

-- Add new columns to admin_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'session_idle_timeout_minutes'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN session_idle_timeout_minutes integer DEFAULT 5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'session_warning_seconds'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN session_warning_seconds integer DEFAULT 60;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_reset_link_validity_hours'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_reset_link_validity_hours integer DEFAULT 24;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'email_schedule_time'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN email_schedule_time text DEFAULT '09:00';
  END IF;
END $$;

-- Add new columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_deleted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_login_at timestamptz;
  END IF;
END $$;

-- Create login_audit table
CREATE TABLE IF NOT EXISTS login_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  login_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE login_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all login audit logs"
  ON login_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own login audit logs"
  ON login_audit FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert login audit logs"
  ON login_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_login_at ON login_audit(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON profiles(is_deleted);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON profiles(last_login_at DESC);
