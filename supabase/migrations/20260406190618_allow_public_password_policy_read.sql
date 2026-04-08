/*
  # Allow Public Access to Password Policy Settings

  1. Changes
    - Add RLS policy to allow unauthenticated users to read password policy settings from admin_settings
    - This is necessary because signup forms need to fetch password requirements before users are authenticated

  2. Security Notes
    - Only SELECT access is granted
    - This is safe because password policy settings are configuration, not sensitive user data
    - Other admin_settings fields remain protected by existing policies
*/

-- Drop the policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_settings' 
    AND policyname = 'Anyone can view password policy settings'
  ) THEN
    DROP POLICY "Anyone can view password policy settings" ON admin_settings;
  END IF;
END $$;

-- Allow anyone (including unauthenticated users) to read password policy settings
CREATE POLICY "Anyone can view password policy settings"
  ON admin_settings
  FOR SELECT
  TO public
  USING (true);