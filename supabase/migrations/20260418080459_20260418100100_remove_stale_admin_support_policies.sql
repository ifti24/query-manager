/*
  # Remove stale admin_support role policies

  ## Problem
  Several RLS policies reference `role = 'admin_support'` which is a stale/obsolete role name.
  The current role system uses `support_admin` not `admin_support`. These policies are effectively
  dead code — they never match any real user — and create confusion and potential security gaps.

  ## Affected Tables
  - `queries`: 3 stale policies for insert, update, select
  - `query_assignments`: 1 stale policy for manage (ALL)
  - `query_comments`: 2 stale policies for insert and select

  ## Fix
  Drop all policies referencing the non-existent `admin_support` role.
  The `support_admin` role is already handled by the platform admin functions.
*/

DROP POLICY IF EXISTS "Admin support can create queries" ON queries;
DROP POLICY IF EXISTS "Admin support can update queries" ON queries;
DROP POLICY IF EXISTS "Admin support can view all queries" ON queries;

DROP POLICY IF EXISTS "Admin support can manage assignments" ON query_assignments;

DROP POLICY IF EXISTS "Admin support can insert comments" ON query_comments;
DROP POLICY IF EXISTS "Admin support can view all comments" ON query_comments;
