/*
  # Fix Admin Access to Profiles (No Recursion)

  1. Changes
    - Create a security definer function to check if current user is admin
    - Add SELECT policy for admins to view all profiles
    - Add UPDATE policy for admins to manage all profiles
    - Add DELETE policy for admins to remove team members

  2. Security
    - Uses security definer function to avoid infinite recursion
    - Only users with role='admin' can view/manage all profiles
    - Regular team members can still only see their own profile
*/

-- Create a security definer function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (is_admin());