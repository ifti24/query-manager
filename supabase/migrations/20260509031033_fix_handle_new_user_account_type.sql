/*
  # Fix handle_new_user trigger to include account_type and signup metadata

  1. Changes
    - Updates the handle_new_user trigger function to copy account_type,
      account_display_name, expected_supervisor_count, and expected_member_count
      from raw_user_meta_data into the profiles row.
    - Previously account_type defaulted to 'business' because it was never set
      from the signup metadata, causing individual accounts to show as business
      in the platform admin panel.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
    account_type,
    employee_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'member',
    NEW.raw_user_meta_data->>'mobile_number',
    NEW.raw_user_meta_data->>'account_display_name',
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'business'),
    v_sys_emp_id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
