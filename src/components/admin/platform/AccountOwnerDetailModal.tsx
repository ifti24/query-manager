import { useState, useEffect, useCallback } from 'react';
import { X, Shield, User, ChevronRight, Loader2, Building2, Mail, CheckCircle, XCircle, AlertCircle, Clock, GitBranch, UserCheck, Calendar, CreditCard, Briefcase, ChevronDown, ChevronUp, ArrowLeft, BarChart2, Users, History, ArrowRight, CreditCard as Edit2, Save, Plus, Banknote, Receipt, FileText, Check } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { AccountSummary } from './usePlatformStats';
import type { Payment, SubscriptionPlan } from '../../../lib/supabase';

interface OrgUser {
  id: string;
  full_name: string | null;
  email: string;
  designation: string | null;
  employee_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  role: 'account_owner' | 'supervisor' | 'member';
  accountStatus: 'active' | 'inactive' | 'invited' | 'expired';
  members?: OrgUser[];
  member_count?: number;
}

interface AccountOwnerDetailModalProps {
  account: AccountSummary;
  onClose: () => void;
}

type ModalTab = 'account' | 'subscription' | 'tree' | 'user-detail';
type SubscriptionSubTab = 'manage' | 'history' | 'payments';

interface SubHistoryEntry {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_display: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

interface ActiveSub {
  id: string;
  plan_id: string;
  status: string;
  started_at: string;
  ends_at: string | null;
  trial_ends_at: string | null;
  queries_used: number;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

const statusConfig = {
  active: { label: 'Active', classes: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" /> },
  inactive: { label: 'Inactive', classes: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
  invited: { label: 'Invited', classes: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Mail className="w-3 h-3" /> },
  expired: { label: 'Link Expired', classes: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertCircle className="w-3 h-3" /> },
};

const subStatusConfig: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  trial: { label: 'Trial', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  expired: { label: 'Expired', classes: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const planBadge: Record<string, string> = {
  free_trial: 'bg-sky-50 text-sky-700 border-sky-200',
  basic: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  standard: 'bg-amber-50 text-amber-700 border-amber-200',
  premium: 'bg-rose-50 text-rose-700 border-rose-200',
};

const roleConfig = {
  account_owner: { label: 'Account Owner', avatarClasses: 'bg-slate-100 border-slate-200', iconClasses: 'text-slate-600', icon: Building2 },
  supervisor: { label: 'Supervisor', avatarClasses: 'bg-teal-50 border-teal-100', iconClasses: 'text-teal-600', icon: Shield },
  member: { label: 'Member', avatarClasses: 'bg-emerald-50 border-emerald-100', iconClasses: 'text-emerald-600', icon: User },
};

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ?? 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function AccountInfoTab({ account }: { account: AccountSummary }) {
  const sub = account.subscription_status ? subStatusConfig[account.subscription_status] : null;
  const totalUsers = account.supervisor_count + account.member_count + 1;

  const queryUsagePct = account.queries_limit > 0
    ? Math.min((account.queries_used / account.queries_limit) * 100, 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
        <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-6 h-6 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Account Owner</p>
          <p className="text-base font-bold text-slate-900 mt-0.5 truncate">{account.owner_name ?? 'Unknown'}</p>
          <p className="text-sm text-slate-500 truncate">{account.owner_email}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {sub && (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${sub.classes}`}>{sub.label}</span>
          )}
          {account.plan_name && (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${planBadge[account.plan_name] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              {account.plan_display ?? account.plan_name}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50">
        <div className="flex items-center gap-3 px-4 py-3">
          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Member Since</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              {new Date(account.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        {(account.trial_ends_at || account.ends_at) && (
          <div className="flex items-center gap-3 px-4 py-3">
            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                {account.subscription_status === 'trial' ? 'Trial Ends' : 'Subscription Ends'}
              </p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">
                {new Date((account.trial_ends_at ?? account.ends_at)!).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-3">
          <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Team</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              {totalUsers} total · {account.supervisor_count} supervisor{account.supervisor_count !== 1 ? 's' : ''} · {account.member_count} member{account.member_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Query Activity</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={account.total_queries} />
          <StatCard label="Open" value={account.open_queries} accent="text-amber-600" />
          <StatCard label="Resolved" value={account.resolved_queries} accent="text-emerald-600" />
          <StatCard label="Archived" value={account.archived_queries} accent="text-slate-500" />
        </div>
      </div>

      {account.queries_limit > 0 && (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-400" />
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Query Usage</p>
            </div>
            <span className="text-sm font-bold text-slate-700">{account.queries_used} / {account.queries_limit}</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${queryUsagePct > 85 ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${queryUsagePct}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">{queryUsagePct.toFixed(1)}% of monthly limit used</p>
        </div>
      )}
    </div>
  );
}

function UserDetailPanel({ user, onBack }: { user: OrgUser; onBack: () => void }) {
  const status = statusConfig[user.accountStatus];
  const role = roleConfig[user.role];
  const RoleIcon = role.icon;

  const infoRows: { icon: React.ReactNode; label: string; value: string | null }[] = [
    { icon: <Mail className="w-4 h-4" />, label: 'Email', value: user.email },
    { icon: <Briefcase className="w-4 h-4" />, label: 'Designation', value: user.designation || null },
    { icon: <CreditCard className="w-4 h-4" />, label: 'Employee ID', value: user.employee_id || null },
    {
      icon: <Clock className="w-4 h-4" />,
      label: 'Last Login',
      value: user.last_login_at
        ? new Date(user.last_login_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Never logged in',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to org tree
      </button>

      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center flex-shrink-0 ${role.avatarClasses}`}>
          <RoleIcon className={`w-6 h-6 ${role.iconClasses}`} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">{user.full_name || 'No name set'}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{role.label}</span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${status.classes}`}>
              {status.icon}
              {status.label}
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
      </div>

      {user.role === 'supervisor' && user.member_count !== undefined && (
        <div className="flex items-center gap-3 px-4 py-3 bg-teal-50 border border-teal-100 rounded-xl">
          <UserCheck className="w-4 h-4 text-teal-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-teal-600 font-medium uppercase tracking-wide">Team Size</p>
            <p className="text-sm font-bold text-teal-800 mt-0.5">{user.member_count} member{user.member_count !== 1 ? 's' : ''} reporting</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Account Status</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">{user.is_active ? 'Active account' : 'Deactivated account'}</p>
        </div>
      </div>
    </div>
  );
}

function SupervisorNode({ supervisor, onSelectUser }: { supervisor: OrgUser; onSelectUser: (u: OrgUser) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasMembers = (supervisor.members?.length ?? 0) > 0;

  return (
    <div className="ml-8 mt-2">
      <div className="relative">
        <div className="absolute bg-slate-200" style={{ left: -20, top: 0, width: 1, height: '100%' }} />
        <div className="absolute bg-slate-200" style={{ left: -20, top: 20, width: 16, height: 1 }} />

        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-teal-200 hover:bg-teal-50/40 transition-all group">
          <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <button onClick={() => onSelectUser(supervisor)} className="flex-1 text-left min-w-0">
            <p className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 transition-colors truncate">
              {supervisor.full_name || supervisor.email}
            </p>
            <p className="text-xs text-slate-400 truncate">{supervisor.email}</p>
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!supervisor.is_active && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">Inactive</span>
            )}
            {hasMembers ? (
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="font-semibold">{supervisor.member_count}</span>
                <span className="text-slate-400">members</span>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="text-xs text-slate-400">0 members</span>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-400 transition-colors" />
          </div>
        </div>

        {expanded && hasMembers && (
          <div className="mt-1">
            {supervisor.members!.map((member, idx) => (
              <div key={member.id} className="ml-8 mt-1.5 relative">
                <div
                  className="absolute bg-slate-200"
                  style={{ left: -20, top: 0, width: 1, height: idx === supervisor.members!.length - 1 ? 20 : '100%' }}
                />
                <div className="absolute bg-slate-200" style={{ left: -20, top: 20, width: 16, height: 1 }} />
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all group">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-emerald-600" />
                  </div>
                  <button onClick={() => onSelectUser(member)} className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                      {member.full_name || member.email}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{member.email}</p>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig[member.accountStatus].classes}`}>
                      {statusConfig[member.accountStatus].icon}
                      {statusConfig[member.accountStatus].label}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const planColors: Record<string, { bg: string; border: string; dot: string; badge: string }> = {
  free_trial: { bg: 'bg-sky-50', border: 'border-sky-200', dot: 'bg-sky-400', badge: 'bg-sky-100 text-sky-700 border-sky-200' },
  basic: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  standard: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  premium: { bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-400', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
};

const subHistStatusConfig: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  trial: { label: 'Trial', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  expired: { label: 'Expired', classes: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', classes: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SubscriptionHistoryTab({ accountId }: { accountId: string }) {
  const [history, setHistory] = useState<SubHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('subscription_history')
        .select('id, plan_id, plan_name, plan_display, status, started_at, ended_at, notes')
        .eq('account_id', accountId)
        .order('started_at', { ascending: true });
      setHistory(data ?? []);
      setLoading(false);
    })();
  }, [accountId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-6 text-center py-16 text-slate-400">
        <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No subscription history found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
        <div className="space-y-4">
          {history.map((entry, idx) => {
            const colors = planColors[entry.plan_id] ?? planColors['basic'];
            const statusBadge = subHistStatusConfig[entry.status] ?? { label: entry.status, classes: 'bg-slate-100 text-slate-600 border-slate-200' };
            const isCurrent = idx === history.length - 1;

            return (
              <div key={entry.id} className="relative pl-10">
                <div className={`absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 border-white ${colors.dot} ${isCurrent ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`} />
                <div className={`rounded-xl border p-4 ${isCurrent ? `${colors.bg} ${colors.border}` : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${colors.badge}`}>
                          {entry.plan_display}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge.classes}`}>
                          {statusBadge.label}
                        </span>
                        {isCurrent && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-white font-semibold">Current</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{fmtDate(entry.started_at)}</span>
                        {entry.ended_at && (
                          <>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span>{fmtDate(entry.ended_at)}</span>
                          </>
                        )}
                        {!entry.ended_at && isCurrent && (
                          <>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-emerald-600 font-medium">Present</span>
                          </>
                        )}
                      </div>
                      {entry.started_at && entry.ended_at && (
                        <p className="text-xs text-slate-400 mt-1">
                          {Math.ceil((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / (1000 * 60 * 60 * 24))} days
                        </p>
                      )}
                      {entry.started_at && !entry.ended_at && (
                        <p className="text-xs text-slate-400 mt-1">
                          {Math.ceil((Date.now() - new Date(entry.started_at).getTime()) / (1000 * 60 * 60 * 24))} days so far
                        </p>
                      )}
                    </div>
                  </div>
                  {entry.notes && (
                    <p className="mt-2 text-xs text-slate-500 italic border-t border-slate-200 pt-2">{entry.notes}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface RecordPaymentFormProps {
  accountId: string;
  subscriptionId: string | null;
  plans: SubscriptionPlan[];
  currentPlanId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function RecordPaymentForm({ accountId, subscriptionId, plans, currentPlanId, onSuccess, onCancel }: RecordPaymentFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    amount_bdt: '',
    payment_method: 'cash',
    reference_number: '',
    payment_date: new Date().toISOString().split('T')[0],
    plan_id: currentPlanId,
    period_start: '',
    period_end: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount_bdt || parseFloat(form.amount_bdt) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { error: insertErr } = await supabase.from('payments').insert({
        account_id: accountId,
        subscription_id: subscriptionId,
        amount_bdt: parseFloat(form.amount_bdt),
        payment_method: form.payment_method,
        reference_number: form.reference_number || null,
        payment_date: form.payment_date,
        plan_id: form.plan_id,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        notes: form.notes || null,
      });
      if (insertErr) throw insertErr;
      onSuccess();
    } catch (err: any) {
      setError(err.message ?? 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Amount (BDT) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.amount_bdt}
            onChange={e => set('amount_bdt', e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Payment Date *</label>
          <input
            type="date"
            required
            value={form.payment_date}
            onChange={e => set('payment_date', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Payment Method *</label>
          <select
            value={form.payment_method}
            onChange={e => set('payment_method', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white"
          >
            {PAYMENT_METHODS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Reference / Txn ID</label>
          <input
            type="text"
            value={form.reference_number}
            onChange={e => set('reference_number', e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Plan</label>
        <select
          value={form.plan_id}
          onChange={e => set('plan_id', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white"
        >
          {plans.map(p => (
            <option key={p.id} value={p.id}>{p.display_name} — BDT {p.price_bdt}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Period Start</label>
          <input
            type="date"
            value={form.period_start}
            onChange={e => set('period_start', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Period End</label>
          <input
            type="date"
            value={form.period_end}
            onChange={e => set('period_end', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Notes</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={2}
          placeholder="Optional notes..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Record Payment'}
        </button>
      </div>
    </form>
  );
}

function PaymentMethodBadge({ method }: { method: string }) {
  const styles: Record<string, string> = {
    cash: 'bg-emerald-50 text-emerald-700',
    bank_transfer: 'bg-blue-50 text-blue-700',
    bkash: 'bg-pink-50 text-pink-700',
    nagad: 'bg-orange-50 text-orange-700',
    rocket: 'bg-violet-50 text-violet-700',
    cheque: 'bg-slate-100 text-slate-600',
    other: 'bg-slate-100 text-slate-600',
  };
  const labels: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    bkash: 'bKash',
    nagad: 'Nagad',
    rocket: 'Rocket',
    cheque: 'Cheque',
    other: 'Other',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${styles[method] ?? styles.other}`}>
      {labels[method] ?? method}
    </span>
  );
}

interface SubscriptionTabProps {
  account: AccountSummary;
}

function SubscriptionTab({ account }: SubscriptionTabProps) {
  const [subTab, setSubTab] = useState<SubscriptionSubTab>('manage');
  const [activeSub, setActiveSub] = useState<ActiveSub | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const [editPlanId, setEditPlanId] = useState('');
  const [editEndsAt, setEditEndsAt] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: subData }, { data: plansData }, { data: paymentsData }] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('id, plan_id, status, started_at, ends_at, trial_ends_at, queries_used')
          .eq('account_id', account.id)
          .in('status', ['active', 'trial'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('payments')
          .select('*')
          .eq('account_id', account.id)
          .order('payment_date', { ascending: false }),
      ]);

      setActiveSub(subData);
      setPlans(plansData ?? []);
      setPayments(paymentsData ?? []);

      if (subData) {
        setEditPlanId(subData.plan_id);
        const endsAt = subData.trial_ends_at || subData.ends_at;
        setEditEndsAt(endsAt ? new Date(endsAt).toISOString().split('T')[0] : '');
      }
    } catch {
      setError('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveSubscription = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const endsAtValue = editEndsAt ? new Date(editEndsAt + 'T23:59:59').toISOString() : null;
      const { error: rpcErr } = await supabase.rpc('update_account_subscription', {
        p_account_id: account.id,
        p_plan_id: editPlanId,
        p_ends_at: endsAtValue,
        p_notes: editNotes || null,
      });
      if (rpcErr) throw rpcErr;
      setSuccess('Subscription updated successfully');
      setEditNotes('');
      await fetchData();
    } catch (err: any) {
      setError(err.message ?? 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_bdt), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  const currentPlan = plans.find(p => p.id === activeSub?.plan_id);

  return (
    <div className="p-6 space-y-5">
      {/* Sub-tab nav */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {([
          { key: 'manage', label: 'Manage', icon: Edit2 },
          { key: 'history', label: 'History', icon: History },
          { key: 'payments', label: 'Payments', icon: Receipt },
        ] as { key: SubscriptionSubTab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
              subTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {key === 'payments' && payments.length > 0 && (
              <span className="ml-0.5 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">
                {payments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Manage tab */}
      {subTab === 'manage' && (
        <div className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          {/* Current plan card */}
          {activeSub && currentPlan && (
            <div className={`rounded-xl border p-4 ${planColors[activeSub.plan_id]?.bg ?? 'bg-slate-50'} ${planColors[activeSub.plan_id]?.border ?? 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Current Plan</p>
                  <p className="text-lg font-bold text-slate-900">{currentPlan.display_name}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {currentPlan.price_bdt === 0 ? 'Free' : `BDT ${currentPlan.price_bdt.toLocaleString()} / month`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${subStatusConfig[activeSub.status]?.classes ?? ''}`}>
                    {activeSub.status.charAt(0).toUpperCase() + activeSub.status.slice(1)}
                  </span>
                  <span className="text-xs text-slate-500">{activeSub.queries_used} queries used</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-black/10 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Started</p>
                  <p className="font-semibold text-slate-800">{fmtDate(activeSub.started_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Expires</p>
                  <p className="font-semibold text-slate-800">
                    {activeSub.ends_at || activeSub.trial_ends_at
                      ? fmtDate((activeSub.ends_at || activeSub.trial_ends_at)!)
                      : <span className="text-slate-400 font-normal">Not set</span>}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!activeSub && (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No active subscription found</p>
            </div>
          )}

          {/* Edit form */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-slate-400" />
              Update Subscription
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Plan</label>
              <select
                value={editPlanId}
                onChange={e => setEditPlanId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.display_name} — BDT {p.price_bdt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Expiry Date <span className="text-slate-400 font-normal normal-case">(leave blank for no expiry)</span>
              </label>
              <input
                type="date"
                value={editEndsAt}
                onChange={e => setEditEndsAt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Change Notes</label>
              <input
                type="text"
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="e.g. Renewed for 3 months, payment received"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleSaveSubscription}
              disabled={saving || !editPlanId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* History tab */}
      {subTab === 'history' && (
        <SubscriptionHistoryTab accountId={account.id} />
      )}

      {/* Payments tab */}
      {subTab === 'payments' && (
        <div className="space-y-4">
          {/* Summary */}
          {payments.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Total Collected</p>
                <p className="text-xl font-bold text-emerald-800 mt-1">BDT {totalPaid.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Transactions</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{payments.length}</p>
              </div>
            </div>
          )}

          {/* Record payment toggle */}
          {showPaymentForm ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-slate-400" />
                Record New Payment
              </h4>
              <RecordPaymentForm
                accountId={account.id}
                subscriptionId={activeSub?.id ?? null}
                plans={plans}
                currentPlanId={activeSub?.plan_id ?? plans[0]?.id ?? ''}
                onSuccess={() => {
                  setShowPaymentForm(false);
                  fetchData();
                }}
                onCancel={() => setShowPaymentForm(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 text-sm font-medium rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              Record Payment
            </button>
          )}

          {/* Payment list */}
          {payments.length === 0 && !showPaymentForm && (
            <div className="text-center py-10 text-slate-400">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No payments recorded yet</p>
            </div>
          )}

          {payments.length > 0 && (
            <div className="space-y-2">
              {payments.map(p => {
                const planLabel = plans.find(pl => pl.id === p.plan_id)?.display_name ?? p.plan_id;
                return (
                  <div key={p.id} className="bg-white border border-slate-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Banknote className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">BDT {Number(p.amount_bdt).toLocaleString('en-BD', { minimumFractionDigits: 2 })}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <PaymentMethodBadge method={p.payment_method} />
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${planBadge[p.plan_id] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {planLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-slate-700">{fmtDate(p.payment_date)}</p>
                        {p.reference_number && (
                          <p className="text-xs text-slate-400 mt-0.5">Ref: {p.reference_number}</p>
                        )}
                      </div>
                    </div>
                    {(p.period_start || p.period_end) && (
                      <div className="mt-2 pt-2 border-t border-slate-50 flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {p.period_start && fmtDate(p.period_start)}
                        {p.period_start && p.period_end && <ArrowRight className="w-3 h-3" />}
                        {p.period_end && fmtDate(p.period_end)}
                      </div>
                    )}
                    {p.notes && (
                      <p className="mt-2 text-xs text-slate-400 italic">{p.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AccountOwnerDetailModal({ account, onClose }: AccountOwnerDetailModalProps) {
  const [tab, setTab] = useState<ModalTab>('account');
  const [owner, setOwner] = useState<OrgUser | null>(null);
  const [supervisors, setSupervisors] = useState<OrgUser[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(false);

  const fetchOrgTree = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: roles }, { data: tokens }, { data: ownerProfile }] = await Promise.all([
        supabase
          .from('user_roles')
          .select('user_id, role, profile:profiles!user_roles_user_id_fkey(id, full_name, email, designation, employee_id, is_active, last_login_at, supervisor_id)')
          .eq('account_id', account.id)
          .in('role', ['account_owner', 'supervisor', 'member']),
        supabase
          .from('invitation_tokens')
          .select('user_id, is_used, expires_at')
          .eq('account_id', account.id),
        supabase
          .from('profiles')
          .select('id, full_name, email, designation, employee_id, is_active, last_login_at')
          .eq('id', account.owner_id)
          .maybeSingle(),
      ]);

      const tokenMap = new Map<string, { is_used: boolean; expires_at: string }>();
      (tokens ?? []).forEach((t: any) => {
        if (!tokenMap.has(t.user_id)) tokenMap.set(t.user_id, t);
      });

      const now = new Date();

      const deriveStatus = (p: any, role: string): OrgUser['accountStatus'] => {
        if (!p.is_active) return 'inactive';
        if (role !== 'account_owner') {
          const token = tokenMap.get(p.id);
          if (!p.last_login_at && token && !token.is_used) {
            return new Date(token.expires_at) < now ? 'expired' : 'invited';
          }
        }
        return 'active';
      };

      const ownerUser: OrgUser | null = ownerProfile
        ? {
            id: ownerProfile.id,
            full_name: ownerProfile.full_name,
            email: ownerProfile.email,
            designation: ownerProfile.designation,
            employee_id: ownerProfile.employee_id,
            is_active: ownerProfile.is_active,
            last_login_at: ownerProfile.last_login_at,
            role: 'account_owner',
            accountStatus: deriveStatus(ownerProfile, 'account_owner'),
          }
        : null;

      const roleList = (roles ?? []).filter((r: any) => r.profile && !r.profile.is_deleted);

      const supervisorRows: OrgUser[] = roleList
        .filter((r: any) => r.role === 'supervisor')
        .map((r: any) => ({
          id: r.profile.id,
          full_name: r.profile.full_name,
          email: r.profile.email,
          designation: r.profile.designation,
          employee_id: r.profile.employee_id,
          is_active: r.profile.is_active,
          last_login_at: r.profile.last_login_at,
          role: 'supervisor' as const,
          accountStatus: deriveStatus(r.profile, 'supervisor'),
          members: [],
          member_count: 0,
        }));

      const svMap = new Map<string, OrgUser>(supervisorRows.map(sv => [sv.id, sv]));
      const unassigned: OrgUser[] = [];

      roleList
        .filter((r: any) => r.role === 'member')
        .forEach((r: any) => {
          const p = r.profile;
          const member: OrgUser = {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            designation: p.designation,
            employee_id: p.employee_id,
            is_active: p.is_active,
            last_login_at: p.last_login_at,
            role: 'member',
            accountStatus: deriveStatus(p, 'member'),
          };
          const sv = p.supervisor_id ? svMap.get(p.supervisor_id) : null;
          if (sv) {
            sv.members!.push(member);
            sv.member_count = (sv.member_count ?? 0) + 1;
          } else {
            unassigned.push(member);
          }
        });

      setOwner(ownerUser);
      setSupervisors(supervisorRows);
      setUnassignedMembers(unassigned);
    } finally {
      setLoading(false);
    }
  }, [account.id, account.owner_id]);

  useEffect(() => {
    fetchOrgTree();
  }, [fetchOrgTree]);

  const handleSelectUser = (user: OrgUser) => {
    setSelectedUser(user);
    setTab('user-detail');
  };

  const handleBackToTree = () => {
    setTab('tree');
  };

  const totalUsers = account.distinct_user_count > 0
    ? account.distinct_user_count
    : (owner ? 1 : 0) + supervisors.length + supervisors.reduce((sum, sv) => sum + (sv.member_count ?? 0), 0) + unassignedMembers.length;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">{account.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {account.owner_name ?? account.owner_email}
                {account.owner_name && <span className="text-slate-400"> · {account.owner_email}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-slate-100 flex gap-0 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setTab('account')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === 'account' ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Account
          </button>
          <button
            onClick={() => setTab('subscription')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === 'subscription' ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Subscription
          </button>
          <button
            onClick={() => setTab('tree')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === 'tree' ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            Org Tree
            {!loading && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-semibold">
                {totalUsers}
              </span>
            )}
          </button>
          <button
            disabled={!selectedUser}
            onClick={() => selectedUser && setTab('user-detail')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
              tab === 'user-detail' ? 'border-slate-800 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            {selectedUser ? (selectedUser.full_name?.split(' ')[0] || selectedUser.email.split('@')[0]) : 'User Detail'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'account' && <AccountInfoTab account={account} />}
          {tab === 'subscription' && <SubscriptionTab account={account} />}

          {tab === 'tree' && (
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-4 mb-5 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-500" /><span>Owner</span></div>
                    <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-teal-500" /><span>Supervisor</span></div>
                    <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-emerald-500" /><span>Member</span></div>
                    <span className="ml-auto text-slate-400">Click any user to view details</span>
                  </div>

                  {owner && (
                    <div
                      className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-all group cursor-pointer"
                      onClick={() => handleSelectUser(owner)}
                    >
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{owner.full_name || owner.email}</p>
                        <p className="text-xs text-slate-500 truncate">{owner.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">Account Owner</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                      </div>
                    </div>
                  )}

                  {supervisors.length === 0 && unassignedMembers.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm">No team members in this account yet</div>
                  )}

                  {supervisors.length > 0 && (
                    <div className="mt-1 relative">
                      <div className="absolute bg-slate-200" style={{ left: 15, top: 0, width: 1, height: '100%' }} />
                      {supervisors.map((sv) => (
                        <SupervisorNode key={sv.id} supervisor={sv} onSelectUser={handleSelectUser} />
                      ))}
                    </div>
                  )}

                  {unassignedMembers.length > 0 && (
                    <div className="mt-4 border border-amber-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setShowUnassigned(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-semibold text-amber-800">
                            {unassignedMembers.length} unassigned member{unassignedMembers.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-amber-600">· no supervisor</span>
                        </div>
                        {showUnassigned ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronDown className="w-4 h-4 text-amber-500" />}
                      </button>
                      {showUnassigned && (
                        <div className="divide-y divide-amber-100">
                          {unassignedMembers.map(m => (
                            <button
                              key={m.id}
                              onClick={() => handleSelectUser(m)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 transition-colors text-left group"
                            >
                              <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                                <User className="w-3 h-3 text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{m.full_name || m.email}</p>
                                <p className="text-xs text-slate-400 truncate">{m.email}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig[m.accountStatus].classes}`}>
                                  {statusConfig[m.accountStatus].icon}
                                  {statusConfig[m.accountStatus].label}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'user-detail' && selectedUser && (
            <UserDetailPanel user={selectedUser} onBack={handleBackToTree} />
          )}
        </div>
      </div>
    </div>
  );
}
