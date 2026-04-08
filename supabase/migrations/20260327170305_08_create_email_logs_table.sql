/*
  # Create email_logs table
  
  1. New Tables
    - `email_logs` - Track sent emails for debugging and audit
  2. Security
    - Admin can view email logs
  3. Email Types
    - instant: Email sent immediately when query is created
    - digest: Email sent in daily/periodic summary
*/

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid REFERENCES queries(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  status text DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_id ON email_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_query_id ON email_logs(query_id);
