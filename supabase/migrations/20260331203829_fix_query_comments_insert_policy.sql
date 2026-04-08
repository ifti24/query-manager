/*
  # Fix query_comments INSERT Policy Recursion
  
  1. Changes
    - Drop the "Admin can manage comments" policy that uses FOR ALL
    - Create separate policies for SELECT, INSERT, UPDATE, and DELETE
    - Drop and recreate the "Users can insert comments" policy
    - Use is_admin() function to avoid recursion with profiles table
    
  2. Security
    - Admins can view, insert, update, and delete all comments
    - Team members can view comments for queries they're assigned to
    - Team members can insert comments for queries they're assigned to
    - Users can update only their own comments
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage comments" ON query_comments;
DROP POLICY IF EXISTS "Users can insert comments" ON query_comments;

-- Create separate policies for each operation

-- Admin SELECT policy
CREATE POLICY "Admin can view all comments"
  ON query_comments
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admin INSERT policy (no USING clause needed for INSERT)
CREATE POLICY "Admin can insert comments"
  ON query_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admin UPDATE policy
CREATE POLICY "Admin can update all comments"
  ON query_comments
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Admin DELETE policy
CREATE POLICY "Admin can delete all comments"
  ON query_comments
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Recreate team member INSERT policy
CREATE POLICY "Users can insert comments"
  ON query_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM query_assignments
      WHERE query_assignments.query_id = query_comments.query_id
        AND query_assignments.assigned_to = auth.uid()
    )
  );
