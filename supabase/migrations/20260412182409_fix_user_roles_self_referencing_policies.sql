/*
  # Fix user_roles self-referencing RLS policies causing infinite recursion

  ## Problem
  Several RLS policies on user_roles directly query user_roles itself in their
  USING/WITH CHECK clauses. Even though helper functions are SECURITY DEFINER,
  these inline EXISTS subqueries against user_roles still trigger RLS on that
  same table, causing infinite recursion → "Database error querying schema".

  ## Fix
  1. Create SECURITY DEFINER functions that check role membership by bypassing RLS
  2. Replace all self-referencing user_roles policies with these safe functions
  3. Also fix profiles policies that query user_roles (same recursion path)
*/

-- Helper: check if current user is a platform admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_platform_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM user_roles
  WHERE user_id = auth.uid()
  AND account_id IS NULL
  AND role IN ('super_admin', 'support_admin')
  LIMIT 1;
$$;

-- Helper: check if current user has a given role in a given account (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_account_role(p_account_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM user_roles
  WHERE user_id = auth.uid()
  AND account_id = p_account_id
  LIMIT 1;
$$;

-- ============================================================
-- Drop and recreate all user_roles policies without self-joins
-- ============================================================

DROP POLICY IF EXISTS "Platform admins view all roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins insert roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins update roles" ON user_roles;
DROP POLICY IF EXISTS "Platform admins delete roles" ON user_roles;
DROP POLICY IF EXISTS "Account managers view account roles" ON user_roles;
DROP POLICY IF EXISTS "Account managers insert account roles" ON user_roles;
DROP POLICY IF EXISTS "Account managers update account roles" ON user_roles;
DROP POLICY IF EXISTS "Account managers delete account roles" ON user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage all roles" ON user_roles;

CREATE POLICY "Users view own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins view all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (get_user_platform_role() IS NOT NULL);

CREATE POLICY "Platform admins insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (get_user_platform_role() IS NOT NULL);

CREATE POLICY "Platform admins update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (get_user_platform_role() IS NOT NULL)
  WITH CHECK (get_user_platform_role() IS NOT NULL);

CREATE POLICY "Platform admins delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (get_user_platform_role() IS NOT NULL);

CREATE POLICY "Account managers view account roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    get_user_account_role(account_id) IN ('account_owner', 'supervisor')
  );

CREATE POLICY "Account managers insert account roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL AND
    role IN ('supervisor', 'member') AND
    get_user_account_role(account_id) IN ('account_owner', 'supervisor')
  );

CREATE POLICY "Account managers update account roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    get_user_account_role(account_id) IN ('account_owner', 'supervisor')
  )
  WITH CHECK (
    account_id IS NOT NULL AND
    role IN ('supervisor', 'member') AND
    get_user_account_role(account_id) IN ('account_owner', 'supervisor')
  );

CREATE POLICY "Account managers delete account roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    get_user_account_role(account_id) IN ('account_owner', 'supervisor')
  );

CREATE POLICY "Service role can manage all roles"
  ON user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Fix profiles policies that query user_roles (same recursion)
-- ============================================================

DROP POLICY IF EXISTS "Platform admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Platform admins update all profiles" ON profiles;
DROP POLICY IF EXISTS "Platform admins delete profiles" ON profiles;
DROP POLICY IF EXISTS "Account owner can view account profiles" ON profiles;
DROP POLICY IF EXISTS "Account owner can insert account profiles" ON profiles;
DROP POLICY IF EXISTS "Account owner can update account profiles" ON profiles;
DROP POLICY IF EXISTS "Supervisor can view account profiles" ON profiles;

CREATE POLICY "Platform admins view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (get_user_platform_role() IS NOT NULL);

CREATE POLICY "Platform admins update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (get_user_platform_role() IS NOT NULL)
  WITH CHECK (get_user_platform_role() IS NOT NULL);

CREATE POLICY "Platform admins delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (get_user_platform_role() IS NOT NULL);

CREATE POLICY "Account owner can view account profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    get_user_account_role(account_id) IN ('account_owner', 'supervisor')
  );

CREATE POLICY "Account owner can insert account profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL AND
    get_user_account_role(account_id) = 'account_owner'
  );

CREATE POLICY "Account owner can update account profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    get_user_account_role(account_id) = 'account_owner'
  )
  WITH CHECK (
    account_id IS NOT NULL AND
    get_user_account_role(account_id) = 'account_owner'
  );

CREATE POLICY "Supervisor can view account profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    get_user_account_role(account_id) IN ('account_owner', 'supervisor')
  );
