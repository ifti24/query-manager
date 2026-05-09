/*
  # Add require_email_verification to admin_settings

  1. Changes
    - Adds `require_email_verification` boolean column to `admin_settings`
    - Default is `false` (users can login instantly after signup)
    - When `true`, new signups must verify their email before accessing the platform
    - This is a platform-level setting controlled by super_admin

  2. Notes
    - Only the platform-level admin_settings row (no account_id scoping needed)
      is checked during signup; it is a global policy
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'require_email_verification'
  ) THEN
    ALTER TABLE admin_settings
      ADD COLUMN require_email_verification boolean NOT NULL DEFAULT false;
  END IF;
END $$;
