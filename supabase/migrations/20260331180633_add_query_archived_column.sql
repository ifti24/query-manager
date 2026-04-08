/*
  # Add Query Archive Functionality

  1. Changes
    - Add 'archived' boolean column to queries table
    - Add indexes for efficient filtering

  2. Status Workflow
    - pending: Initial state when query is created
    - answered: Team member replies (via query_responses)
    - pending: Admin replies back to answered query
    - completed: Admin marks query as completed (final state)
    - archived: Query can be archived at any status, can be restored

  3. Notes
    - Status transitions handled by application logic
    - Archived queries can be filtered and restored
    - Indexes added for efficient filtering
*/

-- Add archived column to queries table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queries' AND column_name = 'archived'
  ) THEN
    ALTER TABLE queries ADD COLUMN archived boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add index on archived column for efficient filtering
CREATE INDEX IF NOT EXISTS idx_queries_archived ON queries(archived);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_queries_status_archived ON queries(status, archived);