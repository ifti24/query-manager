import { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Mail,
  Briefcase,
  CreditCard,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  User,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface UserProfileModalProps {
  userId: string;
  accountId: string;
  onClose: () => void;
}

interface ProfileData {
  id: string;
  full_name: string | null;
  email: string;
  designation: string | null;
  employee_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  role: string;
}

const roleConfig: Record<string, { label: string; avatarClasses: string; iconClasses: string; icon: React.ComponentType<{ className?: string }> }> = {
  account_owner: { label: 'Account Owner', avatarClasses: 'bg-slate-100 border-slate-200', iconClasses: 'text-slate-600', icon: Building2 },
  supervisor: { label: 'Supervisor', avatarClasses: 'bg-teal-50 border-teal-100', iconClasses: 'text-teal-600', icon: Shield },
  member: { label: 'Member', avatarClasses: 'bg-emerald-50 border-emerald-100', iconClasses: 'text-emerald-600', icon: User },
};

export default function UserProfileModal({ userId, accountId, onClose }: UserProfileModalProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: prof }, { data: roleRow }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, designation, employee_id, is_active, last_login_at')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('account_id', accountId)
          .maybeSingle(),
      ]);
      if (prof) {
        setProfile({
          ...prof,
          role: roleRow?.role ?? 'account_owner',
        });
      }
      setLoading(false);
    }
    load();
  }, [userId, accountId]);

  const rc = profile ? (roleConfig[profile.role] ?? roleConfig.account_owner) : null;

  const infoRows: { icon: React.ReactNode; label: string; value: string | null }[] = profile
    ? [
        { icon: <Mail className="w-4 h-4" />, label: 'Email', value: profile.email },
        { icon: <Briefcase className="w-4 h-4" />, label: 'Designation', value: profile.designation || null },
        { icon: <CreditCard className="w-4 h-4" />, label: 'Employee ID', value: profile.employee_id || null },
        {
          icon: <Clock className="w-4 h-4" />,
          label: 'Last Login',
          value: profile.last_login_at
            ? new Date(profile.last_login_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Never logged in',
        },
      ]
    : [];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">User Profile</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : !profile || !rc ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Profile not found</div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center flex-shrink-0 ${rc.avatarClasses}`}>
                <rc.icon className={`w-6 h-6 ${rc.iconClasses}`} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{profile.full_name || 'No name set'}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{rc.label}</span>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${profile.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {profile.is_active
                      ? <CheckCircle className="w-3 h-3" />
                      : <XCircle className="w-3 h-3" />
                    }
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl divide-y divide-slate-100 border border-slate-100">
              {infoRows.map(row => row.value && (
                <div key={row.label} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-slate-400 flex-shrink-0">{row.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{row.label}</p>
                    <p className="text-sm text-slate-800 font-medium mt-0.5 break-all">{row.value}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 px-4 py-3">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Account Status</p>
                  <p className="text-sm text-slate-800 font-medium mt-0.5">{profile.is_active ? 'Active account' : 'Deactivated account'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
