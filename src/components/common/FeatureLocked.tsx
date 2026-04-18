import { Lock, ArrowUpRight } from 'lucide-react';

interface FeatureLockedProps {
  featureName: string;
  requiredPlan: string;
  onUpgrade?: () => void;
  compact?: boolean;
}

export function FeatureLocked({ featureName, requiredPlan, onUpgrade, compact = false }: FeatureLockedProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg border border-slate-200">
        <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-xs text-slate-500">
          Requires <span className="font-semibold text-slate-700">{requiredPlan}</span>
        </span>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="ml-auto text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-0.5 transition-colors"
          >
            Upgrade <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[1px] bg-white/60 z-10 flex flex-col items-center justify-center gap-4 px-8 py-12">
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
          <Lock className="w-6 h-6 text-slate-500" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-800 text-base mb-1">{featureName} is locked</p>
          <p className="text-slate-500 text-sm">
            Upgrade to <span className="font-semibold text-slate-700">{requiredPlan}</span> or higher to access this feature.
          </p>
        </div>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            View Plans
          </button>
        )}
      </div>
      <div className="opacity-20 pointer-events-none select-none p-8">
        <div className="h-6 bg-slate-200 rounded w-1/3 mb-4" />
        <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-3/4" />
      </div>
    </div>
  );
}

interface QueryLimitBannerProps {
  used: number;
  limit: number;
  onUpgrade?: () => void;
}

export function QueryLimitBanner({ used, limit, onUpgrade }: QueryLimitBannerProps) {
  const pct = Math.min((used / limit) * 100, 100);
  const isAtLimit = used >= limit;
  const isNearLimit = pct >= 80 && !isAtLimit;

  if (!isNearLimit && !isAtLimit) return null;

  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded-xl border text-sm ${
      isAtLimit
        ? 'bg-red-50 border-red-200 text-red-800'
        : 'bg-amber-50 border-amber-200 text-amber-800'
    }`}>
      <Lock className={`w-4 h-4 flex-shrink-0 ${isAtLimit ? 'text-red-500' : 'text-amber-500'}`} />
      <span className="flex-1">
        {isAtLimit
          ? `You've reached your query limit (${used}/${limit}). New queries are blocked.`
          : `You're at ${Math.round(pct)}% of your query limit (${used}/${limit} queries used).`}
      </span>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className={`flex items-center gap-1 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors ${
            isAtLimit
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}
        >
          Upgrade <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

interface MemberLimitBannerProps {
  current: number;
  limit: number;
  onUpgrade?: () => void;
}

export function MemberLimitBanner({ current, limit, onUpgrade }: MemberLimitBannerProps) {
  const isAtLimit = current >= limit;
  if (!isAtLimit) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl border bg-red-50 border-red-200 text-red-800 text-sm">
      <Lock className="w-4 h-4 flex-shrink-0 text-red-500" />
      <span className="flex-1">
        Member limit reached ({current}/{limit}). Upgrade your plan to invite more members.
      </span>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className="flex items-center gap-1 font-semibold text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          Upgrade <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
