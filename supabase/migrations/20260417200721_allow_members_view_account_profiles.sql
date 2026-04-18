/*
  # Allow members to view profiles of others in their account

  ## Problem
  The profiles table only had SELECT policies for:
  - users viewing their own profile (users_select_own)
  - admins viewing all profiles in their account (admins_view_account_profiles)

  Members had no policy to view supervisor/account_owner profiles.
  When MySupervisorsTab joined user_roles with profiles, the profiles came back
  as null because the member couldn't read them — so the supervisors list was empty.

  ## Fix
  1. Add a SECURITY DEFINER helper function to get the current user's account_id
     without triggering RLS recursion.
  2. Add a SELECT policy on profiles that lets any authenticated user in an account
     view other profiles belonging to the same account.
*/

CREATE OR REPLACE FUNCTION get_current_user_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "Users can view profiles in their account"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND account_id = get_current_user_account_id()
  );
