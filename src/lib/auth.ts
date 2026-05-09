import { supabase, UserProfile, UserRoleRecord } from './supabase';
import { logUnauthorizedAccess, isUnauthorizedError, buildDescription } from './securityAudit';

export interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  mobileNumber: string;
  accountType: 'business' | 'individual';
  accountDisplayName: string;
  expectedSupervisorCount: number;
  expectedMemberCount: number;
  emailRedirectTo?: string;
}

export async function signUp(payload: SignUpPayload) {
  const { email, password, fullName, mobileNumber, accountType, accountDisplayName, expectedSupervisorCount, expectedMemberCount, emailRedirectTo } = payload;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        full_name: fullName,
        mobile_number: mobileNumber,
        account_type: accountType,
        account_display_name: accountDisplayName,
        expected_supervisor_count: expectedSupervisorCount,
        expected_member_count: expectedMemberCount,
      },
    },
  });

  if (error) throw error;
  return data;
}

export class EmailNotVerifiedError extends Error {
  constructor(message = 'Your account is not activated yet. Please verify your email using the link we sent you.') {
    super(message);
    this.name = 'EmailNotVerifiedError';
  }
}

export async function signIn(email: string, password: string) {
  console.log('[auth:signIn] Attempting sign in for:', email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('[auth:signIn] Sign in error:', {
      message: error.message,
      status: error.status,
      code: (error as { code?: string }).code,
      details: error,
    });
    const errObj = { message: error.message, status: error.status, code: (error as { code?: string }).code };
    if (isUnauthorizedError(errObj)) {
      logUnauthorizedAccess({
        user_id: null,
        service_context: 'auth:signIn',
        description: buildDescription('auth:signIn', errObj, { email }),
        error_code: errObj.code ?? String(errObj.status ?? ''),
        error_message: error.message,
        metadata: { email },
      });
    }
    throw error;
  }

  // Gate: platform requires email verification AND profile not yet verified.
  // Sign the user back out and throw a specific error the UI can display.
  if (data.user) {
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('require_email_verification')
      .is('account_id', null)
      .maybeSingle();

    if (settings?.require_email_verification) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email_verified_at')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile?.email_verified_at) {
        await supabase.auth.signOut({ scope: 'local' });
        throw new EmailNotVerifiedError();
      }
    }
  }

  console.log('[auth:signIn] Sign in success, user:', data.user?.id);
  return data;
}

export async function signOut() {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (err) {
    console.warn('[auth:signOut] signOut error (continuing with local cleanup):', err);
  }
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch (err) {
    console.warn('[auth:signOut] storage cleanup error:', err);
  }
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  console.log('[auth:getUserProfile] Fetching profile for:', userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[auth:getUserProfile] Error fetching profile:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    if (isUnauthorizedError({ message: error.message, code: error.code })) {
      logUnauthorizedAccess({
        user_id: userId,
        service_context: 'auth:getUserProfile',
        description: buildDescription('profile', error, { resource_id: userId }),
        error_code: error.code,
        error_message: error.message,
        metadata: { target_user_id: userId },
      });
    }
    throw error;
  }
  console.log('[auth:getUserProfile] Profile fetched:', data?.id, 'role:', data?.role);
  return data;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updateUserPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function getUserRoles(userId: string): Promise<UserRoleRecord[]> {
  console.log('[auth:getUserRoles] Fetching roles for:', userId);
  const { data, error } = await supabase
    .from('user_roles')
    .select('*, account:accounts(id, name, owner_id, is_active, created_at, updated_at)')
    .eq('user_id', userId);

  if (error) {
    console.error('[auth:getUserRoles] Error fetching roles:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    if (isUnauthorizedError({ message: error.message, code: error.code })) {
      logUnauthorizedAccess({
        user_id: userId,
        service_context: 'auth:getUserRoles',
        description: buildDescription('roles', error, { resource_id: userId }),
        error_code: error.code,
        error_message: error.message,
        metadata: { target_user_id: userId },
      });
    }
    throw error;
  }
  console.log('[auth:getUserRoles] Roles fetched:', data?.map(r => r.role));
  return (data ?? []) as UserRoleRecord[];
}
