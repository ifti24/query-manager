/*
  # Role System Redesign - Main Migration

  ## Summary
  Replaces the binary admin/team_member role model with a 5-tier hierarchy:
  - super_admin: Platform owner (backend only)
  - support_admin: Company staff (backend only)
  - account_owner: Customer who purchased the platform
  - supervisor: Manages queries within an account (was "admin")
  - member: Regular user within an account (was "team_member")
*/

-- ============================================================
-- Step 1: Create accounts table
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  name       text NOT NULL DEFAULT 'My Account',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 2: Add account_id to profiles
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- Step 3: Create user_roles junction table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('super_admin','support_admin','account_owner','supervisor','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE (user_id, account_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 4: Rename existing role values on profiles
-- ============================================================
UPDATE profiles SET role = 'supervisor' WHERE role = 'admin';
UPDATE profiles SET role = 'member' WHERE role = 'team_member';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_new_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_new_check
  CHECK (role IN ('super_admin','support_admin','account_owner','supervisor','member'));

-- ============================================================
-- Step 5: Migrate supervisors -> create accounts + user_roles
-- ============================================================
INSERT INTO accounts (id, owner_id, name, created_at, updated_at)
SELECT
  gen_random_uuid(),
  p.id,
  COALESCE(p.full_name, split_part(p.email, '@', 1)) || '''s Account',
  p.created_at,
  now()
FROM profiles p
WHERE p.role = 'supervisor'
ON CONFLICT DO NOTHING;

UPDATE profiles p
SET account_id = a.id
FROM accounts a
WHERE a.owner_id = p.id AND p.role = 'supervisor' AND p.account_id IS NULL;

UPDATE profiles SET role = 'account_owner' WHERE role = 'supervisor';

INSERT INTO user_roles (user_id, account_id, role)
SELECT p.id, p.account_id, 'account_owner'
FROM profiles p
WHERE p.role = 'account_owner' AND p.account_id IS NOT NULL
ON CONFLICT (user_id, account_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, account_id, role)
SELECT p.id, p.account_id, 'supervisor'
FROM profiles p
WHERE p.role = 'account_owner' AND p.account_id IS NOT NULL
ON CONFLICT (user_id, account_id, role) DO NOTHING;

-- ============================================================
-- Step 6: Migrate members -> link to account + user_roles
-- ============================================================
UPDATE profiles p
SET account_id = (SELECT a.id FROM accounts a LIMIT 1)
WHERE p.role = 'member' AND p.account_id IS NULL
AND EXISTS (SELECT 1 FROM accounts LIMIT 1);

INSERT INTO user_roles (user_id, account_id, role)
SELECT p.id, p.account_id, 'member'
FROM profiles p
WHERE p.role = 'member' AND p.account_id IS NOT NULL
ON CONFLICT (user_id, account_id, role) DO NOTHING;

-- ============================================================
-- Step 7: Migrate subscriptions admin_id -> account_id
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'admin_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscriptions' AND column_name = 'account_id'
    ) THEN
      ALTER TABLE subscriptions ADD COLUMN account_id uuid;
    END IF;
    UPDATE subscriptions s
    SET account_id = a.id
    FROM accounts a
    WHERE a.owner_id = s.admin_id AND s.account_id IS NULL;
    ALTER TABLE subscriptions DROP COLUMN admin_id;
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- Step 8: Migrate admin_settings admin_id -> account_id
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'admin_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'admin_settings' AND column_name = 'account_id'
    ) THEN
      ALTER TABLE admin_settings ADD COLUMN account_id uuid;
    END IF;
    UPDATE admin_settings s
    SET account_id = a.id
    FROM accounts a
    WHERE a.owner_id = s.admin_id AND s.account_id IS NULL;
    ALTER TABLE admin_settings DROP COLUMN admin_id;
    ALTER TABLE admin_settings
      ADD CONSTRAINT admin_settings_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- Step 9: Create new role helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION has_role(p_role text, p_account_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_account_id IS NULL THEN
    RETURN EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = p_role AND account_id IS NULL);
  ELSE
    RETURN EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = p_role AND account_id = p_account_id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','support_admin') AND account_id IS NULL);
END; $$;

CREATE OR REPLACE FUNCTION current_user_account_id()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account_id uuid;
BEGIN
  SELECT account_id INTO v_account_id FROM profiles WHERE id = auth.uid();
  RETURN v_account_id;
END; $$;

CREATE OR REPLACE FUNCTION is_account_manager(p_account_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND account_id = p_account_id AND role IN ('account_owner','supervisor')
  ) OR is_platform_admin();
END; $$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account_id uuid;
BEGIN
  SELECT account_id INTO v_account_id FROM profiles WHERE id = auth.uid();
  IF v_account_id IS NOT NULL THEN RETURN is_account_manager(v_account_id); END IF;
  RETURN is_platform_admin();
END; $$;

CREATE OR REPLACE FUNCTION check_query_limit(p_account_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_plan subscription_plans%ROWTYPE;
  v_sub subscriptions%ROWTYPE;
BEGIN
  SELECT s.* INTO v_sub FROM subscriptions s
  WHERE s.account_id = p_account_id AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT p.* INTO v_plan FROM subscription_plans p WHERE p.id = v_sub.plan_id;
  IF v_plan.is_trial THEN RETURN v_sub.queries_used < v_plan.queries_per_month; END IF;
  IF v_sub.queries_reset_at < date_trunc('month', now()) THEN
    UPDATE subscriptions SET queries_used = 0, queries_reset_at = date_trunc('month', now()) WHERE id = v_sub.id;
    RETURN true;
  END IF;
  RETURN v_sub.queries_used < COALESCE(v_plan.queries_soft_cap, v_plan.queries_per_month);
END; $$;

-- ============================================================
-- Step 10: RLS for profiles
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Platform admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Platform admins update all profiles" ON profiles;
DROP POLICY IF EXISTS "Platform admins delete profiles" ON profiles;
DROP POLICY IF EXISTS "Account managers view account profiles" ON profiles;
DROP POLICY IF EXISTS "Account managers update account profiles" ON profiles;
DROP POLICY IF EXISTS "Account managers delete account profiles" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Platform admins view all profiles" ON profiles FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY "Platform admins update all profiles" ON profiles FOR UPDATE TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Platform admins delete profiles" ON profiles FOR DELETE TO authenticated USING (is_platform_admin());
CREATE POLICY "Account managers view account profiles" ON profiles FOR SELECT TO authenticated
  USING (account_id IS NOT NULL AND account_id = current_user_account_id() AND is_account_manager(current_user_account_id()));
CREATE POLICY "Account managers update account profiles" ON profiles FOR UPDATE TO authenticated
  USING (account_id IS NOT NULL AND account_id = current_user_account_id() AND is_account_manager(current_user_account_id()))
  WITH CHECK (account_id IS NOT NULL AND account_id = current_user_account_id() AND is_account_manager(current_user_account_id()));
CREATE POLICY "Account managers delete account profiles" ON profiles FOR DELETE TO authenticated
  USING (account_id IS NOT NULL AND account_id = current_user_account_id() AND is_account_manager(current_user_account_id()));
CREATE POLICY "Service role can manage all profiles" ON profiles TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Step 11: RLS for accounts
-- ============================================================
DROP POLICY IF EXISTS "Platform admins manage all accounts" ON accounts;
DROP POLICY IF EXISTS "Account users view their account" ON accounts;
DROP POLICY IF EXISTS "Account owners update their account" ON accounts;

CREATE POLICY "Platform admins manage all accounts" ON accounts FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Account users view their account" ON accounts FOR SELECT TO authenticated USING (owner_id = auth.uid() OR id = current_user_account_id());
CREATE POLICY "Account owners update their account" ON accounts FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- Step 12: RLS for user_roles
-- ============================================================
DROP POLICY IF EXISTS "Platform admins manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Account owners manage account roles" ON user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON user_roles;

CREATE POLICY "Platform admins manage all roles" ON user_roles FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Account owners manage account roles" ON user_roles FOR ALL TO authenticated
  USING (account_id IS NOT NULL AND is_account_manager(account_id) AND role IN ('supervisor','member'))
  WITH CHECK (account_id IS NOT NULL AND is_account_manager(account_id) AND role IN ('supervisor','member'));
CREATE POLICY "Users view own roles" ON user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- Step 13: RLS for queries
-- ============================================================
DROP POLICY IF EXISTS "Platform admins manage all queries" ON queries;
DROP POLICY IF EXISTS "Account managers manage account queries" ON queries;
DROP POLICY IF EXISTS "Members view assigned queries" ON queries;
DROP POLICY IF EXISTS "Members update assigned query status" ON queries;

CREATE POLICY "Platform admins manage all queries" ON queries FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Account managers manage account queries" ON queries FOR ALL TO authenticated USING (is_account_manager(current_user_account_id())) WITH CHECK (is_account_manager(current_user_account_id()));
CREATE POLICY "Members view assigned queries" ON queries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM query_assignments qa WHERE qa.query_id = queries.id AND qa.assigned_to = auth.uid()));
CREATE POLICY "Members update assigned query status" ON queries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM query_assignments qa WHERE qa.query_id = queries.id AND qa.assigned_to = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM query_assignments qa WHERE qa.query_id = queries.id AND qa.assigned_to = auth.uid()));

-- ============================================================
-- Step 14: RLS for query_assignments
-- ============================================================
DROP POLICY IF EXISTS "Platform admins manage all assignments" ON query_assignments;
DROP POLICY IF EXISTS "Account managers manage account assignments" ON query_assignments;
DROP POLICY IF EXISTS "Members view own assignments" ON query_assignments;

CREATE POLICY "Platform admins manage all assignments" ON query_assignments FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Account managers manage account assignments" ON query_assignments FOR ALL TO authenticated USING (is_account_manager(current_user_account_id())) WITH CHECK (is_account_manager(current_user_account_id()));
CREATE POLICY "Members view own assignments" ON query_assignments FOR SELECT TO authenticated USING (assigned_to = auth.uid());

-- ============================================================
-- Step 15: RLS for query_responses
-- ============================================================
DROP POLICY IF EXISTS "Platform admins manage all responses" ON query_responses;
DROP POLICY IF EXISTS "Account managers manage account responses" ON query_responses;
DROP POLICY IF EXISTS "Members view responses for assigned queries" ON query_responses;
DROP POLICY IF EXISTS "Members insert responses for assigned queries" ON query_responses;

CREATE POLICY "Platform admins manage all responses" ON query_responses FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Account managers manage account responses" ON query_responses FOR ALL TO authenticated USING (is_account_manager(current_user_account_id())) WITH CHECK (is_account_manager(current_user_account_id()));
CREATE POLICY "Members view responses for assigned queries" ON query_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM query_assignments qa WHERE qa.query_id = query_responses.query_id AND qa.assigned_to = auth.uid()));
CREATE POLICY "Members insert responses for assigned queries" ON query_responses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM query_assignments qa WHERE qa.query_id = query_responses.query_id AND qa.assigned_to = auth.uid()) AND responded_by = auth.uid());

-- ============================================================
-- Step 16: RLS for query_comments
-- ============================================================
DROP POLICY IF EXISTS "Platform admins manage all comments" ON query_comments;
DROP POLICY IF EXISTS "Account managers manage account comments" ON query_comments;
DROP POLICY IF EXISTS "Members view comments for assigned queries" ON query_comments;
DROP POLICY IF EXISTS "Members insert comments for assigned queries" ON query_comments;

CREATE POLICY "Platform admins manage all comments" ON query_comments FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Account managers manage account comments" ON query_comments FOR ALL TO authenticated USING (is_account_manager(current_user_account_id())) WITH CHECK (is_account_manager(current_user_account_id()));
CREATE POLICY "Members view comments for assigned queries" ON query_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM query_assignments qa WHERE qa.query_id = query_comments.query_id AND qa.assigned_to = auth.uid()));
CREATE POLICY "Members insert comments for assigned queries" ON query_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM query_assignments qa WHERE qa.query_id = query_comments.query_id AND qa.assigned_to = auth.uid()) AND created_by = auth.uid());

-- ============================================================
-- Step 17: RLS for subscriptions
-- ============================================================
DROP POLICY IF EXISTS "Platform admins manage all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Account managers view account subscription" ON subscriptions;
DROP POLICY IF EXISTS "Account managers insert account subscription" ON subscriptions;
DROP POLICY IF EXISTS "Account managers update account subscription" ON subscriptions;

CREATE POLICY "Platform admins manage all subscriptions" ON subscriptions FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Account managers view account subscription" ON subscriptions FOR SELECT TO authenticated USING (account_id IS NOT NULL AND is_account_manager(account_id));
CREATE POLICY "Account managers insert account subscription" ON subscriptions FOR INSERT TO authenticated WITH CHECK (account_id IS NOT NULL AND is_account_manager(account_id));
CREATE POLICY "Account managers update account subscription" ON subscriptions FOR UPDATE TO authenticated USING (account_id IS NOT NULL AND is_account_manager(account_id)) WITH CHECK (account_id IS NOT NULL AND is_account_manager(account_id));

-- ============================================================
-- Step 18: RLS for admin_settings
-- ============================================================
DROP POLICY IF EXISTS "Platform admins manage all settings" ON admin_settings;
DROP POLICY IF EXISTS "Account managers view account settings" ON admin_settings;
DROP POLICY IF EXISTS "Account managers insert account settings" ON admin_settings;
DROP POLICY IF EXISTS "Account managers update account settings" ON admin_settings;
DROP POLICY IF EXISTS "Public can read password policy" ON admin_settings;
DROP POLICY IF EXISTS "Members can view account settings" ON admin_settings;

CREATE POLICY "Platform admins manage all settings" ON admin_settings FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Account managers view account settings" ON admin_settings FOR SELECT TO authenticated USING (account_id IS NOT NULL AND is_account_manager(account_id));
CREATE POLICY "Account managers insert account settings" ON admin_settings FOR INSERT TO authenticated WITH CHECK (account_id IS NOT NULL AND is_account_manager(account_id));
CREATE POLICY "Account managers update account settings" ON admin_settings FOR UPDATE TO authenticated USING (account_id IS NOT NULL AND is_account_manager(account_id)) WITH CHECK (account_id IS NOT NULL AND is_account_manager(account_id));
CREATE POLICY "Public can read password policy" ON admin_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Members can view account settings" ON admin_settings FOR SELECT TO authenticated USING (account_id IS NOT NULL AND account_id = current_user_account_id());

-- ============================================================
-- Step 19: Update handle_new_user trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Step 20: Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_account_id ON user_roles(account_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_account_id ON subscriptions(account_id);
