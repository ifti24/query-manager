import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Shield, Building2, Users, UserCheck, Crown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ActiveRoleType, UserRoleRecord, ROLE_DISPLAY_NAMES, buildActiveRole } from '../../lib/supabase';

function getRoleIcon(role: string, size = 'w-5 h-5') {
  switch (role) {
    case 'super_admin': return <Shield className={size} />;
    case 'support_admin': return <UserCheck className={size} />;
    case 'account_owner': return <Crown className={size} />;
    case 'supervisor': return <Users className={size} />;
    case 'member': return <Building2 className={size} />;
    default: return <Shield className={size} />;
  }
}

function getRoleColor(role: string) {
  switch (role) {
    case 'super_admin': return 'bg-red-50 text-red-700 border-red-200';
    case 'support_admin': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'account_owner': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'supervisor': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'member': return 'bg-slate-50 text-slate-700 border-slate-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function getRoleDescription(roleRecord: UserRoleRecord) {
  if (roleRecord.role === 'super_admin') return 'Full platform access';
  if (roleRecord.role === 'support_admin') return 'Platform support access';
  if (roleRecord.account) return roleRecord.account.name;
  return 'Account access';
}

interface RoleSwitcherModalProps {
  onSelect: (role: ActiveRoleType) => void;
}

export function RoleSwitcherModal({ onSelect }: RoleSwitcherModalProps) {
  const { allRoles, activeRole } = useAuth();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-6 pt-8 pb-6 border-b border-slate-100 text-center">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Select your role</h2>
          <p className="text-slate-500 text-sm mt-1">
            You have access to multiple roles. Choose how you want to proceed.
          </p>
        </div>

        <div className="p-4 space-y-2">
          {allRoles.map((roleRecord) => {
            const built = buildActiveRole(roleRecord);
            if (!built) return null;

            const isActive =
              activeRole?.type === built.type &&
              activeRole.role === built.role &&
              (built.type === 'account' && activeRole.type === 'account'
                ? activeRole.accountId === built.accountId
                : true);

            return (
              <button
                key={roleRecord.id}
                onClick={() => onSelect(built)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  isActive
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${getRoleColor(roleRecord.role)}`}>
                  {getRoleIcon(roleRecord.role)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{ROLE_DISPLAY_NAMES[roleRecord.role]}</p>
                  <p className="text-slate-500 text-sm truncate">{getRoleDescription(roleRecord)}</p>
                </div>
                {isActive && (
                  <span className="ml-auto text-xs font-medium text-slate-600 bg-slate-200 px-2 py-1 rounded-full flex-shrink-0">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function RoleSwitcherDropdown() {
  const { allRoles, activeRole, setActiveRole } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!activeRole || allRoles.length < 2) return null;

  const activeRoleRecord = allRoles.find((r) => {
    const built = buildActiveRole(r);
    if (!built) return false;
    if (built.type !== activeRole.type) return false;
    if (built.role !== activeRole.role) return false;
    if (built.type === 'account' && activeRole.type === 'account') {
      return built.accountId === activeRole.accountId;
    }
    return true;
  });

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${getRoleColor(activeRole.role)} hover:opacity-80`}
      >
        {getRoleIcon(activeRole.role, 'w-4 h-4')}
        <span className="hidden sm:inline">{ROLE_DISPLAY_NAMES[activeRole.role]}</span>
        {activeRole.type === 'account' && (
          <span className="hidden md:inline text-xs opacity-70">
            — {activeRole.accountName}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50">
          <div className="px-3 py-1.5 mb-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Switch role</p>
          </div>
          {allRoles.map((roleRecord) => {
            const built = buildActiveRole(roleRecord);
            if (!built) return null;

            const isCurrent = activeRoleRecord?.id === roleRecord.id;

            return (
              <button
                key={roleRecord.id}
                onClick={() => {
                  setActiveRole(built);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
                  isCurrent ? 'bg-slate-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${getRoleColor(roleRecord.role)}`}>
                  {getRoleIcon(roleRecord.role, 'w-4 h-4')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{ROLE_DISPLAY_NAMES[roleRecord.role]}</p>
                  <p className="text-xs text-slate-500 truncate">{getRoleDescription(roleRecord)}</p>
                </div>
                {isCurrent && (
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
