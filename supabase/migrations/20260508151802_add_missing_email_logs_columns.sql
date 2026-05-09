/*
  # Add missing columns to email_logs table

  ## Summary
  Several edge functions (send-email, create-query, invite-team-member) insert
  into email_logs using columns that don't exist in the current schema.
  This migration adds those missing columns so all email sending paths can
  properly log their activity.

  ## New Columns
  - `recipient` (text): email address of the recipient (used by send-email, create-query, invite-team-member)
  - `subject` (text): email subject line
  - `error_message` (text): error detail when sending fails
  - `message_id` (text): SMTP message ID returned by nodemailer
  - `email_type` already exists — no change needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'recipient' AND table_schema = 'public'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN recipient text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'subject' AND table_schema = 'public'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN subject text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'error_message' AND table_schema = 'public'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN error_message text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'message_id' AND table_schema = 'public'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN message_id text;
  END IF;

  -- recipient_email is used by send-daily-reminders — add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'recipient_email' AND table_schema = 'public'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN recipient_email text;
  END IF;
END $$;
