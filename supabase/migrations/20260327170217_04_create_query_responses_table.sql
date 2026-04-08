/*
  # Create query_responses table
  
  1. New Tables
    - `query_responses` - Team member responses to queries
  2. Security
    - Users can view responses for queries they're assigned to
    - Team members can insert and update their own responses
*/

CREATE TABLE IF NOT EXISTS query_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES query_assignments(id) ON DELETE CASCADE,
  responded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE query_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage responses"
  ON query_responses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Users can view responses for assigned queries"
  ON query_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM query_assignments
      WHERE query_assignments.query_id = query_responses.query_id
      AND query_assignments.assigned_to = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Team members can insert own responses"
  ON query_responses FOR INSERT
  TO authenticated
  WITH CHECK (responded_by = auth.uid());

CREATE POLICY "Users can update own responses"
  ON query_responses FOR UPDATE
  TO authenticated
  USING (responded_by = auth.uid())
  WITH CHECK (responded_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_query_responses_query_id ON query_responses(query_id);
CREATE INDEX IF NOT EXISTS idx_query_responses_assignment_id ON query_responses(assignment_id);
