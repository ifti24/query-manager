/*
  # Fix handle_new_user trigger to use correct role value

  The trigger was inserting role = 'member' which is correct, but ensure
  it aligns with the new single constraint and does not rely on the old default.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
