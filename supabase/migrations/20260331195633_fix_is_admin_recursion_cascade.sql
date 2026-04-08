/*
  # Fix is_admin() Function to Avoid Recursion

  1. Changes
    - Drop and recreate is_admin() function to use auth.jwt() instead of querying profiles table
    - This prevents infinite recursion when policies call is_admin()
    - Recreate all dependent policies

  2. Security
    - Uses auth metadata which doesn't trigger RLS policies
    - Maintains same security level as before
*/

-- Drop existing function and all dependent policies
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Create new function that uses JWT metadata instead of querying profiles
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt()->>'role')::text = 'admin',
    false
  );
END;
$$;

-- Recreate the admin policies
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (is_admin());