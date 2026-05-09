import { useState, useMemo } from 'react';
import { Search, UserX, Clock, Building2, User } from 'lucide-react';
import type { UnverifiedSignup } from './usePlatformStats';

interface UnverifiedSignupsTableProps {
  signups: UnverifiedSignup[];
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

export default function UnverifiedSignupsTable({ signups }: UnverifiedSignupsTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    if (!search.trim()) return signups;
    const q = search.toLowerCase();
    return signups.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        (s.full_name ?? '').toLowerCase().includes(q) ||
        (s.account_display_name ?? '').toLowerCase().includes(q)
    );
  }, [signups, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <UserX className="w-4 h-4 text-amber-500" />
            Unverified Signups
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} user{filtered.length !== 1 ? 's' : ''} signed up but never logged in
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

      {/* Empty state */}
      {paginated.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
          <UserX className="w-8 h-8 opacity-40" />
          <p className="text-sm font-medium">
            {search ? 'No matches found' : 'No unverified signups'}
          </p>
          {!search && (
            <p className="text-xs text-slate-300">All registered users have completed their first login</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Name / Email</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Company</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Account Type</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Team Size</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Signed Up</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginated.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 text-sm">
                      {s.full_name || <span className="text-slate-400 italic">No name</span>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.email}</div>
                  </td>

                  <td className="px-4 py-3">
                    {s.account_display_name ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-700">{s.account_display_name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {s.account_type ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
                        s.account_type === 'business'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {s.account_type === 'business'
                          ? <Building2 className="w-3 h-3" />
                          : <User className="w-3 h-3" />
                        }
                        {s.account_type === 'business' ? 'Business' : 'Individual'}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {(s.expected_supervisor_count != null || s.expected_member_count != null) ? (
                      <div className="text-xs text-slate-600">
                        <span>{s.expected_supervisor_count ?? 0} supervisors</span>
                        <span className="text-slate-300 mx-1">·</span>
                        <span>{s.expected_member_count ?? 0} members</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {timeAgo(s.created_at)}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">
                      {new Date(s.created_at).toLocaleDateString()}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Never logged in
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
