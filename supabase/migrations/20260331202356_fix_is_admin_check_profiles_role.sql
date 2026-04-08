/*
  # Fix is_admin() to check profiles.role column
  
  1. Changes
    - Update is_admin() function to query profiles table directly
    - Mark function as SECURITY DEFINER to bypass RLS
    - This allows the function to read the profiles table without triggering RLS policies
    
  2. Security
    - Function is SECURITY DEFINER so it runs with elevated privileges
    - Safe because it only checks the role column for the current user
    - Prevents infinite recursion by not being subject to RLS policies
*/

-- Drop and recreate the is_admin function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role = 'admin'
     FROM profiles
     WHERE id = auth.uid()),
    false
  );
END;
$$;