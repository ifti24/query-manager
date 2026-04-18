/*
  # Setup Users, Roles, and Subscription

  ## Summary
  This migration configures 3 specific users with the following setup:

  1. ifti.ai24@gmail.com - Created as new auth user with super_admin role (no account)
  2. ifti.bbl@gmail.com - Existing user, updated to account_owner + supervisor roles, with premium subscription
  3. ifticse_kuet@hotmail.com - Existing user, updated to member role under the account owner's account

  ## Changes
  - Updates passwords for ifti.bbl@gmail.com and ifticse_kuet@hotmail.com to 'iiffttii'
  - Creates new auth user ifti.ai24@gmail.com with password 'iiffttii'
  - Creates an account for ifti.bbl@gmail.com named 'NA'
  - Creates a premium subscription for that account
  - Assigns correct roles in user_roles table
  - Updates profiles with correct role values and account linkage
*/

DO $$
DECLARE
  v_owner_id uuid := '68dcb84f-0267-4465-8961-797cd4ff1787';
  v_member_id uuid := '383b9a5a-ecd7-4e3e-acea-86c4a8d40f49';
  v_superadmin_id uuid;
  v_account_id uuid;
  v_subscription_id uuid;
BEGIN

  -- Update passwords for existing users
  UPDATE auth.users
  SET encrypted_password = crypt('iiffttii', gen_salt('bf'))
  WHERE id IN (v_owner_id, v_member_id);

  -- Create auth user for ifti.ai24@gmail.com (super_admin)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ifti.ai24@gmail.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      aud,
      role
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'ifti.ai24@gmail.com',
      crypt('iiffttii', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"], "role": "super_admin"}'::jsonb,
      '{"full_name": "NA"}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  END IF;

  SELECT id INTO v_superadmin_id FROM auth.users WHERE email = 'ifti.ai24@gmail.com';

  -- Ensure super_admin profile exists
  INSERT INTO profiles (id, email, full_name, role, is_active)
  VALUES (v_superadmin_id, 'ifti.ai24@gmail.com', 'NA', 'super_admin', true)
  ON CONFLICT (id) DO UPDATE SET role = 'super_admin', full_name = 'NA';

  -- Create account for the account owner
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE owner_id = v_owner_id) THEN
    INSERT INTO accounts (id, owner_id, name, is_active)
    VALUES (gen_random_uuid(), v_owner_id, 'NA', true)
    RETURNING id INTO v_account_id;
  ELSE
    SELECT id INTO v_account_id FROM accounts WHERE owner_id = v_owner_id LIMIT 1;
  END IF;

  -- Create premium subscription for the account
  IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE account_id = v_account_id) THEN
    INSERT INTO subscriptions (id, account_id, plan_id, status, queries_used, queries_reset_at, started_at)
    VALUES (gen_random_uuid(), v_account_id, 'premium', 'active', 0, now(), now())
    RETURNING id INTO v_subscription_id;
  ELSE
    SELECT id INTO v_subscription_id FROM subscriptions WHERE account_id = v_account_id LIMIT 1;
  END IF;

  -- Update account owner profile
  UPDATE profiles SET
    role = 'account_owner',
    full_name = COALESCE(NULLIF(full_name, ''), 'NA'),
    account_id = v_account_id,
    subscription_id = v_subscription_id
  WHERE id = v_owner_id;

  -- Update member profile
  UPDATE profiles SET
    role = 'member',
    full_name = COALESCE(NULLIF(full_name, ''), 'NA'),
    account_id = v_account_id,
    account_owner_id = v_owner_id
  WHERE id = v_member_id;

  -- Update super_admin profile with account linkage (none needed for super_admin)
  UPDATE profiles SET
    account_id = NULL,
    account_owner_id = NULL
  WHERE id = v_superadmin_id;

  -- Clear old user_roles for these users
  DELETE FROM user_roles WHERE user_id IN (v_owner_id, v_member_id, v_superadmin_id);

  -- Insert super_admin role (no account)
  INSERT INTO user_roles (user_id, account_id, role, created_by)
  VALUES (v_superadmin_id, NULL, 'super_admin', v_superadmin_id);

  -- Insert account_owner role
  INSERT INTO user_roles (user_id, account_id, role, created_by)
  VALUES (v_owner_id, v_account_id, 'account_owner', v_owner_id);

  -- Insert supervisor role for the owner (dual role)
  INSERT INTO user_roles (user_id, account_id, role, created_by)
  VALUES (v_owner_id, v_account_id, 'supervisor', v_owner_id);

  -- Insert member role
  INSERT INTO user_roles (user_id, account_id, role, created_by)
  VALUES (v_member_id, v_account_id, 'member', v_owner_id);

  -- Admin settings for account if not exists
  IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE account_id = v_account_id) THEN
    INSERT INTO admin_settings (account_id) VALUES (v_account_id);
  END IF;

END $$;
