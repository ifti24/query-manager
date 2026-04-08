/*
  # Replace All Profile Queries with is_admin() Function

  1. Changes
    - Replace all policies that query profiles table for admin checks
    - Use is_admin() function instead to avoid recursion
    - Affects queries, query_assignments, query_comments, and query_responses tables

  2. Security
    - Maintains same security level
    - Eliminates infinite recursion
*/

-- Drop all policies that query profiles table
DROP POLICY IF EXISTS "Admin can manage queries" ON queries;
DROP POLICY IF EXISTS "Admin can manage assignments" ON query_assignments;
DROP POLICY IF EXISTS "Admin can manage comments" ON query_comments;
DROP POLICY IF EXISTS "Users can view comments for assigned queries" ON query_comments;
DROP POLICY IF EXISTS "Admin can manage responses" ON query_responses;
DROP POLICY IF EXISTS "Users can view responses for assigned queries" ON query_responses;

-- Recreate policies using is_admin() function

-- Queries table
CREATE POLICY "Admin can manage queries"
  ON queries
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Query assignments table
CREATE POLICY "Admin can manage assignments"
  ON query_assignments
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Query comments table
CREATE POLICY "Admin can manage comments"
  ON query_comments
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can view comments for assigned queries"
  ON query_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM query_assignments
      WHERE query_assignments.query_id = query_comments.query_id
        AND query_assignments.assigned_to = auth.uid()
    ) OR is_admin()
  );

-- Query responses table
CREATE POLICY "Admin can manage responses"
  ON query_responses
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can view responses for assigned queries"
  ON query_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM query_assignments
      WHERE query_assignments.query_id = query_responses.query_id
        AND query_assignments.assigned_to = auth.uid()
    ) OR is_admin()
  );