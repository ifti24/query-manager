/*
  # Add Advanced Email Schedule Settings

  ## Summary
  Adds three new columns to the admin_settings table to support advanced
  daily digest email scheduling controls:

  1. email_timezone (text) - GMT offset string like "GMT+6" used to interpret
     the email_schedule_time in the admin's local timezone rather than UTC.
     Defaults to "GMT+0".

  2. email_schedule_days (integer[]) - Array of weekday numbers (0=Sunday,
     1=Monday, ... 6=Saturday) on which the daily digest should be sent.
     Defaults to [1,2,3,4,5] (Monday through Friday).

  3. digest_blacklist_dates (text[]) - Array of date strings in YYYY-MM-DD format
     representing individual dates or date ranges on which the digest email
     should NOT be sent (e.g., public holidays). A date range is represented
     as "YYYY-MM-DD/YYYY-MM-DD".

  ## Security
  - No new RLS policies needed; existing policies on admin_settings already cover these columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'email_timezone'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN email_timezone text DEFAULT 'GMT+0';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'email_schedule_days'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN email_schedule_days integer[] DEFAULT ARRAY[1,2,3,4,5];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'digest_blacklist_dates'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN digest_blacklist_dates text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;
