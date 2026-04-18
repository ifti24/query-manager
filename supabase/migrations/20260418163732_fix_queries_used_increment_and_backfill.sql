/*
  # Fix queries_used counter — increment on query creation & backfill existing data

  ## Problem
  The `create_query_with_assignments` RPC was inserting queries without incrementing
  `subscriptions.queries_used`, leaving it permanently at 0 for all accounts.

  ## Changes

  ### 1. Update `create_query_with_assignments`
  - After inserting the query, increments `queries_used` on the account's active/trial
    subscription by 1. Also resets the counter if the billing month has rolled over.

  ### 2. Backfill existing data
  - Sets `queries_used` to the real count of queries created by users in each account
    during the current billing month (since `queries_reset_at`).

  ## Notes
  - Premium plan has no hard cap but we still track usage for analytics.
  - Counter reset logic mirrors what `check_query_limit` already does.
*/

CREATE OR REPLACE FUNCTION public.create_query_with_assignments(
  p_user_id uuid,
  p_title text,
  p_description text,
  p_priority text,
  p_show_priority boolean,
  p_members uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query_id uuid;
  v_allowed boolean;
  v_account_id uuid;
  v_sub_id uuid;
  v_reset_at timestamptz;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id
      AND role IN ('supervisor', 'account_owner')
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Forbidden: only supervisors and account owners can create queries'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO queries (created_by, title, description, priority, show_priority, status)
  VALUES (
    p_user_id,
    p_title,
    NULLIF(p_description, ''),
    COALESCE(p_priority, 'normal'),
    COALESCE(p_show_priority, true),
    'pending'
  )
  RETURNING id INTO v_query_id;

  IF p_members IS NOT NULL AND array_length(p_members, 1) > 0 THEN
    INSERT INTO query_assignments (query_id, assigned_to)
    SELECT v_query_id, unnest(p_members);
  END IF;

  SELECT p.account_id INTO v_account_id
  FROM profiles p WHERE p.id = p_user_id;

  IF v_account_id IS NOT NULL THEN
    SELECT id, queries_reset_at INTO v_sub_id, v_reset_at
    FROM subscriptions
    WHERE account_id = v_account_id
      AND status IN ('active', 'trial')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_sub_id IS NOT NULL THEN
      IF v_reset_at < date_trunc('month', now()) THEN
        UPDATE subscriptions
        SET queries_used = 1,
            queries_reset_at = date_trunc('month', now())
        WHERE id = v_sub_id;
      ELSE
        UPDATE subscriptions
        SET queries_used = queries_used + 1
        WHERE id = v_sub_id;
      END IF;
    END IF;
  END IF;

  RETURN v_query_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_query_with_assignments(uuid, text, text, text, boolean, uuid[])
  TO authenticated, service_role;

UPDATE subscriptions s
SET queries_used = (
  SELECT COUNT(*)
  FROM queries q
  JOIN profiles p ON p.id = q.created_by
  WHERE p.account_id = s.account_id
    AND q.created_at >= GREATEST(s.queries_reset_at, date_trunc('month', now()))
)
WHERE s.status IN ('active', 'trial');
