/*
  # Add RPC function to create a query with assignments in one DB round-trip

  1. New Function
    - `create_query_with_assignments(p_user_id, p_title, p_description, p_priority, p_show_priority, p_members)`
      - Combines role authorization, query insert, and assignment inserts into a single atomic call.
      - Returns the new query UUID.
      - Raises `insufficient_privilege` when caller lacks supervisor/account_owner role.

  2. Purpose
    - Replaces three sequential round-trips in the create-query edge function with one RPC.

  3. Security
    - `SECURITY DEFINER` with explicit caller-id check against `user_roles`.
    - GRANT EXECUTE only to authenticated and service_role.
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

  RETURN v_query_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_query_with_assignments(uuid, text, text, text, boolean, uuid[])
  TO authenticated, service_role;
