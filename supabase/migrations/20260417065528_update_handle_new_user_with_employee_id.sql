/*
  # Update handle_new_user Trigger to Auto-generate Employee ID

  ## Summary
  Updates the handle_new_user trigger function to automatically generate
  a system employee ID (prefixed with 'sys:') for new users. The prefix
  distinguishes it as a placeholder that must be replaced by the account owner.

  ## Logic
  - Generate a random 8-character alphanumeric code prefixed with 'sys:'
  - The frontend detects the 'sys:' prefix and forces the owner to set a real ID
  - Real employee IDs must not start with 'sys:'
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_sys_emp_id text;
BEGIN
  v_sys_emp_id := 'sys:' || upper(substring(md5(random()::text || NEW.id::text) from 1 for 8));

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    mobile_number,
    account_display_name,
    employee_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'member',
    NEW.raw_user_meta_data->>'mobile_number',
    NEW.raw_user_meta_data->>'account_display_name',
    v_sys_emp_id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
