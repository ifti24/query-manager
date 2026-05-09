import { useState, useMemo } from 'react';
import { Search, Users, Clock, AlertCircle, Info } from 'lucide-react';
import type { OtherUser } from './usePlatformStats';

interface OtherUsersTableProps {
  users: OtherUser[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function OtherUsersTable({ users }: OtherUsersTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.account_display_name ?? '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            Others
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} user{filtered.length !== 1 ? 's' : ''} who signed up but never completed account setup
          </p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email..."
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 w-48"
          />
        </div>
      </div>

      {/* Info banner */}
      <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500">
          These users registered and logged into the platform but their account was never fully set up. They are not team members of any account owner.
        </p>
      </div>

      {paginated.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
          <Users className="w-8 h-8 opacity-40" />
          <p className="text-sm font-medium">
            {search ? 'No matches found' : 'No users in this category'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Name / Email</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Company / Name Given</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Last Login</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Signed Up</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Why Not in Active Accounts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginated.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 text-sm">
                      {u.full_name || <span className="text-slate-400 italic">No name</span>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{u.email}</div>
                  </td>

                  <td className="px-4 py-3">
                    {u.account_display_name ? (
                      <span className="text-sm text-slate-700">{u.account_display_name}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {u.last_login_at ? (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {timeAgo(u.last_login_at)}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5">
                          {new Date(u.last_login_at).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Never</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {timeAgo(u.created_at)}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">
                      {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </td>

                  <td className="px-4 py-3 max-w-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {u.reason}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
  );
}
