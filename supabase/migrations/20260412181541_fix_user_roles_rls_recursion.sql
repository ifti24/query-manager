/*
  # Fix user_roles RLS Infinite Recursion

  ## Problem
  user_roles table has RLS policies that call is_account_manager() and is_platform_admin(),
  which themselves query user_roles. Since these are SECURITY DEFINER functions they bypass
  RLS, but the initial RLS evaluation on user_roles triggers the function which tries to
  query user_roles again — causing infinite recursion.

  ## Fix
  Replace all user_roles policies with direct auth.uid() subqueries that don't call
  any external functions. Use inline EXISTS subqueries instead.

  ## Policies Rebuilt
  - Users can view their own roles (simple auth.uid() = user_id check)
  - Platform admins can manage all roles (inline subquery on user_roles)
  - Account managers can manage account roles (inline subquery on user_roles)
  - Service role bypass
*/

-- Drop all existing user_roles policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', r.policyname);
  END LOOP;
END $$;

-- 1. Users can view their own roles (no function call, direct check)
CREATE POLICY "Users view own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Platform admins can view all roles (inline subquery, no function)
CREATE POLICY "Platform admins view all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'support_admin')
      AND ur.account_id IS NULL
    )
  );

-- 3. Platform admins can insert roles (inline subquery, no function)
CREATE POLICY "Platform admins insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'support_admin')
      AND ur.account_id IS NULL
    )
  );

-- 4. Platform admins can update roles (inline subquery, no function)
CREATE POLICY "Platform admins update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'support_admin')
      AND ur.account_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'support_admin')
      AND ur.account_id IS NULL
    )
  );

-- 5. Platform admins can delete roles (inline subquery, no function)
CREATE POLICY "Platform admins delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'support_admin')
      AND ur.account_id IS NULL
    )
  );

-- 6. Account managers can view roles in their account (inline, no function)
CREATE POLICY "Account managers view account roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.account_id = user_roles.account_id
      AND ur.role IN ('account_owner', 'supervisor')
    )
  );

-- 7. Account managers can insert roles in their account (inline, no function)
CREATE POLICY "Account managers insert account roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL
    AND role IN ('supervisor', 'member')
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.account_id = user_roles.account_id
      AND ur.role IN ('account_owner', 'supervisor')
    )
  );

-- 8. Account managers can update roles in their account (inline, no function)
CREATE POLICY "Account managers update account roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.account_id = user_roles.account_id
      AND ur.role IN ('account_owner', 'supervisor')
    )
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND role IN ('supervisor', 'member')
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.account_id = user_roles.account_id
      AND ur.role IN ('account_owner', 'supervisor')
    )
  );

-- 9. Account managers can delete roles in their account (inline, no function)
CREATE POLICY "Account managers delete account roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.account_id = user_roles.account_id
      AND ur.role IN ('account_owner', 'supervisor')
    )
  );

-- 10. Service role bypass
CREATE POLICY "Service role can manage all roles"
  ON user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
