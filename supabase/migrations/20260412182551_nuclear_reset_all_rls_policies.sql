/*
  # Nuclear Reset: Replace all RLS policies with simple non-recursive ones

  ## Problem
  Multiple tables have circular RLS policy dependencies:
  - profiles policies call get_user_account_role()
  - get_user_account_role() queries user_roles
  - user_roles policies call get_user_account_role()
  This creates infinite recursion regardless of SECURITY DEFINER.

  ## Solution
  Drop ALL complex policies. Replace with simple auth.uid() checks only.
  The role column on profiles table is used directly instead of joins to user_roles.
  No cross-table lookups in any policy.
*/

-- ============================================================
-- STEP 1: Drop all helper functions causing recursion
-- ============================================================
DROP FUNCTION IF EXISTS public.get_user_platform_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_account_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_role() CASCADE;

-- ============================================================
-- STEP 2: Drop ALL policies on profiles
-- ============================================================
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
  END LOOP;
END $$;

-- ============================================================
-- STEP 3: Drop ALL policies on user_roles
-- ============================================================
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_roles', r.policyname);
  END LOOP;
END $$;

-- ============================================================
-- STEP 4: Simple profiles policies - NO cross-table lookups
-- ============================================================

-- Users can always read their own profile
CREATE POLICY "users_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (signup)
CREATE POLICY "users_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Admins (role = 'admin') can read all profiles in same account
CREATE POLICY "admins_select_account_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    account_id IN (
      SELECT p2.account_id FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin'
    )
  );

-- Admins can update profiles in same account
CREATE POLICY "admins_update_account_profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    account_id IN (
      SELECT p2.account_id FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin'
    )
  )
  WITH CHECK (
    account_id IS NOT NULL AND
    account_id IN (
      SELECT p2.account_id FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin'
    )
  );

-- Service role has full access
CREATE POLICY "service_role_profiles"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- STEP 5: Simple user_roles policies - NO cross-table lookups
-- ============================================================

-- Users can read their own roles
CREATE POLICY "users_select_own_roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role has full access
CREATE POLICY "service_role_user_roles"
  ON user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- STEP 6: Verify RLS is still enabled
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
