/*
  # Add Digest Email Tracking

  1. Changes to email_logs
    - Add `email_type` column to distinguish between individual and digest emails
    - Add `digest_batch_id` to group digest emails sent together
    - Add `total_queries_count` to track total pending queries in digest
    - Add `triggered_by` to track who triggered the email (system or admin)

  2. New Index
    - Add index on digest_batch_id for efficient querying
    - Add index on email_type for filtering
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'email_type'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN email_type text DEFAULT 'individual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'digest_batch_id'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN digest_batch_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'total_queries_count'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN total_queries_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'triggered_by'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN triggered_by text DEFAULT 'system';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_logs_digest_batch_id ON email_logs(digest_batch_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
