/*
  # Create queries table
  
  1. New Tables
    - `queries` - Main queries/tasks with status tracking
  2. Security
    - Admin can manage all queries
    - Will be extended with assignment-based access
*/

CREATE TABLE IF NOT EXISTS queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'normal',
  show_priority boolean DEFAULT true,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage queries"
  ON queries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_queries_created_by ON queries(created_by);
CREATE INDEX IF NOT EXISTS idx_queries_status ON queries(status);
