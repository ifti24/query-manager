/*
  # Fix get_public_password_policy to always read platform-level settings

  The previous version:
  1. Ordered by created_at DESC with no filter — could return an account owner's
     row instead of the platform admin row (account_id IS NULL).
  2. Declared the return type as text[] but the column is jsonb.

  This fix drops and recreates with the correct return type and an explicit
  WHERE account_id IS NULL filter.
*/

DROP FUNCTION IF EXISTS get_public_password_policy();

CREATE FUNCTION get_public_password_policy()
RETURNS TABLE (
  password_min_length int,
  password_max_length int,
  password_require_uppercase boolean,
  password_min_uppercase int,
  password_require_lowercase boolean,
  password_min_lowercase int,
  password_require_numbers boolean,
  password_min_numbers int,
  password_require_special boolean,
  password_min_special int,
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
  WHERE account_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_public_password_policy() TO anon, authenticated;
