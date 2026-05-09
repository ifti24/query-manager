/*
  # Fix get_unverified_signups: Exclude team members and super admins

  ## Changes
  - Rewrites get_unverified_signups() to only return users who signed up
    intending to be account owners (individual or business) but never logged in.
  - Excludes: super_admin profiles, any user who has a user_roles entry
    (meaning they were invited as a team member under another account), and
    any user whose profile has account_owner_id set (assigned under an owner).
  - Only users with last_login_at IS NULL who are not part of any existing
    account as a member/supervisor will appear here.
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
    -- Exclude platform admins
    AND p.role <> 'super_admin'
    -- Exclude users who are already assigned as team members under another account
    AND p.account_owner_id IS NULL
    -- Exclude users who have any user_roles entry (invited members, supervisors, etc.)
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id
    )
  ORDER BY p.created_at DESC;
END;
$$;
