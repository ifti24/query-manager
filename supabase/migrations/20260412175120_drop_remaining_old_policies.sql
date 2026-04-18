/*
  # Drop remaining old policies blocking column renames
*/
DROP POLICY IF EXISTS "Admin can manage own settings" ON admin_settings;
DROP POLICY IF EXISTS "Anyone can view password policy settings" ON admin_settings;
DROP POLICY IF EXISTS "Team members can view public settings" ON admin_settings;
