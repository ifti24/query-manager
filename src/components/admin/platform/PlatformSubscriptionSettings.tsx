import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Search,
  CalendarPlus,
  Building2,
  Clock,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface PlanRow {
  id: string;
  name: string;
  display_name: string;
  price_bdt: number;
  queries_per_month: number | null;
  max_supervisors: number | null;
  max_members: number | null;
  trial_days: number | null;
  is_trial: boolean;
}

interface PlanOverride {
  plan_id: string;
  price_bdt: number | null;
  queries_per_month: number | null;
  max_supervisors: number | null;
  max_members: number | null;
  trial_days: number | null;
}

interface AccountTrialRow {
  id: string;
  name: string;
  owner_email: string;
  trial_ends_at: string | null;
  status: string | null;
}

const PLAN_COLORS: Record<string, string> = {
  free_trial: 'bg-sky-50 border-sky-200 text-sky-700',
  basic: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  standard: 'bg-amber-50 border-amber-200 text-amber-700',
  premium: 'bg-rose-50 border-rose-200 text-rose-700',
};

function PlanEditor({
  plan,
  override,
  onChange,
}: {
  plan: PlanRow;
  override: Partial<PlanOverride>;
  onChange: (field: keyof PlanOverride, value: number | null) => void;
}) {
  const badgeClass = PLAN_COLORS[plan.id] ?? 'bg-slate-100 border-slate-200 text-slate-700';

  const NumField = ({
    label,
    field,
    placeholder,
  }: {
    label: string;
    field: keyof PlanOverride;
    placeholder: string;
  }) => {
    const baseValue = (plan as any)[field] as number | null;
    const overrideValue = (override as any)[field] as number | null | undefined;
    const displayValue = overrideValue !== undefined ? overrideValue : baseValue;
    const hasOverride = overrideValue !== undefined && overrideValue !== baseValue;

    return (
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          {label}
          {hasOverride && (
            <span className="ml-1.5 text-amber-600 font-semibold normal-case">(overridden)</span>
          )}
        </label>
        <div className="relative">
          <input
            type="number"
            min={0}
            value={displayValue ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              onChange(field, v);
            }}
            placeholder={placeholder}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-600 ${
              hasOverride ? 'border-amber-300 bg-amber-50' : 'border-slate-300 bg-white'
            }`}
          />
          {baseValue !== null && overrideValue !== undefined && overrideValue !== baseValue && (
            <p className="text-xs text-slate-400 mt-0.5">Default: {baseValue ?? 'unlimited'}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className={`flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 ${badgeClass.split(' ')[0]}`}>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${badgeClass}`}>
          {plan.display_name}
        </span>
        <span className="text-xs text-slate-500">{plan.id}</span>
        {plan.is_trial && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            Trial plan
          </span>
        )}
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white">
        <NumField label="Price (BDT)" field="price_bdt" placeholder={String(plan.price_bdt)} />
        <NumField
          label="Queries / Month"
          field="queries_per_month"
          placeholder={String(plan.queries_per_month ?? 'unlimited')}
        />
        <NumField
          label="Max Supervisors"
          field="max_supervisors"
          placeholder={plan.max_supervisors ? String(plan.max_supervisors) : 'unlimited'}
        />
        <NumField
          label="Max Members"
          field="max_members"
          placeholder={plan.max_members ? String(plan.max_members) : 'unlimited'}
        />
        {plan.is_trial && (
          <NumField label="Trial Days" field="trial_days" placeholder={String(plan.trial_days ?? 15)} />
        )}
      </div>
    </div>
  );
}

export default function PlatformSubscriptionSettings() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [overrides, setOverrides] = useState<Map<string, Partial<PlanOverride>>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [trialAccounts, setTrialAccounts] = useState<AccountTrialRow[]>([]);
  const [trialSearch, setTrialSearch] = useState('');
  const [trialAccountId, setTrialAccountId] = useState('');
  const [extendDays, setExtendDays] = useState<number>(7);
  const [extending, setExtending] = useState(false);
  const [extendStatus, setExtendStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loadingTrials, setLoadingTrials] = useState(false);

  const loadData = useCallback(async () => {
    const [{ data: planData }, { data: overrideData }] = await Promise.all([
      supabase.from('subscription_plans').select('*').order('sort_order'),
      supabase.from('subscription_plan_overrides').select('*'),
    ]);
    setPlans(planData ?? []);
    const map = new Map<string, Partial<PlanOverride>>();
    (overrideData ?? []).forEach((o: any) => {
      map.set(o.plan_id, {
        plan_id: o.plan_id,
        price_bdt: o.price_bdt,
        queries_per_month: o.queries_per_month,
        max_supervisors: o.max_supervisors,
        max_members: o.max_members,
        trial_days: o.trial_days,
      });
    });
    setOverrides(map);
  }, []);

  const loadTrialAccounts = useCallback(async () => {
    setLoadingTrials(true);
    const { data } = await supabase
      .from('subscriptions')
      .select('account_id, status, trial_ends_at, accounts!inner(id, name, owner_id)')
      .eq('status', 'trial');

    if (!data) { setLoadingTrials(false); return; }

    const ownerIds = data.map((r: any) => r.accounts?.owner_id).filter(Boolean);
    const { data: profiles } = ownerIds.length
      ? await supabase.from('profiles').select('id, email').in('id', ownerIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.email]));

    setTrialAccounts(
      data.map((r: any) => ({
        id: r.accounts.id,
        name: r.accounts.name,
        owner_email: profileMap.get(r.accounts.owner_id) ?? '',
        trial_ends_at: r.trial_ends_at,
        status: r.status,
      }))
    );
    setLoadingTrials(false);
  }, []);

  useEffect(() => {
    if (open) {
      loadData();
      loadTrialAccounts();
    }
  }, [open, loadData, loadTrialAccounts]);

  const handleOverrideChange = (planId: string, field: keyof PlanOverride, value: number | null) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const existing = next.get(planId) ?? {};
      next.set(planId, { ...existing, [field]: value });
      return next;
    });
  };

  const handleSavePlans = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      for (const [planId, override] of overrides.entries()) {
        const payload = {
          plan_id: planId,
          price_bdt: override.price_bdt ?? null,
          queries_per_month: override.queries_per_month ?? null,
          max_supervisors: override.max_supervisors ?? null,
          max_members: override.max_members ?? null,
          trial_days: override.trial_days ?? null,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id ?? null,
        };
        await supabase
          .from('subscription_plan_overrides')
          .upsert(payload, { onConflict: 'plan_id' });
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleExtendTrial = async () => {
    if (!trialAccountId || extendDays < 1) return;
    setExtending(true);
    setExtendStatus(null);
    try {
      const { error } = await supabase.rpc('extend_account_trial', {
        p_account_id: trialAccountId,
        p_days: extendDays,
      });
      if (error) throw error;
      setExtendStatus({ type: 'success', msg: `Trial extended by ${extendDays} day${extendDays !== 1 ? 's' : ''}.` });
      setTrialAccountId('');
      await loadTrialAccounts();
    } catch (err: any) {
      setExtendStatus({ type: 'error', msg: err.message ?? 'Failed to extend trial.' });
    } finally {
      setExtending(false);
    }
  };

  const filteredTrials = trialAccounts.filter(
    (a) =>
      !trialSearch ||
      a.name.toLowerCase().includes(trialSearch.toLowerCase()) ||
      a.owner_email.toLowerCase().includes(trialSearch.toLowerCase())
  );

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const trialDaysLeft = (endsAt: string | null) => {
    if (!endsAt) return null;
    const diff = Math.ceil((new Date(endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Subscription Settings</h2>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
      </button>

      {open && (
        <div className="border-t border-slate-200 divide-y divide-slate-100">

          {/* Plan Limits Section */}
          <div className="px-6 py-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Plan Limits &amp; Pricing</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Override default restrictions per plan. Changes apply globally to all new subscriptions on that plan.
                Leave blank to use the plan's built-in defaults.
              </p>
            </div>

            {plans.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <PlanEditor
                    key={plan.id}
                    plan={plan}
                    override={overrides.get(plan.id) ?? {}}
                    onChange={(field, value) => handleOverrideChange(plan.id, field, value)}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSavePlans}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors disabled:bg-slate-400"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Plan Settings'}
              </button>
              {saveStatus === 'success' && (
                <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Saved
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-1.5 text-red-600 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Failed to save
                </div>
              )}
            </div>
          </div>

          {/* Extend Free Trial Section */}
          <div className="px-6 py-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Extend Free Trial</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Extend the trial period for a specific account by a set number of days.
              </p>
            </div>

            {/* Trial accounts list */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={trialSearch}
                  onChange={(e) => setTrialSearch(e.target.value)}
                  placeholder="Search trial accounts..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              {loadingTrials ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
              ) : filteredTrials.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No active trial accounts found</div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Account</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Trial Ends</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Days Left</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Select</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTrials.map((acc) => {
                        const daysLeft = trialDaysLeft(acc.trial_ends_at);
                        const isExpired = daysLeft !== null && daysLeft < 0;
                        const isSelected = trialAccountId === acc.id;
                        return (
                          <tr
                            key={acc.id}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                            onClick={() => setTrialAccountId(isSelected ? '' : acc.id)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <div>
                                  <p className="font-medium text-slate-900">{acc.name}</p>
                                  <p className="text-xs text-slate-400">{acc.owner_email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {fmtDate(acc.trial_ends_at)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {daysLeft !== null ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                                  isExpired
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : daysLeft <= 3
                                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                }`}>
                                  {isExpired ? `${Math.abs(daysLeft)}d ago` : `${daysLeft}d`}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className={`w-4 h-4 rounded border-2 mx-auto ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white m-0.5" fill="none" viewBox="0 0 12 12">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Extend controls */}
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Extend by:</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={extendDays}
                  onChange={(e) => setExtendDays(Math.max(1, Number(e.target.value)))}
                  className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                />
                <span className="text-sm text-slate-500">days</span>
              </div>
              <button
                onClick={handleExtendTrial}
                disabled={!trialAccountId || extending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {extending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                {extending ? 'Extending...' : 'Extend Trial'}
              </button>
              {!trialAccountId && (
                <span className="text-xs text-slate-400">Select an account above first</span>
              )}
            </div>

            {extendStatus && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                extendStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {extendStatus.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {extendStatus.msg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
