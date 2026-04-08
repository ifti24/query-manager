/*
  # Fix signup flow using database trigger

  1. Changes
    - Add trigger to automatically create profile when new user signs up in auth.users
    - This ensures profile creation happens at the database level with proper permissions
    - Removes need for edge function workaround
  2. Security
    - Uses database-level trigger with proper user context
    - Profiles are created only when auth.users records are inserted
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'team_member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
