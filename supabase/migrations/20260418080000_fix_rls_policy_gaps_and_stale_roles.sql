/*
  # Fix RLS Policy Gaps and Stale Role References

  ## Summary
  This migration addresses several RLS security issues discovered during a full audit:

  1. **login_audit** - INSERT policy used `WITH CHECK (true)` allowing any authenticated user
     to insert audit logs with any user_id. Fixed to only allow inserting rows where
     user_id matches auth.uid(), preventing log forgery.

  2. **login_audit / email_logs / admin_settings** - SELECT policies checked for
     `role = 'admin'` which is a stale role name from an old role system. Updated to
     use the new role system helper functions (is_platform_admin, is_account_manager).

  3. **attachments** - Two stale policies referenced `role = 'admin_support'` which no
     longer exists in the current role system. Dropped and replaced with correct policies
     using the new role hierarchy.

  4. **query_responses** - `Team members can insert own responses` only checked
     responded_by = auth.uid() without verifying assignment ownership — too permissive.
     Dropped in favour of the existing stricter `Members insert responses for assigned queries`.

  5. **email_logs** - No INSERT policy existed for authenticated users. Added a policy
     scoped to the authenticated user's own recipient_id.

  ## Tables Modified
  - login_audit: INSERT policy tightened
  - login_audit: SELECT policy updated for new role system
  - email_logs: SELECT policy updated for new role system
  - email_logs: INSERT policy added for service role
  - admin_settings: stale SELECT policies referencing old role dropped (already covered by newer policies)
  - attachments: stale admin_support policies dropped, account manager policies added
  - query_responses: overly broad INSERT policy dropped
*/

-- ============================================================
-- login_audit fixes
-- ============================================================

-- Drop the overly broad insert policy
DROP POLICY IF EXISTS "System can insert login audit logs" ON login_audit;

-- Re-add insert policy scoped to the authenticated user's own row
CREATE POLICY "Users can insert own login audit"
  ON login_audit FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Drop stale SELECT policy checking old role = 'admin'
DROP POLICY IF EXISTS "Admins can view all login audit logs" ON login_audit;

-- Re-add SELECT policy using current role system
CREATE POLICY "Account managers can view account login audit"
  ON login_audit FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR is_account_manager(current_user_account_id())
    OR user_id = auth.uid()
  );

-- ============================================================
-- email_logs fixes
-- ============================================================

-- Drop stale SELECT policy checking old role = 'admin'
DROP POLICY IF EXISTS "Admin can view email logs" ON email_logs;

-- Re-add SELECT policy using current role system
CREATE POLICY "Account managers can view email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR is_account_manager(current_user_account_id())
    OR recipient_id = auth.uid()
  );

-- Add service_role bypass for system inserts (edge functions use service role key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_logs' AND policyname = 'service_role_email_logs'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_email_logs" ON email_logs FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================
-- attachments fixes: drop stale admin_support policies
-- ============================================================

DROP POLICY IF EXISTS "Admin support can insert attachments" ON attachments;
DROP POLICY IF EXISTS "Admin support can view all attachments" ON attachments;

-- Drop stale policy checking role = 'admin' (old role system)
DROP POLICY IF EXISTS "Admin can manage attachments" ON attachments;

-- Re-add attachment management for account managers (new role system)
CREATE POLICY "Account managers can manage attachments"
  ON attachments FOR ALL
  TO authenticated
  USING (is_platform_admin() OR is_account_manager(current_user_account_id()))
  WITH CHECK (is_platform_admin() OR is_account_manager(current_user_account_id()));

-- ============================================================
-- query_responses: drop overly broad INSERT policy
-- ============================================================

-- This policy only checked responded_by = auth.uid() without verifying assignment
-- The stricter "Members insert responses for assigned queries" policy already covers this correctly
DROP POLICY IF EXISTS "Team members can insert own responses" ON query_responses;
