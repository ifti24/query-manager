/*
  # Fix All Profile-Querying Functions

  ## Problem
  Several functions query `profiles` table without SECURITY DEFINER or with
  incorrect logic that can cause issues during PostgREST schema cache build
  and during authentication flows.

  ## Functions Fixed
  - `is_admin` - now uses user_roles instead of profiles
  - `is_admin_or_support` - now uses user_roles instead of profiles  
  - `is_account_owner_or_admin` - now uses user_roles instead of profiles

  ## Additional
  - Functions `check_urgent_status` and `update_consecutive_admin_comments`
    query profiles but are SECURITY DEFINER (safe as triggers run as postgres)
*/

-- Fix is_admin to use user_roles instead of profiles (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('account_owner', 'supervisor', 'super_admin', 'support_admin')
  );
END;
$$;

-- Fix is_admin_or_support to use user_roles instead of profiles
CREATE OR REPLACE FUNCTION public.is_admin_or_support()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('account_owner', 'supervisor', 'super_admin', 'support_admin', 'admin_support')
  );
END;
$$;

-- Fix is_account_owner_or_admin to use user_roles instead of profiles
CREATE OR REPLACE FUNCTION public.is_account_owner_or_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = $1
    AND ur.role IN ('account_owner', 'supervisor', 'super_admin', 'support_admin')
  );
END;
$$;
