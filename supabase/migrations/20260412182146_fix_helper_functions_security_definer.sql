/*
  # Fix infinite RLS recursion by using SECURITY DEFINER on helper functions

  ## Problem
  The helper functions (is_platform_admin, is_account_manager, is_admin, current_user_account_id)
  all query the user_roles table. The user_roles RLS policies call these same functions.
  This creates infinite recursion, causing "Database error querying schema" on every login.

  ## Fix
  Recreate all helper functions with SECURITY DEFINER so they bypass RLS when querying
  user_roles, breaking the recursion loop. The functions still use auth.uid() so they
  remain secure — they just bypass the RLS check on user_roles itself.
*/

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
