interface PlanBreakdownProps {
  plans: { plan: string; display: string; count: number; percent: number }[];
  totalAccounts: number;
}

const PLAN_COLORS: Record<string, string> = {
  free_trial: 'bg-sky-400',
  basic: 'bg-emerald-400',
  standard: 'bg-amber-400',
  premium: 'bg-rose-400',
  no_plan: 'bg-slate-300',
};

const PLAN_BADGE: Record<string, string> = {
  free_trial: 'bg-sky-50 text-sky-700 border-sky-200',
  basic: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  standard: 'bg-amber-50 text-amber-700 border-amber-200',
  premium: 'bg-rose-50 text-rose-700 border-rose-200',
  no_plan: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function PlanBreakdown({ plans, totalAccounts }: PlanBreakdownProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">License / Plan Distribution</h3>
      <div className="space-y-3">
        {plans.map((p) => (
          <div key={p.plan} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                    PLAN_BADGE[p.plan] ?? PLAN_BADGE.no_plan
                  }`}
                >
                  {p.display}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{p.count}</span>
                <span className="text-xs text-slate-400">accounts</span>
                <span className="text-xs font-semibold text-slate-600 w-10 text-right">{p.percent}%</span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${PLAN_COLORS[p.plan] ?? PLAN_COLORS.no_plan}`}
                style={{ width: `${p.percent}%` }}
              />
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No accounts yet</p>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-4 text-right">{totalAccounts} total accounts</p>
    </div>
  );
}
