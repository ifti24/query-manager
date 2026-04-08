/*
  # Create query_assignments table
  
  1. New Tables
    - `query_assignments` - Track which team members are assigned to which queries
  2. Security
    - Admin can manage all assignments
    - Team members can view their own assignments
*/

CREATE TABLE IF NOT EXISTS query_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(query_id, assigned_to)
);

ALTER TABLE query_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage assignments"
  ON query_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Team members can view own assignments"
  ON query_assignments FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

CREATE INDEX IF NOT EXISTS idx_query_assignments_query_id ON query_assignments(query_id);
CREATE INDEX IF NOT EXISTS idx_query_assignments_assigned_to ON query_assignments(assigned_to);

-- Update queries RLS to include team member view
DROP POLICY IF EXISTS "Admin can manage queries" ON queries;

CREATE POLICY "Admin can manage queries"
  ON queries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Team members can view assigned queries"
  ON queries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM query_assignments
      WHERE query_assignments.query_id = queries.id
      AND query_assignments.assigned_to = auth.uid()
    )
  );
