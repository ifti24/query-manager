/*
  # Allow Team Members to View Query Participants

  1. Changes
    - Add policy for team members to view profiles of users involved in their assigned queries
    - This includes admins who comment on queries and other team members assigned to the same query
    - Maintains security by only exposing profiles related to queries the user is assigned to

  2. Security
    - Team members can only view profiles of:
      - Users who have commented on queries they're assigned to
      - Users who have responded to queries they're assigned to
      - The creators of queries they're assigned to
    - Does not expose all user profiles, only those contextually relevant
*/

-- Allow team members to view profiles of users involved in their assigned queries
CREATE POLICY "Team members can view query participants"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow viewing profiles of users who have interacted with queries the team member is assigned to
    EXISTS (
      SELECT 1 FROM query_assignments
      WHERE query_assignments.assigned_to = auth.uid()
      AND (
        -- Query creator
        profiles.id IN (
          SELECT created_by FROM queries WHERE queries.id = query_assignments.query_id
        )
        -- Users who responded
        OR profiles.id IN (
          SELECT responded_by FROM query_responses WHERE query_responses.query_id = query_assignments.query_id
        )
        -- Users who commented
        OR profiles.id IN (
          SELECT created_by FROM query_comments WHERE query_comments.query_id = query_assignments.query_id
        )
      )
    )
  );