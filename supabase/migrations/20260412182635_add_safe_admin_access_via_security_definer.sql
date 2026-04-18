/*
  # Add safe admin access for profiles via security definer function

  ## Problem
  After the nuclear reset, admins can only see their own profile.
  The admin dashboard needs to read all profiles in their account.

  ## Solution
  Create a SECURITY DEFINER function that checks if the current user is an admin
  by querying profiles with RLS bypassed (safe because it only returns a boolean
  for the calling user's own role — no user data is exposed).
  Then create a profile policy that calls this function.

  The function ONLY reads the current user's OWN profile row to check their role,
  so it cannot recurse infinitely.
*/

CREATE OR REPLACE FUNCTION public.current_user_is_admin_of_account(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND account_id = p_account_id
      AND role = 'admin'
  );
$$;

-- Admins can view all profiles in their account
CREATE POLICY "admins_view_account_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    current_user_is_admin_of_account(account_id)
  );

-- Admins can update profiles in their account (e.g., deactivate members)
CREATE POLICY "admins_update_account_profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    current_user_is_admin_of_account(account_id)
  )
  WITH CHECK (
    account_id IS NOT NULL AND
    current_user_is_admin_of_account(account_id)
  );

-- Admins can insert profiles in their account (invite members)
CREATE POLICY "admins_insert_account_profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL AND
    current_user_is_admin_of_account(account_id)
  );

-- Admins can delete profiles in their account
CREATE POLICY "admins_delete_account_profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL AND
    current_user_is_admin_of_account(account_id)
  );
