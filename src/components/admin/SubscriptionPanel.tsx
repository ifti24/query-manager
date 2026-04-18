import { useEffect, useState } from 'react';
import { Check, AlertCircle, Zap, Star, Rocket, Gift, ExternalLink, RefreshCw, Receipt, Banknote, Calendar, ArrowRight } from 'lucide-react';
import { supabase, Subscription, SubscriptionPlan, Payment } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SubscriptionPanelProps {
  onShowPricing?: () => void;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free_trial: <Gift className="w-5 h-5" />,
  basic: <Zap className="w-5 h-5" />,
  standard: <Rocket className="w-5 h-5" />,
  premium: <Star className="w-5 h-5" />,
};

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  free_trial: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-700' },
  basic: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  standard: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  premium: { bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-700', badge: 'bg-white/20 text-white' },
};

const PLAN_BADGE: Record<string, string> = {
  free_trial: 'bg-sky-50 text-sky-700 border-sky-200',
  basic: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  standard: 'bg-amber-50 text-amber-700 border-amber-200',
  premium: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  bkash: 'bKash',
  nagad: 'Nagad',
  rocket: 'Rocket',
  cheque: 'Cheque',
  other: 'Other',
};

const PAYMENT_METHOD_STYLES: Record<string, string> = {
  cash: 'bg-emerald-50 text-emerald-700',
  bank_transfer: 'bg-blue-50 text-blue-700',
  bkash: 'bg-pink-50 text-pink-700',
  nagad: 'bg-orange-50 text-orange-700',
  rocket: 'bg-violet-50 text-violet-700',
  cheque: 'bg-slate-100 text-slate-600',
  other: 'bg-slate-100 text-slate-600',
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    trial: 'bg-blue-100 text-blue-700',
    expired: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status] || styles.active}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function UsageBar({ used, limit, label }: { used: number; limit: number | null; label: string }) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0;
  const isHigh = pct >= 80;
  const isUnlimited = limit === null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-sm font-medium text-slate-800">
          {isUnlimited ? `${used} used` : `${used} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${isHigh ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="text-xs text-slate-400">Unlimited (fair use)</div>
      )}
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SubscriptionPanel({ onShowPricing }: SubscriptionPanelProps) {
  const { profile } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSubscription = async () => {
    if (!profile?.account_id) return;
    setLoading(true);
    setError('');
    try {
      const [
        { data: subData, error: subError },
        { data: plansData, error: plansError },
        { data: paymentsData },
      ] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*, plan:subscription_plans(*)')
          .eq('account_id', profile.account_id)
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
          .eq('account_id', profile.account_id)
          .order('payment_date', { ascending: false }),
      ]);

      if (subError) throw subError;
      if (plansError) throw plansError;
      setSubscription(subData);
      setPlans(plansData || []);
      setPayments(paymentsData || []);
    } catch {
      setError('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [profile?.account_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  const plan = subscription?.plan;
  const colors = plan ? (PLAN_COLORS[plan.id] || PLAN_COLORS.basic) : PLAN_COLORS.free_trial;
  const isPremiumCard = plan?.id === 'premium';

  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_bdt), 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Subscription</h2>
        <p className="text-slate-500 text-sm mt-1">Manage your plan and usage</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {subscription && plan ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`lg:col-span-1 rounded-2xl border-2 ${colors.border} overflow-hidden`}>
            <div className={`${colors.bg} p-6`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPremiumCard ? 'bg-white/20 text-white' : colors.badge}`}>
                  {PLAN_ICONS[plan.id]}
                </div>
                <StatusBadge status={subscription.status} />
              </div>
              <h3 className={`text-2xl font-bold ${isPremiumCard ? 'text-white' : 'text-slate-900'}`}>
                {plan.display_name}
              </h3>
              <p className={`text-sm mt-1 ${isPremiumCard ? 'text-slate-300' : 'text-slate-500'}`}>
                {plan.price_bdt === 0 ? 'Free' : `৳${plan.price_bdt.toLocaleString()} / month`}
              </p>

              {trialDaysLeft !== null && subscription.status === 'trial' && (
                <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${trialDaysLeft <= 3 ? 'bg-red-100 text-red-700' : 'bg-white/50 text-slate-700'}`}>
                  {trialDaysLeft === 0 ? 'Trial expires today' : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in trial`}
                </div>
              )}
            </div>

            <div className="bg-white p-5 space-y-3">
              {(plan.features as string[]).map((feature: string, i: number) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h4 className="font-semibold text-slate-800 mb-5">Usage This Month</h4>
              <div className="space-y-5">
                <UsageBar
                  used={subscription.queries_used}
                  limit={plan.id === 'premium' ? null : plan.queries_per_month}
                  label="Queries Used"
                />
              </div>
              <p className="text-xs text-slate-400 mt-4">
                Usage resets at the start of each billing month.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h4 className="font-semibold text-slate-800 mb-4">Subscription Details</h4>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Plan</dt>
                  <dd className="font-medium text-slate-800">{plan.display_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd><StatusBadge status={subscription.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Started</dt>
                  <dd className="font-medium text-slate-800">
                    {new Date(subscription.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </dd>
                </div>
                {(() => {
                  if (subscription.status === 'trial' && subscription.trial_ends_at) {
                    return (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Trial ends</dt>
                        <dd className="font-semibold text-slate-800">
                          {new Date(subscription.trial_ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </dd>
                      </div>
                    );
                  }
                  if (subscription.status === 'active') {
                    return (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Expires on</dt>
                        <dd className="font-semibold text-slate-800">
                          {subscription.ends_at
                            ? new Date(subscription.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : <span className="text-slate-400 font-normal">Not set</span>}
                        </dd>
                      </div>
                    );
                  }
                  if (subscription.ends_at) {
                    return (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Ended on</dt>
                        <dd className="font-semibold text-slate-800">
                          {new Date(subscription.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </dd>
                      </div>
                    );
                  }
                  return null;
                })()}
              </dl>

              {subscription.status === 'trial' && (
                <div className="mt-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <span className="font-semibold">After your trial ends,</span> your account will automatically move to the <span className="font-semibold">Basic plan</span> (৳149/month) unless you upgrade or cancel before the expiry date.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
              <h4 className="font-semibold mb-1">Want to upgrade?</h4>
              <p className="text-slate-300 text-sm mb-4">
                Get more queries, analytics, and priority support with a higher tier plan.
              </p>
              <button
                onClick={onShowPricing}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200"
              >
                <ExternalLink className="w-4 h-4" />
                View All Plans
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No active subscription</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            Choose a plan to unlock all features of QueryPing.
          </p>
          <button
            onClick={onShowPricing}
            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            View Pricing Plans
          </button>
        </div>
      )}

      {/* Payment History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Payment History</h3>
            {payments.length > 0 && (
              <p className="text-sm text-slate-500 mt-0.5">
                {payments.length} transaction{payments.length !== 1 ? 's' : ''} · Total ৳{totalPaid.toLocaleString('en-BD', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <Receipt className="w-5 h-5 text-slate-400" />
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 text-slate-400">
            <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No payment records yet</p>
            <p className="text-xs mt-1 text-slate-300">Payments will appear here once recorded</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map(p => {
              const planLabel = plans.find(pl => pl.id === p.plan_id)?.display_name ?? p.plan_id;
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Banknote className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-900">
                          ৳{Number(p.amount_bdt).toLocaleString('en-BD', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PAYMENT_METHOD_STYLES[p.payment_method] ?? PAYMENT_METHOD_STYLES.other}`}>
                            {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${PLAN_BADGE[p.plan_id] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {planLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-slate-700">{fmtDate(p.payment_date)}</p>
                      {p.reference_number && (
                        <p className="text-xs text-slate-400 mt-0.5">Ref: {p.reference_number}</p>
                      )}
                    </div>
                  </div>

                  {(p.period_start || p.period_end) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Period:</span>
                      {p.period_start && <span className="font-medium">{fmtDate(p.period_start)}</span>}
                      {p.period_start && p.period_end && <ArrowRight className="w-3 h-3" />}
                      {p.period_end && <span className="font-medium">{fmtDate(p.period_end)}</span>}
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

      {plans.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Available Plans</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p) => {
              const c = PLAN_COLORS[p.id] || PLAN_COLORS.basic;
              const isCurrentPlan = subscription?.plan_id === p.id;
              const isPremium = p.id === 'premium';
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border-2 overflow-hidden transition-all duration-200 ${
                    isCurrentPlan ? 'border-amber-400 shadow-md' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`${c.bg} p-4`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 text-sm ${c.badge}`}>
                      {PLAN_ICONS[p.id]}
                    </div>
                    <div className={`font-bold text-base ${isPremium ? 'text-white' : 'text-slate-900'}`}>
                      {p.display_name}
                    </div>
                    <div className={`text-xs mt-0.5 ${isPremium ? 'text-slate-300' : 'text-slate-500'}`}>
                      {p.price_bdt === 0 ? 'Free trial' : `৳${p.price_bdt}/mo`}
                    </div>
                  </div>
                  <div className="bg-white p-3">
                    {isCurrentPlan ? (
                      <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Current Plan
                      </span>
                    ) : (
                      <button
                        onClick={onShowPricing}
                        className="text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
                      >
                        Learn more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
