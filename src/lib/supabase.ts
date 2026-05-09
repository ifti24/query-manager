import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'super_admin' | 'support_admin' | 'account_owner' | 'supervisor' | 'member';

export interface UserRoleRecord {
  id: string;
  user_id: string;
  account_id: string | null;
  role: UserRole;
  created_at: string;
  created_by: string | null;
  account?: Account | null;
}

export interface Account {
  id: string;
  owner_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  account_id: string | null;
  account_type: 'business' | 'individual' | null;
  is_active: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  last_login_at: string | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Query {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  priority: string;
  show_priority: boolean;
  status: 'pending' | 'answered' | 'completed' | 'archived';
  consecutive_admin_comments: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface QueryAssignment {
  id: string;
  query_id: string;
  assigned_to: string;
  response_status: 'pending' | 'answered';
  created_at: string;
  updated_at: string;
}

export interface QueryResponse {
  id: string;
  query_id: string;
  assignment_id: string;
  responded_by: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface QueryComment {
  id: string;
  query_id: string;
  response_id: string | null;
  created_by: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  query_id: string | null;
  response_id: string | null;
  comment_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  is_image: boolean;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_bdt: number;
  queries_per_month: number;
  max_supervisors: number | null;
  max_members: number | null;
  trial_days: number | null;
  is_trial: boolean;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  account_id: string;
  plan_id: string;
  status: 'active' | 'trial' | 'expired' | 'cancelled';
  queries_used: number;
  queries_reset_at: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  started_at: string;
  ends_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
}

export interface Payment {
  id: string;
  account_id: string;
  subscription_id: string | null;
  amount_bdt: number;
  payment_method: string;
  reference_number: string | null;
  payment_date: string;
  plan_id: string;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface AdminSettings {
  id: string;
  account_id: string;
  email_schedule_time: string;
  email_schedule_enabled: boolean;
  email_timezone: string;
  email_schedule_days: number[];
  digest_blacklist_dates: string[];
  email_send_on_create: boolean;
  max_file_size_mb: number;
  allowed_file_types: string[];
  blacklisted_file_types: string[];
  auto_archive_days: number | null;
  session_idle_timeout_minutes: number;
  session_warning_seconds: number;
  password_reset_link_validity_hours: number;
  password_min_length: number;
  password_max_length: number;
  password_require_uppercase: boolean;
  password_min_uppercase: number;
  password_require_lowercase: boolean;
  password_min_lowercase: number;
  password_require_numbers: boolean;
  password_min_numbers: number;
  password_require_special: boolean;
  password_min_special: number;
  password_allowed_special_chars: string;
  password_policy_applies_to: string[];
  require_email_verification: boolean;
  created_at: string;
  updated_at: string;
}

export type ActiveRoleType =
  | { type: 'platform'; role: 'super_admin' | 'support_admin' }
  | { type: 'account'; role: 'account_owner' | 'supervisor' | 'member'; accountId: string; accountName: string };

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  super_admin: 'Platform Owner',
  support_admin: 'Support Staff',
  account_owner: 'Account Owner',
  supervisor: 'Supervisor',
  member: 'Member',
};

export function buildActiveRole(roleRecord: UserRoleRecord): ActiveRoleType | null {
  if (roleRecord.role === 'super_admin' || roleRecord.role === 'support_admin') {
    return { type: 'platform', role: roleRecord.role };
  }
  if (
    roleRecord.account_id &&
    (roleRecord.role === 'account_owner' || roleRecord.role === 'supervisor' || roleRecord.role === 'member')
  ) {
    return {
      type: 'account',
      role: roleRecord.role,
      accountId: roleRecord.account_id,
      accountName: roleRecord.account?.name ?? 'My Account',
    };
  }
  return null;
}
