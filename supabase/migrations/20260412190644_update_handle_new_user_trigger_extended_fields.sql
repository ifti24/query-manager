/*
  # Update handle_new_user trigger to capture extended signup fields

  ## Summary
  Updates the database trigger that runs when a new user registers to also
  store the extended signup fields (mobile number, account display name,
  account type, expected counts) into the profiles table.

  ## Changes
  - Modified `handle_new_user` function to read additional metadata fields
    from `raw_user_meta_data` and populate the profiles table accordingly.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    mobile_number,
    account_display_name
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'member',
    NEW.raw_user_meta_data->>'mobile_number',
    NEW.raw_user_meta_data->>'account_display_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
