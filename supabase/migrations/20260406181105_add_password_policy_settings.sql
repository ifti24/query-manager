/*
  # Add Password Policy Settings

  1. Changes to admin_settings Table
    - Add password policy configuration fields:
      - `password_min_length` (integer, default 8): Minimum password length
      - `password_max_length` (integer, default 128): Maximum password length
      - `password_require_uppercase` (boolean, default true): Require at least one uppercase letter
      - `password_min_uppercase` (integer, default 1): Minimum number of uppercase letters required
      - `password_require_lowercase` (boolean, default true): Require at least one lowercase letter
      - `password_min_lowercase` (integer, default 1): Minimum number of lowercase letters required
      - `password_require_numbers` (boolean, default true): Require at least one number
      - `password_min_numbers` (integer, default 1): Minimum count of numbers required
      - `password_require_special` (boolean, default true): Require at least one special character
      - `password_min_special` (integer, default 1): Minimum count of special characters required
      - `password_allowed_special_chars` (text, default '!@#$%^&*()_+-=[]{}|;:,.<>?'): Allowed special characters
      - `password_policy_applies_to` (text, default 'both'): Who the policy applies to ('admin', 'members', 'both')

  2. Notes
    - These settings will be used to validate passwords during signup and password reset
    - Default values provide a reasonable security baseline
*/

DO $$
BEGIN
  -- Add password_min_length column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_min_length'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_min_length integer DEFAULT 8 NOT NULL;
  END IF;

  -- Add password_max_length column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_max_length'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_max_length integer DEFAULT 128 NOT NULL;
  END IF;

  -- Add password_require_uppercase column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_require_uppercase'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_require_uppercase boolean DEFAULT true NOT NULL;
  END IF;

  -- Add password_min_uppercase column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_min_uppercase'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_min_uppercase integer DEFAULT 1 NOT NULL;
  END IF;

  -- Add password_require_lowercase column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_require_lowercase'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_require_lowercase boolean DEFAULT true NOT NULL;
  END IF;

  -- Add password_min_lowercase column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_min_lowercase'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_min_lowercase integer DEFAULT 1 NOT NULL;
  END IF;

  -- Add password_require_numbers column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_require_numbers'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_require_numbers boolean DEFAULT true NOT NULL;
  END IF;

  -- Add password_min_numbers column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_min_numbers'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_min_numbers integer DEFAULT 1 NOT NULL;
  END IF;

  -- Add password_require_special column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_require_special'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_require_special boolean DEFAULT true NOT NULL;
  END IF;

  -- Add password_min_special column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_min_special'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_min_special integer DEFAULT 1 NOT NULL;
  END IF;

  -- Add password_allowed_special_chars column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_allowed_special_chars'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_allowed_special_chars text DEFAULT '!@#$%^&*()_+-=[]{}|;:,.<>?' NOT NULL;
  END IF;

  -- Add password_policy_applies_to column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'password_policy_applies_to'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN password_policy_applies_to text DEFAULT 'both' NOT NULL;
  END IF;
END $$;