/*
  # Create attachments table
  
  1. New Tables
    - `attachments` - Files attached to queries, responses, or comments
  2. Security
    - Users can view attachments for queries they're assigned to
    - Users can upload attachments
  3. Important
    - One attachment can only belong to one parent (query, response, or comment)
    - File type and size validation done at application level
*/

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid REFERENCES queries(id) ON DELETE CASCADE,
  response_id uuid REFERENCES query_responses(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES query_comments(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  storage_path text NOT NULL,
  is_image boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT has_parent CHECK (
    (query_id IS NOT NULL AND response_id IS NULL AND comment_id IS NULL)
    OR (query_id IS NULL AND response_id IS NOT NULL AND comment_id IS NULL)
    OR (query_id IS NULL AND response_id IS NULL AND comment_id IS NOT NULL)
  )
);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage attachments"
  ON attachments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Users can view attachments for assigned queries"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    (query_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM query_assignments
      WHERE query_assignments.query_id = attachments.query_id
      AND query_assignments.assigned_to = auth.uid()
    ))
    OR (response_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM query_responses qr
      WHERE qr.id = attachments.response_id
      AND EXISTS (
        SELECT 1 FROM query_assignments
        WHERE query_assignments.query_id = qr.query_id
        AND query_assignments.assigned_to = auth.uid()
      )
    ))
    OR (comment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM query_comments qc
      WHERE qc.id = attachments.comment_id
      AND EXISTS (
        SELECT 1 FROM query_assignments
        WHERE query_assignments.query_id = qc.query_id
        AND query_assignments.assigned_to = auth.uid()
      )
    ))
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Users can upload attachments"
  ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_attachments_query_id ON attachments(query_id);
CREATE INDEX IF NOT EXISTS idx_attachments_response_id ON attachments(response_id);
CREATE INDEX IF NOT EXISTS idx_attachments_comment_id ON attachments(comment_id);
