import type { AccountSummary } from './usePlatformStats';

interface ActivityLeaderboardProps {
  accounts: AccountSummary[];
  totalQueries: number;
}

const RANK_COLORS = [
  'bg-amber-400',
  'bg-slate-300',
  'bg-amber-600',
  'bg-slate-200',
  'bg-slate-200',
];

export default function ActivityLeaderboard({ accounts, totalQueries }: ActivityLeaderboardProps) {
  const top = accounts.slice(0, 8);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-1">Most Active Companies</h3>
      <p className="text-xs text-slate-400 mb-4">Ranked by total query volume — count and % of platform total</p>
      <div className="space-y-2.5">
        {top.map((acc, i) => {
          const pct = totalQueries > 0 ? (acc.total_queries / totalQueries) * 100 : 0;
          const userTotal = acc.member_count + acc.supervisor_count + 1;
          return (
            <div key={acc.id} className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ${
                  RANK_COLORS[i] ?? 'bg-slate-200'
                } ${i < 3 ? 'text-white' : 'text-slate-600'}`}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-semibold text-slate-800 truncate">{acc.name}</span>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-xs text-slate-500">{userTotal} users</span>
                    <span className="text-sm font-bold text-slate-900 w-10 text-right">{acc.total_queries}</span>
                    <span className="text-xs text-slate-400 w-12 text-right">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-teal-500' : 'bg-slate-400'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {top.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No data yet</p>
        )}
      </div>
    </div>
  );
}
