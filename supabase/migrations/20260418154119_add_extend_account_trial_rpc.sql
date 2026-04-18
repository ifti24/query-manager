/*
  # Add extend_account_trial RPC

  ## New Function
  ### extend_account_trial(p_account_id uuid, p_days int)
  - Callable by authenticated platform admins
  - Extends trial_ends_at on the active trial subscription for the given account
  - Returns the new trial_ends_at value
  - Security: SECURITY DEFINER so it can bypass RLS on subscriptions table
  - Only platform_admin role is allowed to call this
*/

CREATE OR REPLACE FUNCTION extend_account_trial(p_account_id uuid, p_days int)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_ends_at timestamptz;
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role
  FROM user_roles
  WHERE user_id = auth.uid()
    AND role = 'platform_admin'
  LIMIT 1;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: platform_admin role required';
  END IF;

  IF p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'Extension days must be between 1 and 365';
  END IF;

  UPDATE subscriptions
  SET
    trial_ends_at = COALESCE(trial_ends_at, now()) + (p_days || ' days')::interval,
    updated_at = now()
  WHERE account_id = p_account_id
    AND status = 'trial'
  RETURNING trial_ends_at INTO v_new_ends_at;

  IF v_new_ends_at IS NULL THEN
    RAISE EXCEPTION 'No active trial subscription found for this account';
  END IF;

  RETURN v_new_ends_at;
END;
$$;
