/*
  # Create query_comments table
  
  1. New Tables
    - `query_comments` - Comments and discussion thread on queries and responses
  2. Security
    - Users can view comments for queries they're assigned to
    - Users can insert and update their own comments
*/

CREATE TABLE IF NOT EXISTS query_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  response_id uuid REFERENCES query_responses(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE query_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage comments"
  ON query_comments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Users can view comments for assigned queries"
  ON query_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM query_assignments
      WHERE query_assignments.query_id = query_comments.query_id
      AND query_assignments.assigned_to = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Users can insert comments"
  ON query_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM query_assignments
        WHERE query_assignments.query_id = query_comments.query_id
        AND query_assignments.assigned_to = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

CREATE POLICY "Users can update own comments"
  ON query_comments FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_query_comments_query_id ON query_comments(query_id);
