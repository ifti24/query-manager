/*
  # Update Password Policy to Support Multiple Roles

  1. Changes to admin_settings Table
    - Modify `password_policy_applies_to` column:
      - Change from text to jsonb to store array of roles
      - Default value will be ['admin', 'team_member'] (applies to both)
      - Supports any combination: ['admin'], ['team_member'], or ['admin', 'team_member']

  2. Data Migration
    - Convert existing 'admin' values to ['admin']
    - Convert existing 'members' or 'team_member' values to ['team_member']
    - Convert existing 'both' values to ['admin', 'team_member']

  3. Notes
    - This allows administrators to select which roles the password policy applies to
    - The policy will be checked dynamically based on the user's role during signup
    - No hardcoded values will be used in the signup process
*/

-- First, add a temporary column to store the new format
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS password_policy_applies_to_new jsonb;

-- Migrate existing data
UPDATE admin_settings
SET password_policy_applies_to_new = 
  CASE 
    WHEN password_policy_applies_to = 'admin' THEN '["admin"]'::jsonb
    WHEN password_policy_applies_to IN ('members', 'team_member') THEN '["team_member"]'::jsonb
    WHEN password_policy_applies_to = 'both' THEN '["admin", "team_member"]'::jsonb
    ELSE '["admin", "team_member"]'::jsonb
  END;

-- Drop the old column
ALTER TABLE admin_settings DROP COLUMN IF EXISTS password_policy_applies_to;

-- Rename the new column
ALTER TABLE admin_settings RENAME COLUMN password_policy_applies_to_new TO password_policy_applies_to;

-- Set default value for new rows
ALTER TABLE admin_settings ALTER COLUMN password_policy_applies_to SET DEFAULT '["admin", "team_member"]'::jsonb;
ALTER TABLE admin_settings ALTER COLUMN password_policy_applies_to SET NOT NULL;