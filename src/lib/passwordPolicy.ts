import { supabase } from './supabase';

export interface PasswordPolicy {
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
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  requirements: string[];
}

export async function getPasswordPolicy(): Promise<PasswordPolicy | null> {
  try {
    const { data } = await supabase
      .rpc('get_public_password_policy')
      .maybeSingle();

    if (!data) {
      return {
        password_min_length: 8,
        password_max_length: 128,
        password_require_uppercase: true,
        password_min_uppercase: 1,
        password_require_lowercase: true,
        password_min_lowercase: 1,
        password_require_numbers: true,
        password_min_numbers: 1,
        password_require_special: true,
        password_min_special: 1,
        password_allowed_special_chars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        password_policy_applies_to: ['admin', 'team_member'],
      };
    }

    return {
      password_min_length: data.password_min_length ?? 8,
      password_max_length: data.password_max_length ?? 128,
      password_require_uppercase: data.password_require_uppercase ?? true,
      password_min_uppercase: data.password_min_uppercase ?? 1,
      password_require_lowercase: data.password_require_lowercase ?? true,
      password_min_lowercase: data.password_min_lowercase ?? 1,
      password_require_numbers: data.password_require_numbers ?? true,
      password_min_numbers: data.password_min_numbers ?? 1,
      password_require_special: data.password_require_special ?? true,
      password_min_special: data.password_min_special ?? 0,
      password_allowed_special_chars: data.password_allowed_special_chars || '!@#$%^&*()_+-=[]{}|;:,.<>?',
      password_policy_applies_to: Array.isArray(data.password_policy_applies_to)
        ? data.password_policy_applies_to
        : ['admin', 'team_member'],
    };
  } catch (error) {
    console.error('Error fetching password policy:', error);
    return {
      password_min_length: 8,
      password_max_length: 128,
      password_require_uppercase: true,
      password_min_uppercase: 1,
      password_require_lowercase: true,
      password_min_lowercase: 1,
      password_require_numbers: true,
      password_min_numbers: 1,
      password_require_special: true,
      password_min_special: 1,
      password_allowed_special_chars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      password_policy_applies_to: ['admin', 'team_member'],
    };
  }
}

export function validatePassword(password: string, policy: PasswordPolicy, userRole?: 'admin' | 'team_member'): PasswordValidationResult {
  const errors: string[] = [];
  const requirements: string[] = [];

  if (userRole && !policy.password_policy_applies_to.includes(userRole)) {
    return { valid: true, errors: [], requirements: [] };
  }

  if (password.length < policy.password_min_length) {
    errors.push(`Password must be at least ${policy.password_min_length} characters long`);
  }
  requirements.push(`At least ${policy.password_min_length} characters`);

  if (password.length > policy.password_max_length) {
    errors.push(`Password must not exceed ${policy.password_max_length} characters`);
  }
  requirements.push(`Maximum ${policy.password_max_length} characters`);

  if (policy.password_require_uppercase) {
    const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
    if (uppercaseCount < policy.password_min_uppercase) {
      errors.push(`Password must contain at least ${policy.password_min_uppercase} uppercase letter${policy.password_min_uppercase > 1 ? 's' : ''}`);
    }
    requirements.push(`At least ${policy.password_min_uppercase} uppercase letter${policy.password_min_uppercase > 1 ? 's' : ''}`);
  }

  if (policy.password_require_lowercase) {
    const lowercaseCount = (password.match(/[a-z]/g) || []).length;
    if (lowercaseCount < policy.password_min_lowercase) {
      errors.push(`Password must contain at least ${policy.password_min_lowercase} lowercase letter${policy.password_min_lowercase > 1 ? 's' : ''}`);
    }
    requirements.push(`At least ${policy.password_min_lowercase} lowercase letter${policy.password_min_lowercase > 1 ? 's' : ''}`);
  }

  if (policy.password_require_numbers) {
    const numberCount = (password.match(/[0-9]/g) || []).length;
    if (numberCount < policy.password_min_numbers) {
      errors.push(`Password must contain at least ${policy.password_min_numbers} number${policy.password_min_numbers > 1 ? 's' : ''}`);
    }
    requirements.push(`At least ${policy.password_min_numbers} number${policy.password_min_numbers > 1 ? 's' : ''}`);
  }

  if (policy.password_require_special) {
    const specialChars = policy.password_allowed_special_chars;
    const escapedSpecialChars = specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const specialRegex = new RegExp(`[${escapedSpecialChars}]`, 'g');
    const specialCount = (password.match(specialRegex) || []).length;

    if (specialCount < policy.password_min_special) {
      errors.push(`Password must contain at least ${policy.password_min_special} special character${policy.password_min_special > 1 ? 's' : ''} (${specialChars})`);
    }
    requirements.push(`At least ${policy.password_min_special} special character${policy.password_min_special > 1 ? 's' : ''} (${specialChars})`);
  }

  return {
    valid: errors.length === 0,
    errors,
    requirements,
  };
}

export function getPasswordStrength(password: string, policy: PasswordPolicy): number {
  if (!password) return 0;

  let strength = 0;
  const maxStrength = 100;

  const lengthScore = Math.min((password.length / policy.password_min_length) * 25, 25);
  strength += lengthScore;

  if (policy.password_require_uppercase) {
    const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
    if (uppercaseCount >= policy.password_min_uppercase) {
      strength += 18.75;
    }
  }

  if (policy.password_require_lowercase) {
    const lowercaseCount = (password.match(/[a-z]/g) || []).length;
    if (lowercaseCount >= policy.password_min_lowercase) {
      strength += 18.75;
    }
  }

  if (policy.password_require_numbers) {
    const numberCount = (password.match(/[0-9]/g) || []).length;
    if (numberCount >= policy.password_min_numbers) {
      strength += 18.75;
    }
  }

  if (policy.password_require_special) {
    const specialChars = policy.password_allowed_special_chars;
    const escapedSpecialChars = specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const specialRegex = new RegExp(`[${escapedSpecialChars}]`, 'g');
    const specialCount = (password.match(specialRegex) || []).length;

    if (specialCount >= policy.password_min_special) {
      strength += 18.75;
    }
  }

  return Math.min(strength, maxStrength);
}
