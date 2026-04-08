/*
  # Add Consecutive Admin Comments Tracking

  ## Overview
  This migration adds functionality to track consecutive admin comments on queries
  and automatically mark them as urgent or super urgent based on the number of
  consecutive comments without team member responses.

  ## Changes

  1. **Schema Changes**
    - Add `consecutive_admin_comments` column to `queries` table
      - Tracks the number of consecutive comments made by admins
      - Resets to 0 when a team member responds
      - Default value: 0

  2. **Business Logic**
    - Urgent: 2 consecutive admin comments (orange tag)
    - Super Urgent: 3+ consecutive admin comments (red tag)

  3. **Database Function**
    - `update_consecutive_admin_comments()` - Trigger function that:
      - Increments counter when admin posts a comment
      - Resets counter to 0 when team member posts a comment
      - Automatically maintains the consecutive count

  4. **Trigger**
    - Fires after each comment insertion
    - Updates the parent query's consecutive comment count
*/

-- Add consecutive_admin_comments column to queries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queries' AND column_name = 'consecutive_admin_comments'
  ) THEN
    ALTER TABLE queries ADD COLUMN consecutive_admin_comments integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Create function to update consecutive admin comments
CREATE OR REPLACE FUNCTION update_consecutive_admin_comments()
RETURNS TRIGGER AS $$
DECLARE
  commenter_role text;
BEGIN
  -- Get the role of the person who posted the comment
  SELECT role INTO commenter_role
  FROM profiles
  WHERE id = NEW.created_by;

  -- Update the query's consecutive admin comments count
  IF commenter_role = 'admin' THEN
    -- Increment if admin posted
    UPDATE queries
    SET consecutive_admin_comments = consecutive_admin_comments + 1,
        updated_at = now()
    WHERE id = NEW.query_id;
  ELSE
    -- Reset to 0 if team member posted
    UPDATE queries
    SET consecutive_admin_comments = 0,
        updated_at = now()
    WHERE id = NEW.query_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on query_comments table
DROP TRIGGER IF EXISTS trigger_update_consecutive_admin_comments ON query_comments;
CREATE TRIGGER trigger_update_consecutive_admin_comments
  AFTER INSERT ON query_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_consecutive_admin_comments();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_queries_consecutive_admin_comments 
  ON queries(consecutive_admin_comments);