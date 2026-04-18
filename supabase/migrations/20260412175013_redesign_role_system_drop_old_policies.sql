/*
  # Drop old policies that depend on admin_id columns
  
  This runs before the main role redesign migration to avoid
  dependency errors when dropping/renaming admin_id columns.
*/

-- Drop subscription policies that reference admin_id
DROP POLICY IF EXISTS "Admins can view own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Admins can insert own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Admins can update own subscription" ON subscriptions;

-- Drop admin_settings policies
DROP POLICY IF EXISTS "Admin can read own settings" ON admin_settings;
DROP POLICY IF EXISTS "Admin can insert settings" ON admin_settings;
DROP POLICY IF EXISTS "Admin can update settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins can view own settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins can insert own settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins can update own settings" ON admin_settings;

-- Drop profile policies that reference role column
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Allow team members to view each other profiles" ON profiles;

-- Drop query policies
DROP POLICY IF EXISTS "Admin can manage queries" ON queries;
DROP POLICY IF EXISTS "Team members can view assigned queries" ON queries;
DROP POLICY IF EXISTS "Team members can update assigned query status" ON queries;

-- Drop query_assignments policies
DROP POLICY IF EXISTS "Admin can manage assignments" ON query_assignments;
DROP POLICY IF EXISTS "Team members can view own assignments" ON query_assignments;

-- Drop query_responses policies
DROP POLICY IF EXISTS "Admin can manage responses" ON query_responses;
DROP POLICY IF EXISTS "Users can view responses for assigned queries" ON query_responses;
DROP POLICY IF EXISTS "Team members can insert responses for assigned queries" ON query_responses;

-- Drop query_comments policies
DROP POLICY IF EXISTS "Admin can manage comments" ON query_comments;
DROP POLICY IF EXISTS "Users can view comments for assigned queries" ON query_comments;
DROP POLICY IF EXISTS "Team members can insert comments for assigned queries" ON query_comments;
DROP POLICY IF EXISTS "Team members can insert query comments" ON query_comments;

-- Drop is_admin function (CASCADE will also drop dependent policies)
DROP FUNCTION IF EXISTS is_admin() CASCADE;
