/*
  # Fix get_orphaned_users: Exclude team members and super admins

  ## Changes
  - Rewrites get_orphaned_users() to only return account-owner-intent users
    who signed up, logged in, but whose account was never fully set up.
  - Excludes: super_admin profiles, and any user who is a team member/supervisor
    under another account (account_owner_id IS NOT NULL or has member/supervisor role).
  - The "Others" tab is now purely about self-registered account owners whose
    setup is incomplete — they signed up, logged in, but no account/subscription
    was ever created for them.
  - Reason column explains why they are not in the Active Accounts tab.
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
    a.id  AS linked_account_id,
    a.name AS linked_account_name,
    CASE
      -- Has an account but it is deactivated
      WHEN EXISTS (
        SELECT 1 FROM accounts ac WHERE ac.owner_id = p.id AND ac.is_active = false
      ) THEN
        'Account owner — account has been deactivated'

      -- Signed up and logged in but no account or role was ever created
      WHEN p.last_login_at IS NOT NULL THEN
        'Signed up and logged in — account setup was never completed'

      ELSE
        'Registered — account setup incomplete'
    END AS reason
  FROM profiles p
  LEFT JOIN accounts a ON a.owner_id = p.id
  WHERE p.is_deleted IS DISTINCT FROM true
    -- Exclude platform admins
    AND p.role <> 'super_admin'
    -- Exclude users who are team members under another account
    AND p.account_owner_id IS NULL
    -- Exclude users with any user_roles entry (they are managed team members)
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id
    )
    -- Exclude active account owners (already shown in Accounts tab)
    AND NOT EXISTS (
      SELECT 1 FROM accounts ac WHERE ac.owner_id = p.id AND ac.is_active = true
    )
    -- Exclude pure unverified (never logged in, no account) — those are in Unverified tab
    AND p.last_login_at IS NOT NULL
  ORDER BY p.created_at DESC;
END;
$$;
