/*
  # Platform Admin: Unverified Signups Access

  ## Summary
  Adds a secure function that allows super_admin users to query profiles
  that have signed up (auth user + profile exists) but have never logged in
  — i.e. last_login_at IS NULL. These represent users who registered but
  did not complete their first login / onboarding.

  ## Changes
  - Creates `get_unverified_signups()` SECURITY DEFINER RPC function
    that returns profile rows where last_login_at IS NULL, accessible
    only to super_admin users.

  ## Security
  - SECURITY DEFINER so it can bypass RLS on profiles to read all rows
  - Internally checks that the calling user has super_admin role before returning data
  - Returns empty result set if caller is not super_admin
*/

CREATE OR REPLACE FUNCTION get_unverified_signups()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  account_display_name text,
  mobile_number text,
  account_type text,
  created_at timestamptz,
  last_login_at timestamptz,
  is_active boolean,
  expected_supervisor_count integer,
  expected_member_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Only super_admin can call this
  SELECT ur.role INTO v_caller_role
  FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.account_display_name,
    p.mobile_number,
    p.account_type,
    p.created_at,
    p.last_login_at,
    p.is_active,
    a.expected_supervisor_count,
    a.expected_member_count
  FROM profiles p
  LEFT JOIN accounts a ON a.owner_id = p.id
  WHERE p.last_login_at IS NULL
    AND p.is_deleted IS DISTINCT FROM true
  ORDER BY p.created_at DESC;
END;
$$;
