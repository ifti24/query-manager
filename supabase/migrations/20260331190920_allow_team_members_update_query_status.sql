/*
  # Allow team members to update query status

  1. Changes
    - Add RLS policy to allow assigned team members to update query status
    - Team members can only update the status field when they are assigned to the query
  
  2. Security
    - Team members can only update queries they are assigned to
    - Restricted to authenticated users who have an active assignment
*/

-- Team members can update status of assigned queries
CREATE POLICY "Team members can update assigned query status"
  ON queries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM query_assignments qa
      WHERE qa.query_id = queries.id 
      AND qa.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM query_assignments qa
      WHERE qa.query_id = queries.id 
      AND qa.assigned_to = auth.uid()
    )
  );
