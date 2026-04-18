/*
  # Fix Remaining Stale Role Reference Policies

  ## Summary
  Two additional stale policies were found referencing role names that no longer exist
  in the current role system:

  1. **query_responses** - "Admin support can view all responses" checked role = 'admin_support'
     which is not a valid role in the current schema. Dropped.

  2. **attachments** - "Users can view attachments for assigned queries" had a final fallback
     checking role = 'admin' (old role name). Replaced with a corrected version using the
     new role system helper is_account_manager().

  ## Tables Modified
  - query_responses: stale admin_support SELECT policy dropped
  - attachments: stale admin role fallback in SELECT policy replaced
*/

-- ============================================================
-- query_responses: drop stale admin_support SELECT policy
-- ============================================================

DROP POLICY IF EXISTS "Admin support can view all responses" ON query_responses;

-- ============================================================
-- attachments: fix stale role = 'admin' fallback in SELECT policy
-- ============================================================

DROP POLICY IF EXISTS "Users can view attachments for assigned queries" ON attachments;

CREATE POLICY "Users can view attachments for assigned queries"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR is_account_manager(current_user_account_id())
    OR (
      (query_id IS NOT NULL) AND (EXISTS (
        SELECT 1 FROM query_assignments
        WHERE query_assignments.query_id = attachments.query_id
          AND query_assignments.assigned_to = auth.uid()
      ))
    )
    OR (
      (response_id IS NOT NULL) AND (EXISTS (
        SELECT 1 FROM query_responses qr
        WHERE qr.id = attachments.response_id
          AND EXISTS (
            SELECT 1 FROM query_assignments
            WHERE query_assignments.query_id = qr.query_id
              AND query_assignments.assigned_to = auth.uid()
          )
      ))
    )
    OR (
      (comment_id IS NOT NULL) AND (EXISTS (
        SELECT 1 FROM query_comments qc
        WHERE qc.id = attachments.comment_id
          AND EXISTS (
            SELECT 1 FROM query_assignments
            WHERE query_assignments.query_id = qc.query_id
              AND query_assignments.assigned_to = auth.uid()
          )
      ))
    )
  );
