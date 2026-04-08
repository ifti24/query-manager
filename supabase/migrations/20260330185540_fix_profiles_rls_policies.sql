/*
  # Fix infinite recursion in profiles RLS policies

  1. Changes
    - Remove recursive admin policy checks that cause infinite loops
    - Simplify to basic user access patterns
    - Users can only read/update their own profile
    - Admin checks will be handled at application level instead of database level
  2. Security
    - Users still have RLS protection - they can only access their own data
    - Admin functionality moved to application-level authorization
*/

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
  ON profiles
  TO service_role
  USING (true)
  WITH CHECK (true);