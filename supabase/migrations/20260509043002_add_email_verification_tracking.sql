/*
  # App-level email verification tracking

  Since Supabase's built-in email confirmation is disabled (all users are
  auto-confirmed), we track email verification ourselves.

  ## Changes
  1. `profiles` — add `email_verified_at` (nullable timestamptz). NULL = unverified.
  2. `email_verification_tokens` — new table to store short-lived verification tokens.
     - `id` uuid PK
     - `user_id` FK → profiles(id)
     - `token` text unique (random hex string)
     - `expires_at` timestamptz
     - `used_at` timestamptz (NULL until consumed)
     - `created_at` timestamptz

  ## Security
  - RLS enabled on `email_verification_tokens`
  - No user-facing SELECT/UPDATE policies — all operations go through the
    `verify-email` edge function using the service-role key.
  - Public anon INSERT is intentionally NOT granted.

  ## Notes
  - Existing users are NOT retroactively marked verified here. The admin can
    mark them verified via the platform dashboard or they re-verify on next login.
  - The `require_email_verification` flag in `admin_settings` controls whether
    unverified users are blocked from logging in.
*/

-- 1. Add column to profiles (safe — idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email_verified_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email_verified_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Mark all EXISTING account_owner users as already verified so they are not
-- suddenly locked out. Only NEW signups after this migration will require verification.
UPDATE public.profiles
SET email_verified_at = created_at
WHERE email_verified_at IS NULL
  AND id IN (
    SELECT user_id FROM public.user_roles WHERE role = 'account_owner'
  );

-- 2. Create token table
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz DEFAULT NULL,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
