/*
  # Add Extended Signup Fields

  ## Summary
  Adds additional columns to support the expanded account owner signup flow.

  ## Changes

  ### profiles table
  - `mobile_number` (text, nullable) - Mobile/WhatsApp number for notifications and 2FA
  - `account_display_name` (text, nullable) - Company name (if business) or owner name (if individual)

  ### accounts table
  - `account_type` (text, not null, default 'business') - 'business' or 'individual'
  - `mobile_number` (text, nullable) - Account-level mobile contact
  - `account_display_name` (text, nullable) - Company or owner display name
  - `expected_supervisor_count` (int, nullable) - Expected number of supervisors
  - `expected_member_count` (int, nullable) - Expected number of members

  ## Notes
  - All new columns are nullable to preserve backward compatibility with existing records
  - account_type has a safe default of 'business'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'mobile_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN mobile_number text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_display_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN account_display_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE accounts ADD COLUMN account_type text NOT NULL DEFAULT 'business';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'mobile_number'
  ) THEN
    ALTER TABLE accounts ADD COLUMN mobile_number text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'account_display_name'
  ) THEN
    ALTER TABLE accounts ADD COLUMN account_display_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'expected_supervisor_count'
  ) THEN
    ALTER TABLE accounts ADD COLUMN expected_supervisor_count integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'expected_member_count'
  ) THEN
    ALTER TABLE accounts ADD COLUMN expected_member_count integer;
  END IF;
END $$;
