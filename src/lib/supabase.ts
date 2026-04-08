import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'admin' | 'team_member';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  last_login_at: string | null;
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

export interface AdminSettings {
  id: string;
  admin_id: string;
  email_schedule_time: string;
  email_schedule_enabled: boolean;
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
  created_at: string;
  updated_at: string;
}
