/*
  # Add Update Subscription RPC

  ## Purpose
  Allows platform admins to manually update an account's subscription plan
  and/or end date. This supports the manual prepaid billing workflow.

  ## Function: `update_account_subscription`
  - Parameters:
    - `p_account_id` (uuid) - The account to update
    - `p_plan_id` (text) - New plan ID
    - `p_ends_at` (timestamptz, nullable) - New expiry date (null = no expiry)
    - `p_notes` (text, nullable) - Notes to record in subscription history
  - Security: SECURITY DEFINER, restricted to platform admins
  - Side effects:
    - Updates `subscriptions` table (plan_id, ends_at, status, updated_at)
    - Closes the previous subscription_history entry (sets ended_at = now)
    - Creates a new subscription_history entry for the change
*/

CREATE OR REPLACE FUNCTION update_account_subscription(
  p_account_id uuid,
  p_plan_id text,
  p_ends_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_sub_id uuid;
  v_old_plan_id text;
  v_plan_display text;
  v_plan_name text;
BEGIN
  SELECT role INTO v_caller_role
  FROM user_roles
  WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'support_admin')
  LIMIT 1;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: platform admin role required';
  END IF;

  SELECT id, plan_id INTO v_sub_id, v_old_plan_id
  FROM subscriptions
  WHERE account_id = p_account_id
    AND status IN ('active', 'trial')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for this account';
  END IF;

  SELECT display_name, name INTO v_plan_display, v_plan_name
  FROM subscription_plans
  WHERE id = p_plan_id;

  IF v_plan_display IS NULL THEN
    RAISE EXCEPTION 'Invalid plan_id: %', p_plan_id;
  END IF;

  UPDATE subscription_history
  SET ended_at = now()
  WHERE account_id = p_account_id
    AND ended_at IS NULL;

  UPDATE subscriptions
  SET
    plan_id = p_plan_id,
    ends_at = p_ends_at,
    status = 'active',
    updated_at = now()
  WHERE id = v_sub_id;

  INSERT INTO subscription_history (account_id, plan_id, plan_name, plan_display, status, started_at, ended_at, notes)
  VALUES (p_account_id, p_plan_id, v_plan_name, v_plan_display, 'active', now(), NULL,
    COALESCE(p_notes, 'Plan updated by platform admin'));
END;
$$;
