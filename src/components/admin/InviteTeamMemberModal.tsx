import { useState, useEffect } from 'react';
import { X, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getPasswordPolicy, PasswordPolicy } from '../../lib/passwordPolicy';

interface InviteTeamMemberModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function InviteTeamMemberModal({ onClose, onCreated }: InviteTeamMemberModalProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy | null>(null);

  useEffect(() => {
    const fetchPolicy = async () => {
      const policy = await getPasswordPolicy();
      if (policy) {
        setPasswordPolicy(policy);
      }
    };
    fetchPolicy();
  }, []);

  const generateCompliantPassword = (): string => {
    if (!passwordPolicy || !passwordPolicy.password_policy_applies_to.includes('team_member')) {
      return Math.random().toString(36).slice(-12);
    }

    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = passwordPolicy.password_allowed_special_chars;

    let password = '';

    if (passwordPolicy.password_require_uppercase) {
      for (let i = 0; i < passwordPolicy.password_min_uppercase; i++) {
        password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
      }
    }

    if (passwordPolicy.password_require_lowercase) {
      for (let i = 0; i < passwordPolicy.password_min_lowercase; i++) {
        password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
      }
    }

    if (passwordPolicy.password_require_numbers) {
      for (let i = 0; i < passwordPolicy.password_min_numbers; i++) {
        password += numbers.charAt(Math.floor(Math.random() * numbers.length));
      }
    }

    if (passwordPolicy.password_require_special) {
      for (let i = 0; i < passwordPolicy.password_min_special; i++) {
        password += special.charAt(Math.floor(Math.random() * special.length));
      }
    }

    const allChars = uppercase + lowercase + numbers + special;
    const remainingLength = passwordPolicy.password_min_length - password.length;
    for (let i = 0; i < remainingLength; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    return password.split('').sort(() => Math.random() - 0.5).join('').slice(0, passwordPolicy.password_max_length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const generatedPassword = generateCompliantPassword();

      const { data, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password: generatedPassword,
        user_metadata: {
          full_name: fullName,
        },
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: 'team_member',
        });
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite team member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Invite Team Member</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-medium mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                placeholder="john@example.com"
                required
              />
            </div>
            <p className="text-slate-600 text-sm mt-2">
              A temporary password will be sent to this email address
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:bg-slate-400"
            >
              {loading ? 'Inviting...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
