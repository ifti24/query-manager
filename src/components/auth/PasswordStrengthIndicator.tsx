import React from 'react';
import { Check, X } from 'lucide-react';
import { PasswordPolicy, getPasswordStrength } from '../../lib/passwordPolicy';

interface PasswordStrengthIndicatorProps {
  password: string;
  policy: PasswordPolicy;
  userRole?: 'admin' | 'team_member';
}

interface Criterion {
  label: string;
  met: boolean;
}

function buildCriteria(password: string, policy: PasswordPolicy): Criterion[] {
  const criteria: Criterion[] = [];

  criteria.push({
    label: `At least ${policy.password_min_length} characters`,
    met: password.length >= policy.password_min_length,
  });

  if (policy.password_max_length > 0) {
    criteria.push({
      label: `No more than ${policy.password_max_length} characters`,
      met: password.length <= policy.password_max_length,
    });
  }

  if (policy.password_require_uppercase) {
    const count = (password.match(/[A-Z]/g) || []).length;
    criteria.push({
      label: `At least ${policy.password_min_uppercase} uppercase letter${policy.password_min_uppercase !== 1 ? 's' : ''}`,
      met: count >= policy.password_min_uppercase,
    });
  }

  if (policy.password_require_lowercase) {
    const count = (password.match(/[a-z]/g) || []).length;
    criteria.push({
      label: `At least ${policy.password_min_lowercase} lowercase letter${policy.password_min_lowercase !== 1 ? 's' : ''}`,
      met: count >= policy.password_min_lowercase,
    });
  }

  if (policy.password_require_numbers) {
    const count = (password.match(/[0-9]/g) || []).length;
    criteria.push({
      label: `At least ${policy.password_min_numbers} number${policy.password_min_numbers !== 1 ? 's' : ''}`,
      met: count >= policy.password_min_numbers,
    });
  }

  if (policy.password_require_special) {
    const specialChars = policy.password_allowed_special_chars || '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const escaped = specialChars.replace(/[-[\]^\\]/g, '\\$&').replace(/[.*+?${}()|]/g, '\\$&');
    const count = (password.match(new RegExp(`[${escaped}]`, 'g')) || []).length;
    criteria.push({
      label: `At least ${policy.password_min_special} special character${policy.password_min_special !== 1 ? 's' : ''} (${specialChars})`,
      met: count >= policy.password_min_special,
    });
  }

  return criteria;
}

export function PasswordStrengthIndicator({ password, policy, userRole }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  // If this role is excluded from the policy, show nothing
  if (userRole && !policy.password_policy_applies_to.includes(userRole)) return null;

  const strength = getPasswordStrength(password, policy);
  const criteria = buildCriteria(password, policy);

  const getStrengthColor = () => {
    if (strength < 40) return 'bg-red-500';
    if (strength < 60) return 'bg-orange-500';
    if (strength < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = () => {
    if (strength < 40) return 'Weak';
    if (strength < 60) return 'Fair';
    if (strength < 80) return 'Good';
    return 'Strong';
  };

  const allMet = criteria.every(c => c.met);

  return (
    <div className="mt-3 space-y-2.5">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${strength}%` }}
          />
        </div>
        <span className={`text-xs font-semibold min-w-[36px] text-right ${
          strength < 40 ? 'text-red-600' :
          strength < 60 ? 'text-orange-600' :
          strength < 80 ? 'text-yellow-600' :
          'text-green-600'
        }`}>
          {getStrengthLabel()}
        </span>
      </div>

      {/* Requirements list */}
      <div className="space-y-1">
        {criteria.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {c.met ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            )}
            <span className={c.met ? 'text-emerald-700' : 'text-slate-500'}>{c.label}</span>
          </div>
        ))}
      </div>

      {allMet && (
        <p className="text-xs text-emerald-600 font-medium">All requirements met</p>
      )}
    </div>
  );
}
