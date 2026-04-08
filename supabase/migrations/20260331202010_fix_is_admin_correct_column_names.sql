/*
  # Fix is_admin() function to avoid recursion
  
  1. Changes
    - Drop all policies that depend on is_admin()
    - Drop and recreate is_admin() function to query auth.users directly
    - Recreate all dropped policies with correct column names
    
  2. Security
    - Function is marked as SECURITY DEFINER to run with elevated privileges
    - Safe because it only checks metadata, doesn't expose sensitive data
    - Solves the circular dependency between RLS policies and is_admin() checks
*/

-- Drop all policies that use is_admin()
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can manage queries" ON queries;
DROP POLICY IF EXISTS "Admin can manage assignments" ON query_assignments;
DROP POLICY IF EXISTS "Admin can manage comments" ON query_comments;
DROP POLICY IF EXISTS "Users can view comments for assigned queries" ON query_comments;
DROP POLICY IF EXISTS "Admin can manage responses" ON query_responses;
DROP POLICY IF EXISTS "Users can view responses for assigned queries" ON query_responses;

-- Drop the existing function
DROP FUNCTION IF EXISTS is_admin();

-- Create new function that queries auth.users directly to avoid RLS recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT (raw_app_meta_data->>'is_admin')::boolean
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
END;
$$;

-- Recreate profiles table admin policies
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (is_admin());

-- Recreate queries table admin policy
CREATE POLICY "Admin can manage queries"
  ON queries
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Recreate query_assignments table admin policy
CREATE POLICY "Admin can manage assignments"
  ON query_assignments
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Recreate query_comments table policies
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
    is_admin() OR
    EXISTS (
      SELECT 1 FROM query_assignments
      WHERE query_assignments.query_id = query_comments.query_id
      AND query_assignments.assigned_to = auth.uid()
    )
  );

-- Recreate query_responses table policies
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
    is_admin() OR
    EXISTS (
      SELECT 1 FROM query_assignments
      WHERE query_assignments.query_id = query_responses.query_id
      AND query_assignments.assigned_to = auth.uid()
    )
  );