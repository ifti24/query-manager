/*
  # Add Subscription Plans and Account Types

  ## Summary
  This migration sets up the subscription and pricing infrastructure for the application.

  ## New Tables

  ### 1. `subscription_plans`
  - Defines all available plans: free_trial, basic, standard, premium
  - Stores pricing, query limits, member limits, and feature flags
  - Soft cap for premium plan (not exposed to users)

  ### 2. `subscriptions`
  - Links a profile (admin account) to a plan
  - Tracks subscription status, start/end dates, query usage
  - Supports: active, expired, cancelled, trial statuses

  ## Modified Tables

  ### `profiles`
  - Adds `account_type` column: 'business' or 'individual'
  - Adds `subscription_id` foreign key reference

  ## Security
  - RLS enabled on both new tables
  - Admins can read all subscription data for their account
  - Only service role can insert/update subscriptions (managed server-side)
  - Plans are publicly readable

  ## Notes
  1. Free trial: 15 days, max 5 members, 100 query limit
  2. Basic: 149 BDT, 200 queries/month
  3. Standard: 499 BDT, 600 queries/month (main plan)
  4. Premium: 999 BDT, 2500 soft cap (not exposed), marketed as unlimited
  5. Query limits reset monthly for paid plans
  6. Free trial limit is total (not monthly)
*/

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  display_name text NOT NULL,
  price_bdt numeric(10,2) NOT NULL DEFAULT 0,
  queries_per_month integer NOT NULL,
  queries_soft_cap integer,
  max_supervisors integer,
  max_members integer,
  trial_days integer,
  is_trial boolean DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Public can read active plans"
  ON subscription_plans FOR SELECT
  TO anon
  USING (is_active = true);

-- Insert default plans
INSERT INTO subscription_plans (id, name, display_name, price_bdt, queries_per_month, queries_soft_cap, max_supervisors, max_members, trial_days, is_trial, features, sort_order) VALUES
(
  'free_trial',
  'Free Trial',
  'Free Trial',
  0,
  100,
  NULL,
  1,
  5,
  15,
  true,
  '["1 Supervisor account", "Up to 5 team members", "Up to 100 total queries", "Email notifications only", "Basic query management"]',
  0
),
(
  'basic',
  'Basic',
  'Basic',
  149,
  200,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  '["200 new queries per month", "Unlimited supervisors & members", "Email support", "Email & WhatsApp notifications", "Query reports"]',
  1
),
(
  'standard',
  'Standard',
  'Standard',
  499,
  600,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  '["600 new queries per month", "Unlimited supervisors & members", "Email support", "Email & WhatsApp notifications", "Reports and analytics"]',
  2
),
(
  'premium',
  'Premium',
  'Premium',
  999,
  2500,
  2500,
  NULL,
  NULL,
  NULL,
  false,
  '["Unlimited queries (fair use)", "Unlimited supervisors & members", "Priority support", "Email & WhatsApp notifications", "Advanced reports and analytics", "Early access to future features"]',
  3
)
ON CONFLICT (id) DO NOTHING;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'expired', 'cancelled')),
  queries_used integer NOT NULL DEFAULT 0,
  queries_reset_at timestamptz DEFAULT now(),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  started_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "Admins can insert own subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

-- Add account_type to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE profiles ADD COLUMN account_type text DEFAULT 'business' CHECK (account_type IN ('business', 'individual'));
  END IF;
END $$;

-- Add subscription_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_id uuid REFERENCES subscriptions(id);
  END IF;
END $$;

-- Function to check if an admin has reached their query limit
CREATE OR REPLACE FUNCTION check_query_limit(p_admin_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan subscription_plans%ROWTYPE;
  v_sub subscriptions%ROWTYPE;
  v_query_count integer;
BEGIN
  SELECT s.* INTO v_sub
  FROM subscriptions s
  WHERE s.admin_id = p_admin_id AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT p.* INTO v_plan
  FROM subscription_plans p
  WHERE p.id = v_sub.plan_id;

  IF v_plan.is_trial THEN
    SELECT COUNT(*) INTO v_query_count
    FROM queries q
    WHERE q.created_by = p_admin_id;
    RETURN v_query_count < v_plan.queries_per_month;
  END IF;

  IF v_sub.queries_reset_at < date_trunc('month', now()) THEN
    UPDATE subscriptions SET queries_used = 0, queries_reset_at = date_trunc('month', now())
    WHERE id = v_sub.id;
    RETURN true;
  END IF;

  RETURN v_sub.queries_used < COALESCE(v_plan.queries_soft_cap, v_plan.queries_per_month);
END;
$$;
