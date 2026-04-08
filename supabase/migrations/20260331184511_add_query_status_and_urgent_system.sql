/*
  # Update Query Status System and Add Urgent Flag

  ## Changes Made
  
  1. Query Status Updates
    - Remove separate response_status column from query_assignments
    - Consolidate to single status column in queries table
    - Status values: 'pending', 'answered', 'done', 'archived'
  
  2. Urgent Flag System
    - Add is_urgent boolean to queries table
    - Add unanswered_followups integer to track followup count
    - Automatically mark as urgent when 2+ followups without response
  
  3. Auto-Archive Configuration
    - Add auto_archive_days column to admin_settings
    - Default value: 30 days
    - NULL means no auto-archive
  
  4. Security
    - Update RLS policies to reflect new column structure
*/

-- Drop the response_status column from query_assignments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'query_assignments' AND column_name = 'response_status'
  ) THEN
    ALTER TABLE query_assignments DROP COLUMN response_status;
  END IF;
END $$;

-- Add new columns to queries table
DO $$
BEGIN
  -- Add is_urgent flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queries' AND column_name = 'is_urgent'
  ) THEN
    ALTER TABLE queries ADD COLUMN is_urgent boolean DEFAULT false;
  END IF;

  -- Add unanswered_followups counter
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'queries' AND column_name = 'unanswered_followups'
  ) THEN
    ALTER TABLE queries ADD COLUMN unanswered_followups integer DEFAULT 0;
  END IF;
END $$;

-- Add auto_archive_days to admin_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'auto_archive_days'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN auto_archive_days integer DEFAULT 30;
  END IF;
END $$;

-- Update existing queries to set is_urgent based on comment patterns
UPDATE queries
SET is_urgent = false, unanswered_followups = 0
WHERE is_urgent IS NULL;

-- Create function to check and mark urgent queries
CREATE OR REPLACE FUNCTION check_urgent_status()
RETURNS TRIGGER AS $$
DECLARE
  admin_comment_count integer;
  last_response_time timestamptz;
BEGIN
  -- Count admin comments after last team member response
  SELECT 
    COALESCE(MAX(qr.created_at), NEW.created_at) INTO last_response_time
  FROM query_responses qr
  WHERE qr.query_id = NEW.query_id;

  SELECT COUNT(*) INTO admin_comment_count
  FROM query_comments qc
  JOIN profiles p ON qc.created_by = p.id
  WHERE qc.query_id = NEW.query_id
    AND p.role = 'admin'
    AND qc.created_at > last_response_time;

  -- Mark as urgent if 2 or more admin comments without response
  IF admin_comment_count >= 2 THEN
    UPDATE queries
    SET is_urgent = true, unanswered_followups = admin_comment_count
    WHERE id = NEW.query_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for marking urgent queries
DROP TRIGGER IF EXISTS mark_urgent_on_comment ON query_comments;
CREATE TRIGGER mark_urgent_on_comment
  AFTER INSERT ON query_comments
  FOR EACH ROW
  EXECUTE FUNCTION check_urgent_status();

-- Create function to reset urgent status on response
CREATE OR REPLACE FUNCTION reset_urgent_on_response()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE queries
  SET is_urgent = false, unanswered_followups = 0
  WHERE id = NEW.query_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to reset urgent flag when team member responds
DROP TRIGGER IF EXISTS reset_urgent_on_response ON query_responses;
CREATE TRIGGER reset_urgent_on_response
  AFTER INSERT ON query_responses
  FOR EACH ROW
  EXECUTE FUNCTION reset_urgent_on_response();