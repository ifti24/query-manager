export type ViolationType =
  | 'expired_token'
  | 'permission_denied'
  | 'invalid_credentials'
  | 'rls_violation'
  | 'unknown';

export interface SecurityAuditPayload {
  user_id?: string | null;
  service_context: string;
  description: string;
  violation_type?: ViolationType;
  error_code?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function logUnauthorizedAccess(payload: SecurityAuditPayload): void {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return;

  const url = `${supabaseUrl}/functions/v1/log-security-event`;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'Apikey': anonKey,
    },
    body: JSON.stringify({
      ...payload,
      violation_type: payload.violation_type ?? detectViolationType(payload),
    }),
  }).catch(() => {});
}

export function detectViolationType(error: {
  code?: string | null;
  status?: number | null;
  message?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}): ViolationType {
  const msg = (error.message ?? error.error_message ?? '').toLowerCase();
  const code = error.code ?? error.error_code ?? '';
  const status = error.status;

  if (
    msg.includes('jwt expired') ||
    msg.includes('token is expired') ||
    msg.includes('token expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('jwt malformed') ||
    msg.includes('invalid api key') ||
    code === 'PGRST301' ||
    status === 401
  ) {
    return 'expired_token';
  }

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid password') ||
    msg.includes('wrong password') ||
    msg.includes('email not confirmed') ||
    msg.includes('no user found') ||
    msg.includes('invalid email or password')
  ) {
    return 'invalid_credentials';
  }

  if (
    msg.includes('row-level security') ||
    msg.includes('new row violates row-level') ||
    code === '42501' ||
    code === 'PGRST116'
  ) {
    return 'rls_violation';
  }

  if (
    msg.includes('permission denied') ||
    msg.includes('not authorized') ||
    msg.includes('unauthorized') ||
    msg.includes('access denied') ||
    msg.includes('forbidden') ||
    status === 403
  ) {
    return 'permission_denied';
  }

  return 'unknown';
}

export function isUnauthorizedError(error: {
  code?: string | null;
  status?: number | null;
  message?: string | null;
}): boolean {
  if (error.status === 401 || error.status === 403) return true;
  if (error.code === 'PGRST301') return true;
  if (error.code === '42501') return true;
  const msg = error.message?.toLowerCase() ?? '';
  if (msg.includes('row-level security')) return true;
  if (msg.includes('permission denied')) return true;
  if (msg.includes('not authorized')) return true;
  if (msg.includes('unauthorized')) return true;
  if (msg.includes('jwt')) return true;
  if (msg.includes('invalid api key')) return true;
  if (msg.includes('invalid login credentials')) return true;
  if (msg.includes('invalid password')) return true;
  return false;
}

const CONTEXT_DESCRIPTIONS: Record<string, string> = {
  'auth:signIn':
    'A sign-in attempt failed. The provided credentials were rejected or the account does not exist.',
  'auth:getUserProfile':
    'Access to a user profile was blocked. The requesting user lacks permission to read this record.',
  'auth:getUserRoles':
    'Access to role data was blocked. The requesting user is not authorized to read role assignments.',
  'queries:fetchQueries':
    'An attempt to list or access queries was denied by row-level security.',
  'queries:fetchQueryDetail':
    'An attempt to read a specific query record was denied.',
  'query_comments:insert':
    'An attempt to post a comment on a query was denied.',
  'query_comments:fetch':
    'An attempt to read query comments was denied.',
  'query_responses:insert':
    'An attempt to submit a response to a query was denied.',
  'query_responses:fetch':
    'An attempt to read query responses was denied.',
  'query_assignments:fetch':
    'An attempt to read query assignment records was denied.',
  'query_assignments:insert':
    'An attempt to create a query assignment was denied.',
  'team:fetchMembers':
    'An attempt to list team members was blocked by access controls.',
  'team:fetchMembers:user_roles':
    'An attempt to read role assignments for team members was denied.',
  'admin_settings:fetch':
    'An attempt to read admin settings was denied.',
  'admin_settings:update':
    'An attempt to modify admin settings was denied.',
  'attachments:fetch':
    'An attempt to access an attachment was blocked.',
  'attachments:upload':
    'An attempt to upload a file was denied.',
  'invitation_tokens:read':
    'An attempt to read an invitation token was denied.',
  'invitation_tokens:use':
    'An attempt to use an invitation token failed authorization checks.',
  'accounts:fetch':
    'An attempt to access account data was denied.',
  'subscription:fetch':
    'An attempt to access subscription data was denied.',
};

export function buildDescription(
  context: string,
  error: { message?: string | null; code?: string | null; status?: number | null },
  meta?: Record<string, unknown>
): string {
  const violationType = detectViolationType(error);
  const parts: string[] = [];

  const baseDescription = CONTEXT_DESCRIPTIONS[context];

  if (baseDescription) {
    parts.push(baseDescription);
  } else {
    if (context.includes('signIn') || context.includes('auth')) {
      parts.push('An authentication attempt was blocked.');
    } else if (context.includes('profile')) {
      parts.push('An attempt to read or modify a user profile was denied.');
    } else if (context.includes('roles') || context.includes('user_roles')) {
      parts.push('An attempt to access role data was denied by access controls.');
    } else if (context.includes('query_comments')) {
      parts.push('An attempt to post or read a query comment was denied.');
    } else if (context.includes('queries')) {
      parts.push('An attempt to access or modify query data was blocked by access controls.');
    } else if (context.includes('query_assignments')) {
      parts.push('An attempt to access query assignment data was denied.');
    } else if (context.includes('query_responses')) {
      parts.push('An attempt to access query response data was denied.');
    } else if (context.includes('admin_settings')) {
      parts.push('An attempt to read or modify admin settings was denied.');
    } else if (context.includes('attachments')) {
      parts.push('An attempt to access an attachment was blocked.');
    } else if (context.includes('subscriptions') || context.includes('subscription_plans')) {
      parts.push('An attempt to access subscription data was denied.');
    } else if (context.includes('invitation_tokens')) {
      parts.push('An attempt to use or access an invitation token was denied.');
    } else if (context.includes('accounts')) {
      parts.push('An attempt to access account data was denied.');
    } else if (context.includes('team')) {
      parts.push('An attempt to access team member data was blocked by access controls.');
    } else {
      parts.push(`An unauthorized access attempt was detected in "${context}".`);
    }
  }

  if (violationType === 'expired_token') {
    parts.push('The session token was expired or invalid — the user was authenticated but their token is no longer accepted.');
  } else if (violationType === 'permission_denied') {
    parts.push('The authenticated user does not have the required role or permission for this action.');
  } else if (violationType === 'rls_violation') {
    parts.push('The database row-level security policy blocked this operation — the user attempted to access data outside their permitted scope.');
  } else if (violationType === 'invalid_credentials') {
    parts.push('The provided credentials (email/password) were incorrect or the account does not exist.');
  }

  if (error.message) {
    parts.push(`Raw error: "${error.message}".`);
  }

  if (meta?.resource_id) {
    parts.push(`Targeted resource ID: ${meta.resource_id}.`);
  }

  return parts.join(' ');
}
