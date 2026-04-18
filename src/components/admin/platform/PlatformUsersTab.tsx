import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  Filter,
  ChevronDown,
  Loader2,
  Users,
  Shield,
  User,
  Building2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutList,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import AccountOwnerDetailModal from './AccountOwnerDetailModal';
import UserProfileModal from './UserProfileModal';
import type { AccountSummary } from './usePlatformStats';

interface PlatformUser {
  id: string;
  full_name: string | null;
  email: string;
  designation: string | null;
  employee_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  role: 'account_owner' | 'supervisor' | 'member';
  account_id: string;
  account_name: string;
  supervisor_id: string | null;
  accountStatus: 'active' | 'inactive' | 'invited' | 'expired';
}

type FilterRole = 'all' | 'account_owner' | 'supervisor' | 'member';
type FilterStatus = 'all' | 'active' | 'inactive' | 'invited' | 'expired';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const statusConfig = {
  active: { label: 'Active', classes: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" /> },
  inactive: { label: 'Inactive', classes: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
  invited: { label: 'Invited', classes: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Mail className="w-3 h-3" /> },
  expired: { label: 'Link Expired', classes: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertCircle className="w-3 h-3" /> },
};

const roleConfig = {
  account_owner: { label: 'Account Owner', classes: 'bg-slate-100 text-slate-700', icon: <Building2 className="w-3 h-3" /> },
  supervisor: { label: 'Supervisor', classes: 'bg-teal-50 text-teal-700', icon: <Shield className="w-3 h-3" /> },
  member: { label: 'Member', classes: 'bg-emerald-50 text-emerald-700', icon: <User className="w-3 h-3" /> },
};

export default function PlatformUsersTab() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [panelOpen, setPanelOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selectedAccount, setSelectedAccount] = useState<AccountSummary | null>(null);
  const [profileUser, setProfileUser] = useState<{ userId: string; accountId: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('id, name, owner_id, is_active, created_at');

      const accountList = (accountsData ?? []);
      const accountNameMap = new Map<string, string>(accountList.map((a: any) => [a.id, a.name]));
      const accountIds = accountList.map((a: any) => a.id);

      if (accountIds.length === 0) {
        setUsers([]);
        setAccounts([]);
        setLoading(false);
        return;
      }

      const [{ data: roles }, { data: tokens }, { data: ownerProfiles }] = await Promise.all([
        supabase
          .from('user_roles')
          .select('user_id, account_id, role, profile:profiles!user_roles_user_id_fkey(id, full_name, email, designation, employee_id, is_active, last_login_at, supervisor_id, account_id)')
          .in('account_id', accountIds)
          .in('role', ['account_owner', 'supervisor', 'member']),
        supabase
          .from('invitation_tokens')
          .select('user_id, account_id, is_used, expires_at')
          .in('account_id', accountIds),
        supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', accountList.map((a: any) => a.owner_id)),
      ]);

      const ownerMap = new Map<string, { email: string; full_name: string | null }>(
        (ownerProfiles ?? []).map((p: any) => [p.id, p])
      );

      const tokenMap = new Map<string, { is_used: boolean; expires_at: string }>();
      (tokens ?? []).forEach((t: any) => {
        const key = `${t.account_id}:${t.user_id}`;
        if (!tokenMap.has(key)) tokenMap.set(key, t);
      });

      const now = new Date();
      const rows: PlatformUser[] = (roles ?? [])
        .filter((r: any) => r.profile && !r.profile.is_deleted)
        .map((r: any) => {
          const p = r.profile;
          const token = tokenMap.get(`${r.account_id}:${p.id}`);
          let accountStatus: PlatformUser['accountStatus'] = 'active';
          if (r.role !== 'account_owner') {
            if (!p.last_login_at && token && !token.is_used) {
              accountStatus = new Date(token.expires_at) < now ? 'expired' : 'invited';
            } else if (!p.is_active) {
              accountStatus = 'inactive';
            }
          } else if (!p.is_active) {
            accountStatus = 'inactive';
          }
          return {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            designation: p.designation,
            employee_id: p.employee_id,
            is_active: p.is_active,
            last_login_at: p.last_login_at,
            role: r.role as PlatformUser['role'],
            account_id: r.account_id,
            account_name: accountNameMap.get(r.account_id) ?? r.account_id,
            supervisor_id: p.supervisor_id,
            accountStatus,
          };
        });

      setUsers(rows);

      const accountSummaries: AccountSummary[] = accountList.map((acc: any) => {
        const owner = ownerMap.get(acc.owner_id);
        return {
          id: acc.id,
          name: acc.name,
          owner_id: acc.owner_id,
          owner_name: owner?.full_name ?? null,
          owner_email: owner?.email ?? '',
          plan_id: null,
          plan_name: null,
          plan_display: null,
          subscription_status: null,
          trial_ends_at: null,
          ends_at: null,
          is_active: acc.is_active,
          member_count: 0,
          supervisor_count: 0,
          distinct_user_count: 0,
          total_queries: 0,
          open_queries: 0,
          resolved_queries: 0,
          archived_queries: 0,
          queries_used: 0,
          queries_limit: 0,
          created_at: acc.created_at,
        };
      });
      setAccounts(accountSummaries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const activeCount = users.filter(u => u.accountStatus === 'active').length;
  const invitedCount = users.filter(u => u.accountStatus === 'invited').length;
  const expiredCount = users.filter(u => u.accountStatus === 'expired').length;
  const inactiveCount = users.filter(u => u.accountStatus === 'inactive').length;

  const hasActiveFilters = filterRole !== 'all' || filterStatus !== 'all' || filterAccount !== 'all' || search.trim() !== '';

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filterRole !== 'all' && u.role !== filterRole) return false;
      if (filterStatus !== 'all' && u.accountStatus !== filterStatus) return false;
      if (filterAccount !== 'all' && u.account_id !== filterAccount) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !(u.full_name ?? '').toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !(u.employee_id ?? '').toLowerCase().includes(q) &&
          !(u.designation ?? '').toLowerCase().includes(q) &&
          !u.account_name.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [users, filterRole, filterStatus, filterAccount, search]);

  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const startRecord = totalRecords > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(safePage * pageSize, totalRecords);

  const resetPage = () => setCurrentPage(1);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search by name, email, employee ID, account..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
          />
        </div>
        <button
          onClick={() => setPanelOpen(o => !o)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            panelOpen || hasActiveFilters
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-amber-400" />}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filter panel */}
      {panelOpen && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Active', count: activeCount, color: 'text-green-700', bg: 'bg-green-50 border-green-100', status: 'active' as FilterStatus },
              { label: 'Invited', count: invitedCount, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100', status: 'invited' as FilterStatus },
              { label: 'Link Expired', count: expiredCount, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', status: 'expired' as FilterStatus },
              { label: 'Inactive', count: inactiveCount, color: 'text-red-700', bg: 'bg-red-50 border-red-100', status: 'inactive' as FilterStatus },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => { setFilterStatus(filterStatus === s.status ? 'all' : s.status); resetPage(); }}
                className={`rounded-lg border p-3 text-left transition-all hover:opacity-80 ${s.bg} ${filterStatus === s.status ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
              >
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filter by:</span>
            </div>

            <div className="relative">
              <select
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value as FilterStatus); resetPage(); }}
                className="pl-3 pr-8 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-slate-600 appearance-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="invited">Invited</option>
                <option value="expired">Link Expired</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={filterRole}
                onChange={e => { setFilterRole(e.target.value as FilterRole); resetPage(); }}
                className="pl-3 pr-8 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-slate-600 appearance-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="account_owner">Account Owners</option>
                <option value="supervisor">Supervisors</option>
                <option value="member">Members</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {accounts.length > 0 && (
              <div className="relative">
                <select
                  value={filterAccount}
                  onChange={e => { setFilterAccount(e.target.value); resetPage(); }}
                  className="pl-3 pr-8 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-slate-600 appearance-none cursor-pointer"
                >
                  <option value="all">All Accounts</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={() => { setFilterRole('all'); setFilterStatus('all'); setFilterAccount('all'); setSearch(''); resetPage(); }}
                className="text-sm text-slate-500 hover:text-slate-800 underline underline-offset-2"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Records info + page size */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {totalRecords > 0
            ? `Showing ${startRecord}–${endRecord} of ${totalRecords} user${totalRecords !== 1 ? 's' : ''}`
            : loading ? '' : 'No users found'}
        </span>
        <div className="flex items-center gap-2">
          <span>Per page:</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); resetPage(); }}
            className="px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-7 h-7 text-slate-600 animate-spin" />
              <span className="text-sm text-slate-500">Loading users...</span>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Account</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Login</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No users found
                  </td>
                </tr>
              ) : (
                paged.map(u => {
                  const status = statusConfig[u.accountStatus];
                  const role = roleConfig[u.role];
                  const acct = accounts.find(a => a.id === u.account_id);
                  return (
                    <tr
                      key={`${u.account_id}:${u.id}:${u.role}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setProfileUser({ userId: u.id, accountId: u.account_id })}
                          className="group text-left"
                        >
                          <p className="font-medium text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{u.full_name || 'N/A'}</p>
                          {u.employee_id && <p className="text-xs text-slate-400 mt-0.5">{u.employee_id}</p>}
                          {u.designation && <p className="text-xs text-slate-400">{u.designation}</p>}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs font-medium ${role.classes}`}>
                          {role.icon}
                          {role.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {u.account_name}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs font-medium border ${status.classes}`}>
                          {status.icon}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">
                        {u.last_login_at ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-300" />
                            {new Date(u.last_login_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        ) : (
                          <span className="text-slate-300">Never</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {acct && (
                          <button
                            onClick={() => setSelectedAccount(acct)}
                            title="View account details"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <LayoutList className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Page {totalRecords > 0 ? safePage : 0} of {totalPages}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage(1)} disabled={safePage === 1 || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1 || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1.5 text-sm">{safePage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {selectedAccount && (
        <AccountOwnerDetailModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
        />
      )}

      {profileUser && (
        <UserProfileModal
          userId={profileUser.userId}
          accountId={profileUser.accountId}
          onClose={() => setProfileUser(null)}
        />
      )}
    </div>
  );
}
