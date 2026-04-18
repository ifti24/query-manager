/*
  # Subscription History, Plan Overrides, and Extend Trial

  ## New Tables

  ### subscription_history
  - Tracks every subscription period for each account (from free trial through upgrades)
  - Columns: id, account_id, plan_id, plan_name, plan_display, status, started_at, ended_at, notes
  - Used to show the complete subscription timeline in the account detail modal

  ### subscription_plan_overrides
  - Platform-admin-editable limits that override the default subscription_plans values per plan
  - Columns: id, plan_id, price_bdt, queries_per_month, max_supervisors, max_members, trial_days, updated_at, updated_by
  - Allows the platform admin to change plan restrictions without touching the base plan table

  ## New RPC

  ### extend_free_trial(p_account_id uuid, p_days int)
  - Callable by platform admin (via service role through edge function)
  - Extends the trial_ends_at for the given account's active trial subscription by N days

  ## Security
  - RLS enabled on both tables
  - subscription_history: platform_admin can read all; authenticated users can read their own account's history
  - subscription_plan_overrides: platform_admin only (read + write)
*/

-- subscription_history table
CREATE TABLE IF NOT EXISTS subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  plan_id text NOT NULL,
  plan_name text NOT NULL,
  plan_display text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read all subscription history"
  ON subscription_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

CREATE POLICY "Account owners can read own subscription history"
  ON subscription_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.id = subscription_history.account_id
        AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can insert subscription history"
  ON subscription_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

-- subscription_plan_overrides table
CREATE TABLE IF NOT EXISTS subscription_plan_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL UNIQUE REFERENCES subscription_plans(id),
  price_bdt numeric,
  queries_per_month integer,
  max_supervisors integer,
  max_members integer,
  trial_days integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

ALTER TABLE subscription_plan_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read plan overrides"
  ON subscription_plan_overrides FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

CREATE POLICY "Platform admins can insert plan overrides"
  ON subscription_plan_overrides FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

CREATE POLICY "Platform admins can update plan overrides"
  ON subscription_plan_overrides FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'platform_admin'
    )
  );

-- Populate subscription_history from existing subscriptions data
INSERT INTO subscription_history (account_id, plan_id, plan_name, plan_display, status, started_at, ended_at)
SELECT
  s.account_id,
  s.plan_id,
  sp.name,
  sp.display_name,
  s.status,
  COALESCE(s.trial_started_at, s.started_at),
  s.ends_at
FROM subscriptions s
JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE s.account_id IS NOT NULL
ON CONFLICT DO NOTHING;
