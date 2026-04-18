import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Search,
  AlertTriangle,
  Clock,
  LayoutList,
} from 'lucide-react';
import type { AccountSummary } from './usePlatformStats';
import UserProfileModal from './UserProfileModal';

interface AccountsTableProps {
  accounts: AccountSummary[];
  totalQueries: number;
  onSelectAccount?: (account: AccountSummary) => void;
}

type SortKey = 'total_queries' | 'member_count' | 'name' | 'created_at' | 'subscription_status';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  trial: 'bg-sky-50 text-sky-700 border-sky-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

const PLAN_BADGE: Record<string, string> = {
  free_trial: 'bg-sky-50 text-sky-700 border-sky-200',
  basic: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  standard: 'bg-amber-50 text-amber-700 border-amber-200',
  premium: 'bg-rose-50 text-rose-700 border-rose-200',
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function AccountsTable({ accounts, totalQueries, onSelectAccount }: AccountsTableProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total_queries');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [profileUser, setProfileUser] = useState<{ userId: string; accountId: string } | null>(null);
  const PAGE_SIZE = 10;

  const allStatuses = useMemo(() => {
    const s = new Set(accounts.map((a) => a.subscription_status ?? 'none'));
    return ['all', ...Array.from(s)];
  }, [accounts]);

  const allPlans = useMemo(() => {
    const s = new Set(accounts.map((a) => a.plan_name ?? 'none'));
    return ['all', ...Array.from(s)];
  }, [accounts]);

  const filtered = useMemo(() => {
    let list = [...accounts];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.owner_email.toLowerCase().includes(q) ||
          (a.owner_name ?? '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      list = list.filter((a) => (a.subscription_status ?? 'none') === filterStatus);
    }
    if (filterPlan !== 'all') {
      list = list.filter((a) => (a.plan_name ?? 'none') === filterPlan);
    }
    list.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === 'total_queries') { av = a.total_queries; bv = b.total_queries; }
      else if (sortKey === 'member_count') { av = a.distinct_user_count; bv = b.distinct_user_count; }
      else if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (sortKey === 'created_at') { av = a.created_at; bv = b.created_at; }
      else { av = a.subscription_status ?? ''; bv = b.subscription_status ?? ''; }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [accounts, search, sortKey, sortAsc, filterStatus, filterPlan]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(false); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3 opacity-30" />
    );

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Company / Account Details</h3>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} accounts</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search company or owner..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 w-48"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {allStatuses.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
              ))}
            </select>
            <select
              value={filterPlan}
              onChange={(e) => { setFilterPlan(e.target.value); setPage(1); }}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {allPlans.map((p) => (
                <option key={p} value={p}>{p === 'all' ? 'All Plans' : p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th
                  className="px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                  onClick={() => handleSort('name')}
                >
                  <span className="flex items-center gap-1">Name <SortIcon col="name" /></span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Owner</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th
                  className="px-4 py-3 text-right font-medium text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                  onClick={() => handleSort('member_count')}
                >
                  <span className="flex items-center justify-end gap-1">Users <SortIcon col="member_count" /></span>
                </th>
                <th
                  className="px-4 py-3 text-right font-medium text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                  onClick={() => handleSort('total_queries')}
                >
                  <span className="flex items-center justify-end gap-1">Queries <SortIcon col="total_queries" /></span>
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Usage %</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginated.map((acc) => {
                const userPercent = totalQueries > 0 ? ((acc.total_queries / totalQueries) * 100).toFixed(1) : '0.0';
                const days = daysUntil(acc.trial_ends_at ?? acc.ends_at);

                return (
                  <>
                    <tr
                      key={acc.id}
                      className={`hover:bg-slate-50 transition-colors ${acc.subscription_status === 'expired' ? 'bg-red-50/30' : ''}`}
                    >
                      {/* Company name — plain text, no click */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 text-sm">{acc.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {new Date(acc.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Owner name — click opens profile modal */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setProfileUser({ userId: acc.owner_id, accountId: acc.id })}
                          className="group text-left"
                        >
                          <div className="text-sm text-slate-800 group-hover:text-blue-600 transition-colors font-medium">
                            {acc.owner_name ?? '—'}
                          </div>
                          <div className="text-xs text-slate-400 group-hover:text-blue-400 transition-colors">
                            {acc.owner_email}
                          </div>
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        {acc.plan_name ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${PLAN_BADGE[acc.plan_name] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {acc.plan_display ?? acc.plan_name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No plan</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {acc.subscription_status ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${STATUS_BADGE[acc.subscription_status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {acc.subscription_status}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          {acc.subscription_status === 'trial' && days !== null && (
                            <span className={`flex items-center gap-0.5 text-xs ${days <= 3 ? 'text-red-500' : 'text-slate-400'}`}>
                              <Clock className="w-3 h-3" />
                              {days > 0 ? `${days}d left` : 'Expired'}
                            </span>
                          )}
                          {acc.subscription_status === 'expired' && (
                            <span className="flex items-center gap-0.5 text-xs text-red-500">
                              <AlertTriangle className="w-3 h-3" />
                              Not renewed
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Distinct user count */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-800">{acc.distinct_user_count}</span>
                        <div className="text-xs text-slate-400">
                          {acc.supervisor_count}s · {acc.member_count}m
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-800">{acc.total_queries}</span>
                        <div className="text-xs text-slate-400">
                          {acc.open_queries} open
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-semibold text-slate-800">{userPercent}%</span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(parseFloat(userPercent), 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Detail icon — opens account modal */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onSelectAccount?.(acc)}
                          title="View account details"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <LayoutList className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>

                  </>
                );
              })}
            </tbody>
          </table>
          {paginated.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No accounts match your filters</div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {profileUser && (
        <UserProfileModal
          userId={profileUser.userId}
          accountId={profileUser.accountId}
          onClose={() => setProfileUser(null)}
        />
      )}
    </>
  );
}
