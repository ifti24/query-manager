/*
  # Fix profiles RLS admin visibility for account owners and supervisors

  1. Problem
    - The `current_user_is_admin_of_account` function checks legacy `profiles.role = 'admin'`,
      but the new role system uses `user_roles` with roles like `account_owner` and `supervisor`.
    - Consequently, when an account owner queries team members via
      `user_roles` joined to `profiles`, the nested profile rows are hidden by RLS,
      and the invited member doesn't appear in the data grid.

  2. Fix
    - Update the SECURITY DEFINER function to check `user_roles` for either
      `account_owner` or `supervisor` roles matching the given account.
    - This allows the existing `admins_view_account_profiles`, `admins_update_account_profiles`,
      and `admins_delete_account_profiles` policies to work correctly.
    - For supervisors, additionally ensure they can view member profiles in their account.
*/

CREATE OR REPLACE FUNCTION current_user_is_admin_of_account(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND account_id = p_account_id
      AND role IN ('account_owner', 'supervisor')
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND account_id = p_account_id
      AND role = 'admin'
  );
$$;
