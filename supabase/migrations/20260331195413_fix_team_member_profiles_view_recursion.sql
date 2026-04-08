/*
  # Fix Infinite Recursion in Team Member Profiles Policy

  1. Changes
    - Remove the recursive policy that caused infinite loops
    - Add a simpler policy using direct table lookups without joining to profiles
    - Allow team members to view profiles by checking query_assignments directly

  2. Security
    - Team members can view profiles of users involved in queries they're assigned to
    - Uses CTEs and direct ID checks to avoid recursion
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Team members can view query participants" ON profiles;

-- Create a new policy that avoids recursion by using direct ID checks
CREATE POLICY "Team members can view query participants"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can view their own profile (existing behavior)
    auth.uid() = id
    OR
    -- User can view profiles of people involved in their assigned queries
    id IN (
      WITH assigned_queries AS (
        SELECT query_id FROM query_assignments WHERE assigned_to = auth.uid()
      )
      SELECT DISTINCT created_by FROM queries WHERE id IN (SELECT query_id FROM assigned_queries)
      UNION
      SELECT DISTINCT responded_by FROM query_responses WHERE query_id IN (SELECT query_id FROM assigned_queries)
      UNION
      SELECT DISTINCT created_by FROM query_comments WHERE query_id IN (SELECT query_id FROM assigned_queries)
    )
  );