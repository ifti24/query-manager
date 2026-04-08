/*
  # Create admin_settings table
  
  1. New Tables
    - `admin_settings` - Admin configuration (email timing, file restrictions, etc.)
  2. Security
    - Admins can manage their own settings
    - Team members can view public settings (file types, sizes)
  3. Configuration Options
    - Email schedule time (HH:MM format)
    - Email schedule enabled/disabled
    - Send email on query creation
    - Max file size in MB
    - Allowed file types
    - Blacklisted file types
*/

CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email_schedule_time text DEFAULT '08:00',
  email_schedule_enabled boolean DEFAULT true,
  email_send_on_create boolean DEFAULT true,
  max_file_size_mb integer DEFAULT 5,
  allowed_file_types text[] DEFAULT ARRAY['pdf', 'jpg', 'png', 'mail']::text[],
  blacklisted_file_types text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(admin_id)
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage own settings"
  ON admin_settings FOR ALL
  TO authenticated
  USING (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Team members can view public settings"
  ON admin_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
    )
  );
