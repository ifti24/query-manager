/*
  # Nuclear Fix: Drop and Rebuild All Profiles RLS Policies

  ## Problem
  Multiple policies on `profiles` cause infinite recursion:
  - Policies calling current_user_account_id() which SELECTs from profiles
  - Subselect policies querying profiles within profiles policies
  - The FOR ALL service role policy doesn't prevent other policies from evaluating

  ## Fix
  Drop every single policy on profiles and rebuild with ONLY safe, non-recursive patterns.
  All role checks go through `user_roles` table or JWT claims, never back to `profiles`.
  The current_user_account_id() function is replaced with a version that uses user_roles.
*/

-- Drop ALL existing policies on profiles
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

-- Fix current_user_account_id to NOT query profiles (use user_roles instead)
CREATE OR REPLACE FUNCTION public.current_user_account_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_account_id uuid;
BEGIN
  SELECT account_id INTO v_account_id
  FROM user_roles
  WHERE user_id = auth.uid()
  AND account_id IS NOT NULL
  LIMIT 1;
  RETURN v_account_id;
END;
$$;

-- Rebuild all policies using ONLY safe, non-recursive patterns

-- 1. Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2. Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 4. Platform admins (super_admin, support_admin) can view all profiles
CREATE POLICY "Platform admins view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'support_admin')
      AND account_id IS NULL
    )
  );

-- 5. Platform admins can update all profiles
CREATE POLICY "Platform admins update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'support_admin')
      AND account_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'support_admin')
      AND account_id IS NULL
    )
  );

-- 6. Platform admins can delete profiles
CREATE POLICY "Platform admins delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'support_admin')
      AND account_id IS NULL
    )
  );

-- 7. Account owners can view profiles in their account
CREATE POLICY "Account owner can view account profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'account_owner'
      AND account_id = profiles.account_id
    )
  );

-- 8. Account owners can insert profiles into their account
CREATE POLICY "Account owner can insert account profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'account_owner'
      AND account_id = profiles.account_id
    )
  );

-- 9. Account owners can update profiles in their account
CREATE POLICY "Account owner can update account profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'account_owner'
      AND account_id = profiles.account_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'account_owner'
      AND account_id = profiles.account_id
    )
  );

-- 10. Supervisors can view profiles in their account
CREATE POLICY "Supervisor can view account profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'supervisor'
      AND account_id = profiles.account_id
    )
  );

-- 11. Team members can view profiles of query participants
CREATE POLICY "Team members can view query participants"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR id IN (
      WITH assigned_queries AS (
        SELECT query_id FROM query_assignments WHERE assigned_to = auth.uid()
      )
      SELECT DISTINCT queries.created_by FROM queries WHERE queries.id IN (SELECT query_id FROM assigned_queries)
      UNION
      SELECT DISTINCT query_responses.responded_by FROM query_responses WHERE query_responses.query_id IN (SELECT query_id FROM assigned_queries)
      UNION
      SELECT DISTINCT query_comments.created_by FROM query_comments WHERE query_comments.query_id IN (SELECT query_id FROM assigned_queries)
    )
  );

-- 12. Service role bypass (for triggers, edge functions)
CREATE POLICY "Service role can manage all profiles"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
