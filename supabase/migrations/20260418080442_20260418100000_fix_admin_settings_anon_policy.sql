/*
  # Fix admin_settings anon RLS policy - restrict exposed columns

  ## Problem
  The existing "Public can read password policy" policy for the `anon` role uses `qual: "true"`
  which allows unauthenticated users to read ALL columns in admin_settings — including sensitive
  operational settings like session timeouts, file types, email schedules, etc.

  ## Fix
  Replace the broad anon SELECT policy with a security-definer RPC function that only
  returns the password policy columns. The anon SELECT policy on the table itself is dropped.
  Anonymous access is handled through a dedicated function returning only the safe subset.

  ## Changes
  - Drop the "Public can read password policy" policy on admin_settings for anon role
  - Create a security-definer function `get_public_password_policy()` that returns only password columns
  - This function is accessible by both anon and authenticated users safely
*/

DROP POLICY IF EXISTS "Public can read password policy" ON admin_settings;

CREATE OR REPLACE FUNCTION get_public_password_policy()
RETURNS TABLE (
  password_min_length integer,
  password_max_length integer,
  password_require_uppercase boolean,
  password_min_uppercase integer,
  password_require_lowercase boolean,
  password_min_lowercase integer,
  password_require_numbers boolean,
  password_min_numbers integer,
  password_require_special boolean,
  password_min_special integer,
  password_allowed_special_chars text,
  password_policy_applies_to jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    password_min_length,
    password_max_length,
    password_require_uppercase,
    password_min_uppercase,
    password_require_lowercase,
    password_min_lowercase,
    password_require_numbers,
    password_min_numbers,
    password_require_special,
    password_min_special,
    password_allowed_special_chars,
    password_policy_applies_to
  FROM admin_settings
  ORDER BY created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_public_password_policy() TO anon;
GRANT EXECUTE ON FUNCTION get_public_password_policy() TO authenticated;
