/*
  # Fix Profiles RLS Infinite Recursion

  ## Problem
  Several RLS policies on the `profiles` table query `profiles` itself in subselects,
  causing infinite recursion when any auth operation tries to validate the schema.

  Affected policies:
  - "Super admin can view all profiles" - uses subselect on profiles
  - "Supervisor can view account profiles" - uses subselect on profiles
  - "Admin support can view account profiles" - uses subselect on profiles
  - "Account managers view/update/delete" - calls current_user_account_id() which queries profiles

  ## Fix
  1. Make current_user_account_id() a SECURITY DEFINER function so it bypasses RLS
  2. Replace profile-self-referencing policies with user_roles-based lookups
  3. Drop and recreate affected policies using safe non-recursive checks
*/

-- Fix current_user_account_id to use SECURITY DEFINER (bypasses RLS)
CREATE OR REPLACE FUNCTION public.current_user_account_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_account_id uuid;
BEGIN
  SELECT account_id INTO v_account_id FROM profiles WHERE id = auth.uid();
  RETURN v_account_id;
END;
$$;

-- Fix is_platform_admin to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'support_admin')
    AND account_id IS NULL
  );
END;
$$;

-- Fix is_account_manager to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_account_manager(p_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND account_id = p_account_id
    AND role IN ('account_owner', 'supervisor')
  ) OR is_platform_admin();
END;
$$;

-- Drop the recursion-causing policies
DROP POLICY IF EXISTS "Super admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Supervisor can view account profiles" ON profiles;
DROP POLICY IF EXISTS "Admin support can view account profiles" ON profiles;

-- Recreate "Super admin can view all profiles" using user_roles (no profiles self-reference)
CREATE POLICY "Super admin can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND account_id IS NULL
    )
  );

-- Recreate "Supervisor can view account profiles" using user_roles
CREATE POLICY "Supervisor can view account profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'supervisor'
      AND ur.account_id = profiles.account_id
    )
  );

-- Recreate "Admin support can view account profiles" using user_roles
CREATE POLICY "Admin support can view account profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN user_roles ur2 ON ur2.account_id = ur.account_id AND ur2.role = 'admin_support'
      WHERE ur2.user_id = auth.uid()
      AND ur.account_id = profiles.account_id
    )
  );
