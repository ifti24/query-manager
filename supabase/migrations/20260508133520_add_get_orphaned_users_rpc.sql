/*
  # Platform Admin: Orphaned / Other Users RPC

  ## Summary
  Adds a secure function `get_orphaned_users()` that returns all profiles that fall
  into neither the "active account owner" bucket nor the "unverified signup (never
  logged in)" bucket. These are users that need attention or context for the super admin.

  ## Categories returned
  - super_admin: platform-level admin accounts
  - invited_member: team members properly assigned under an account
  - logged_in_no_account: signed up and logged in, but no account/role was ever created
  - incomplete_setup: signed up (never logged in) but their profile already has a
    user_role entry (partial setup)

  ## Security
  - SECURITY DEFINER: bypasses RLS to read all profiles
  - Internally checks caller is super_admin before returning any data
*/

CREATE OR REPLACE FUNCTION get_orphaned_users()
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
  linked_account_id uuid,
  linked_account_name text,
  reason text
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
    a.id AS linked_account_id,
    a.name AS linked_account_name,
    CASE
      -- Super admin: platform-level role, no account needed
      WHEN p.role = 'super_admin' THEN
        'Platform super admin — no account associated'

      -- Has a user_role entry as account_owner but account is inactive
      WHEN EXISTS (
        SELECT 1 FROM user_roles ur2
        JOIN accounts ac ON ac.id = ur2.account_id
        WHERE ur2.user_id = p.id AND ur2.role = 'account_owner' AND ac.is_active = false
      ) THEN
        'Account owner — account is deactivated'

      -- Invited team member: has account_id set in profile (assigned under an owner)
      WHEN p.account_id IS NOT NULL AND p.account_owner_id IS NOT NULL THEN
        'Invited team member under an account owner'

      -- Has a user_role entry (supervisor or member) linked to an active account
      WHEN EXISTS (
        SELECT 1 FROM user_roles ur3
        WHERE ur3.user_id = p.id AND ur3.role IN ('supervisor', 'member')
      ) THEN
        'Team member with role assigned — no direct account ownership'

      -- Logged in but never got an account or role assigned
      WHEN p.last_login_at IS NOT NULL AND p.account_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM user_roles ur4 WHERE ur4.user_id = p.id
      ) THEN
        'Signed up and logged in — account setup was never completed'

      ELSE
        'Registered but account setup incomplete — never logged in or assigned'
    END AS reason
  FROM profiles p
  LEFT JOIN accounts a ON a.owner_id = p.id
  WHERE p.is_deleted IS DISTINCT FROM true
    -- Exclude active account owners (shown in Accounts tab)
    AND NOT EXISTS (
      SELECT 1 FROM accounts ac
      WHERE ac.owner_id = p.id AND ac.is_active = true
    )
    -- Exclude pure unverified signups (shown in Unverified tab):
    -- those with last_login_at IS NULL AND no user_role AND not super_admin
    AND NOT (
      p.last_login_at IS NULL
      AND p.role <> 'super_admin'
      AND NOT EXISTS (SELECT 1 FROM user_roles ur5 WHERE ur5.user_id = p.id)
    )
  ORDER BY p.created_at DESC;
END;
$$;
