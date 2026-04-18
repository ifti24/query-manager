/*
  # Fix conflicting role CHECK constraints on profiles table

  ## Problem
  There are two conflicting CHECK constraints on the `role` column:
  1. `profiles_role_check_v2` - allows: super_admin, account_owner, admin, admin_support, supervisor, member, team_member
  2. `profiles_role_new_check` - allows: super_admin, support_admin, account_owner, supervisor, member

  Both must pass simultaneously. The column default is 'team_member' which fails
  `profiles_role_new_check`, causing "Database error querying schema" during signInWithPassword
  because the auth trigger fires and fails the constraint check.

  ## Fix
  1. Drop both old constraints
  2. Update the column default to 'member' (valid in new system)
  3. Update any existing 'team_member' or 'admin'/'admin_support' rows to valid values
  4. Add a single clean constraint with the correct allowed values
*/

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check_v2;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_new_check;

UPDATE public.profiles SET role = 'member' WHERE role IN ('team_member', 'admin', 'admin_support');

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'member';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['super_admin'::text, 'support_admin'::text, 'account_owner'::text, 'supervisor'::text, 'member'::text]));
