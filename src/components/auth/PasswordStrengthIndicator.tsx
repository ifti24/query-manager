import React from 'react';
import { Check, X } from 'lucide-react';
import { PasswordPolicy, validatePassword as validateWithPolicy, getPasswordStrength } from '../../lib/passwordPolicy';

interface PasswordStrengthIndicatorProps {
  password: string;
  policy: PasswordPolicy;
  userRole?: 'admin' | 'team_member';
}

export function PasswordStrengthIndicator({ password, policy, userRole }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const validation = validateWithPolicy(password, policy, userRole);
  const strength = getPasswordStrength(password, policy);

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

  const checkRequirement = (requirement: string): boolean => {
    if (requirement.startsWith('At least') && requirement.includes('characters') && !requirement.includes('letter') && !requirement.includes('number') && !requirement.includes('special')) {
      const minLength = policy.password_min_length;
      return password.length >= minLength;
    }
    if (requirement.startsWith('Maximum')) {
      const maxLength = policy.password_max_length;
      return password.length <= maxLength;
    }
    if (requirement.includes('uppercase letter')) {
      const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
      return uppercaseCount >= policy.password_min_uppercase;
    }
    if (requirement.includes('lowercase letter')) {
      const lowercaseCount = (password.match(/[a-z]/g) || []).length;
      return lowercaseCount >= policy.password_min_lowercase;
    }
    if (requirement.includes('number')) {
      const numberCount = (password.match(/[0-9]/g) || []).length;
      return numberCount >= policy.password_min_numbers;
    }
    if (requirement.includes('special character')) {
      const specialChars = policy.password_allowed_special_chars;
      const escapedSpecialChars = specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const specialRegex = new RegExp(`[${escapedSpecialChars}]`, 'g');
      const specialCount = (password.match(specialRegex) || []).length;
      return specialCount >= policy.password_min_special;
    }
    return false;
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${strength}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700 min-w-[50px]">
          {getStrengthLabel()}
        </span>
      </div>

      <div className="space-y-1">
        {validation.requirements.map((req, index) => {
          const passed = checkRequirement(req);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              {passed ? (
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 flex-shrink-0" style={{ color: '#800000' }} />
              )}
              <span className={passed ? 'text-green-700 font-medium' : 'font-medium'} style={!passed ? { color: '#800000' } : {}}>
                {req}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
