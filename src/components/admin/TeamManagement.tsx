import { useEffect, useState, useCallback } from 'react';
import { supabase, UserProfile, UserRoleRecord, ROLE_DISPLAY_NAMES } from '../../lib/supabase';
import { logUnauthorizedAccess, isUnauthorizedError, buildDescription } from '../../lib/securityAudit';
import { Plus, Trash2, ToggleLeft, ToggleRight, Lock, RefreshCw, Search, Filter, ChevronDown, Mail, Clock, CheckCircle, XCircle, AlertCircle, SendHorizontal as SendHorizonal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, SlidersHorizontal } from 'lucide-react';
import InviteTeamMemberModal from './InviteTeamMemberModal';
import MemberDetailModal from './MemberDetailModal';
import { ConfirmationModal, DeleteConfirmationModal } from '../common/ConfirmationModal';
import { MemberLimitBanner } from '../common/FeatureLocked';
import { useAuth } from '../../contexts/AuthContext';
import { ToastContainer, ToastMessage } from '../common/Toast';

interface TeamManagementProps {
  onShowPricing?: () => void;
}

interface InvitationToken {
  id: string;
  token: string;
  user_id: string;
  account_id: string;
  invited_by: string;
  temp_password: string;
  role: string;
  supervisor_id: string | null;
  supervisor_name: string;
  is_used: boolean;
  expires_at: string;
  created_at: string;
}

interface MemberWithRole extends UserProfile {
  roleRecord?: UserRoleRecord;
  invitationToken?: InvitationToken | null;
  accountStatus: 'active' | 'inactive' | 'invited' | 'expired';
}

type FilterStatus = 'all' | 'active' | 'inactive' | 'invited' | 'expired';
type FilterRole = 'all' | 'supervisor' | 'member';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function TeamManagement({ onShowPricing }: TeamManagementProps) {
  const { features, activeRole, isSupervisor, isAccountOwner, user } = useAuth();
  const [members, setMembers] = useState<MemberWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'activate' | 'deactivate' | 'delete';
    member: MemberWithRole | null;
  }>({ type: 'activate', member: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberWithRole | null>(null);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => [...prev, { ...toast, id: crypto.randomUUID() }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterSupervisor, setFilterSupervisor] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [search, setSearch] = useState('');
  const [supervisorOptions, setSupervisorOptions] = useState<{ id: string; name: string }[]>([]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const accountId = activeRole?.type === 'account' ? activeRole.accountId : null;

  const fetchMembers = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      let rolesQuery = supabase
        .from('user_roles')
        .select('*, profile:profiles!user_roles_user_id_fkey(*)')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (isSupervisor && !isAccountOwner) {
        rolesQuery = rolesQuery.eq('role', 'member');
      } else {
        rolesQuery = rolesQuery.in('role', ['supervisor', 'member']);
      }

      const { data: rolesData, error: rolesError } = await rolesQuery;
      if (rolesError) {
        if (isUnauthorizedError({ message: rolesError.message, code: rolesError.code })) {
          logUnauthorizedAccess({
            user_id: user?.id,
            service_context: 'team:fetchMembers:user_roles',
            description: buildDescription('user_roles', rolesError, { account_id: accountId }),
            error_code: rolesError.code,
            error_message: rolesError.message,
            metadata: { account_id: accountId },
          });
        }
        throw rolesError;
      }

      const { data: tokens } = await supabase
        .from('invitation_tokens')
        .select('*')
        .eq('account_id', accountId);

      const tokensByUser: Record<string, InvitationToken> = {};
      (tokens || []).forEach((t: InvitationToken) => {
        if (!tokensByUser[t.user_id] || new Date(t.created_at) > new Date(tokensByUser[t.user_id].created_at)) {
          tokensByUser[t.user_id] = t;
        }
      });

      const now = new Date();
      const rawMembers: MemberWithRole[] = (rolesData || [])
        .filter((r: any) => r.profile && !r.profile.is_deleted)
        .map((r: any) => {
          const profile: UserProfile = r.profile;
          const token = tokensByUser[profile.id] || null;

          let accountStatus: MemberWithRole['accountStatus'] = 'active';
          if (!profile.last_login_at && token && !token.is_used) {
            if (new Date(token.expires_at) < now) {
              accountStatus = 'expired';
            } else {
              accountStatus = 'invited';
            }
          } else if (!profile.is_active) {
            accountStatus = 'inactive';
          }

          return {
            ...profile,
            roleRecord: r as UserRoleRecord,
            invitationToken: token,
            accountStatus,
          };
        });

      let finalMembers = rawMembers;
      if (isSupervisor && !isAccountOwner && user) {
        finalMembers = rawMembers.filter(m => m.supervisor_id === user.id);
      }

      setMembers(finalMembers);

      const svOptions = rawMembers
        .filter(m => m.roleRecord?.role === 'supervisor')
        .map(m => ({ id: m.id, name: m.full_name || m.email }));
      setSupervisorOptions(svOptions);
    } catch (err) {
      console.error('Error fetching members:', err);
      const e = err as { message?: string; code?: string };
      if (isUnauthorizedError(e)) {
        logUnauthorizedAccess({
          user_id: user?.id,
          service_context: 'team:fetchMembers',
          description: buildDescription('team', e, { account_id: accountId ?? undefined }),
          error_code: e.code,
          error_message: e.message,
          metadata: { account_id: accountId },
        });
      }
    } finally {
      setLoading(false);
    }
  }, [accountId, isSupervisor, isAccountOwner, user]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filteredMembers = members.filter(m => {
    if (filterStatus !== 'all' && m.accountStatus !== filterStatus) return false;
    if (filterRole !== 'all' && m.roleRecord?.role !== filterRole) return false;
    if (filterSupervisor !== 'all' && m.supervisor_id !== filterSupervisor) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !m.full_name?.toLowerCase().includes(q) &&
        !m.email?.toLowerCase().includes(q) &&
        !m.employee_id?.toLowerCase().includes(q) &&
        !m.designation?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalRecords = filteredMembers.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedMembers = filteredMembers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const startRecord = totalRecords > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(safePage * pageSize, totalRecords);

  const resetPage = () => setCurrentPage(1);

  const hasActiveFilters =
    filterStatus !== 'all' || filterRole !== 'all' || filterSupervisor !== 'all' || search.trim() !== '';

  const handleToggleActive = async () => {
    if (!confirmAction.member) return;
    setActionLoading(true);
    try {
      await supabase
        .from('profiles')
        .update({ is_active: !confirmAction.member.is_active })
        .eq('id', confirmAction.member.id);
      await fetchMembers();
      setConfirmAction({ type: 'activate', member: null });
    } catch (error) {
      console.error('Error updating member status:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!confirmAction.member) return;
    setActionLoading(true);
    try {
      await supabase
        .from('profiles')
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', confirmAction.member.id);
      if (confirmAction.member.roleRecord?.id) {
        await supabase.from('user_roles').delete().eq('id', confirmAction.member.roleRecord.id);
      }
      await fetchMembers();
      setConfirmAction({ type: 'delete', member: null });
    } catch (error) {
      console.error('Error soft deleting member:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleHardDelete = async () => {
    if (!confirmAction.member) return;
    setActionLoading(true);
    try {
      await supabase.from('profiles').delete().eq('id', confirmAction.member.id);
      await fetchMembers();
      setConfirmAction({ type: 'delete', member: null });
    } catch (error) {
      console.error('Error hard deleting member:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvite = async (member: MemberWithRole) => {
    if (!member.invitationToken || !accountId) return;
    setResendingId(member.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const { data: settings } = await supabase
        .from('admin_settings')
        .select('invite_link_validity_hours')
        .eq('account_id', accountId)
        .maybeSingle();

      const validityHours = (settings as any)?.invite_link_validity_hours ?? 24;
      const newExpiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000).toISOString();

      await supabase
        .from('invitation_tokens')
        .update({ expires_at: newExpiresAt, is_used: false })
        .eq('id', member.invitationToken.id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-team-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            email: member.email,
            fullName: member.full_name,
            designation: member.designation,
            gender: member.gender,
            employeeId: member.employee_id,
            unitDepartment: member.unit_department,
            division: member.division,
            role: member.roleRecord?.role,
            supervisorId: member.supervisor_id,
            supervisorName: member.invitationToken.supervisor_name,
            accountId,
            appUrl: window.location.origin,
            isResend: true,
            invitationTokenId: member.invitationToken.id,
            existingTempPassword: member.invitationToken.temp_password,
            existingToken: member.invitationToken.token,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        addToast({
          type: 'error',
          title: 'Failed to resend invitation',
          message: result.error || 'An unexpected error occurred. Please try again.',
        });
        return;
      }

      addToast({
        type: 'success',
        title: 'Invitation resent',
        message: `A new invitation email has been sent to ${member.email}.`,
      });

      await fetchMembers();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Failed to resend invitation',
        message: err?.message || 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setResendingId(null);
    }
  };

  const regularMembers = members.filter(m => m.roleRecord?.role === 'member');
  const atMemberLimit = features.membersLimit !== null && regularMembers.length >= features.membersLimit;

  const getRoleLabel = (member: MemberWithRole) => {
    const role = member.roleRecord?.role ?? member.role;
    return ROLE_DISPLAY_NAMES[role] ?? role;
  };

  const statusConfig: Record<MemberWithRole['accountStatus'], { label: string; classes: string; icon: React.ReactNode }> = {
    active: {
      label: 'Active',
      classes: 'bg-green-50 text-green-700 border-green-200',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    inactive: {
      label: 'Inactive',
      classes: 'bg-red-50 text-red-700 border-red-200',
      icon: <XCircle className="w-3 h-3" />,
    },
    invited: {
      label: 'Invited',
      classes: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <Mail className="w-3 h-3" />,
    },
    expired: {
      label: 'Link Expired',
      classes: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <AlertCircle className="w-3 h-3" />,
    },
  };

  const activeCount = members.filter(m => m.accountStatus === 'active').length;
  const invitedCount = members.filter(m => m.accountStatus === 'invited').length;
  const expiredCount = members.filter(m => m.accountStatus === 'expired').length;
  const inactiveCount = members.filter(m => m.accountStatus === 'inactive').length;

  return (
    <div className="space-y-4">
      {features.membersLimit !== null && atMemberLimit && (
        <MemberLimitBanner
          current={regularMembers.length}
          limit={features.membersLimit}
          onUpgrade={onShowPricing}
        />
      )}

      {/* Toolbar row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search by name, email, employee ID..."
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
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className="ml-auto">
          {atMemberLimit ? (
            <button
              onClick={onShowPricing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-500 rounded-lg cursor-not-allowed text-sm"
            >
              <Lock className="w-4 h-4" />
              Limit Reached
            </button>
          ) : (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Invite Member
            </button>
          )}
        </div>
      </div>

      {/* Collapsible panel: stats + filters */}
      {panelOpen && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          {/* Stats */}
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

          {/* Filters */}
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

            {isAccountOwner && (
              <div className="relative">
                <select
                  value={filterRole}
                  onChange={e => { setFilterRole(e.target.value as FilterRole); resetPage(); }}
                  className="pl-3 pr-8 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-slate-600 appearance-none cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="supervisor">Supervisors</option>
                  <option value="member">Members</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}

            {isAccountOwner && supervisorOptions.length > 0 && (
              <div className="relative">
                <select
                  value={filterSupervisor}
                  onChange={e => { setFilterSupervisor(e.target.value); resetPage(); }}
                  className="pl-3 pr-8 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-slate-600 appearance-none cursor-pointer"
                >
                  <option value="all">All Supervisors</option>
                  {supervisorOptions.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterRole('all');
                  setFilterSupervisor('all');
                  setSearch('');
                  resetPage();
                }}
                className="text-sm text-slate-500 hover:text-slate-800 underline underline-offset-2"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {showInviteModal && (
        <InviteTeamMemberModal
          onClose={() => setShowInviteModal(false)}
          onCreated={() => {
            setShowInviteModal(false);
            fetchMembers();
          }}
        />
      )}

      {/* Grid header: records info + page size */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {totalRecords > 0
            ? `Showing ${startRecord}–${endRecord} of ${totalRecords} member${totalRecords !== 1 ? 's' : ''}`
            : 'No members found'}
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
              <span className="text-sm text-slate-500">Loading...</span>
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
                {isAccountOwner && (
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Supervisor</th>
                )}
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Login</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && pagedMembers.length === 0 ? (
                <tr>
                  <td colSpan={isAccountOwner ? 7 : 6} className="text-center py-16 text-slate-400">
                    No team members found
                  </td>
                </tr>
              ) : (
                pagedMembers.map((member) => {
                  const status = statusConfig[member.accountStatus];
                  const isExpired = member.accountStatus === 'expired';
                  const isInvited = member.accountStatus === 'invited';
                  const supervisorMember = members.find(m => m.id === member.supervisor_id);

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedMember(member)}
                    >
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{member.full_name || 'N/A'}</p>
                          {member.employee_id && (
                            <p className="text-xs text-slate-400 mt-0.5">{member.employee_id}</p>
                          )}
                          {member.designation && (
                            <p className="text-xs text-slate-400">{member.designation}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{member.email}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {getRoleLabel(member)}
                        </span>
                      </td>
                      {isAccountOwner && (
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {member.roleRecord?.role === 'member'
                            ? (supervisorMember?.full_name || member.invitationToken?.supervisor_name || '—')
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                      )}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.classes}`}>
                            {status.icon}
                            {status.label}
                          </span>
                          {isInvited && member.invitationToken && (
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <Clock className="w-3 h-3" />
                              {(() => {
                                const diffMs = new Date(member.invitationToken.expires_at).getTime() - Date.now();
                                if (diffMs <= 0) return 'Expires soon';
                                const totalMins = Math.floor(diffMs / 60000);
                                const hrs = Math.floor(totalMins / 60);
                                const mins = totalMins % 60;
                                if (hrs === 0) return `${mins}m left`;
                                if (mins === 0) return `${hrs}h left`;
                                return `${hrs}h ${mins}m left`;
                              })()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">
                        {member.last_login_at
                          ? new Date(member.last_login_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                          : <span className="text-slate-300">Never</span>
                        }
                      </td>
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {(isInvited || isExpired) && (
                            <button
                              onClick={() => handleResendInvite(member)}
                              disabled={resendingId === member.id}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                                isExpired
                                  ? 'hover:bg-amber-50 text-amber-500'
                                  : 'hover:bg-blue-50 text-blue-500'
                              }`}
                              title="Resend invitation email"
                            >
                              {resendingId === member.id
                                ? <RefreshCw className="w-4 h-4 animate-spin" />
                                : <SendHorizonal className="w-4 h-4" />
                              }
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setConfirmAction({
                                type: member.is_active ? 'deactivate' : 'activate',
                                member,
                              })
                            }
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            title={member.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {member.is_active ? (
                              <ToggleRight className="w-5 h-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-slate-400" />
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmAction({ type: 'delete', member })}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Page {totalRecords > 0 ? safePage : 0} of {totalPages}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={safePage === 1 || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1 || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1.5 text-sm">{safePage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage === totalPages || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          allMembers={members}
          onClose={() => setSelectedMember(null)}
          onUpdated={async () => {
            await fetchMembers();
            setSelectedMember(null);
          }}
          onToggleActive={(m) => {
            setSelectedMember(null);
            setConfirmAction({ type: m.is_active ? 'deactivate' : 'activate', member: m });
          }}
          onDelete={(m) => {
            setSelectedMember(null);
            setConfirmAction({ type: 'delete', member: m });
          }}
          onResendInvite={(m) => {
            setSelectedMember(null);
            handleResendInvite(m);
          }}
          resendingId={resendingId}
        />
      )}

      <ConfirmationModal
        isOpen={
          confirmAction.member !== null &&
          (confirmAction.type === 'activate' || confirmAction.type === 'deactivate')
        }
        title={confirmAction.type === 'activate' ? 'Activate User' : 'Deactivate User'}
        message={
          confirmAction.type === 'activate'
            ? `Are you sure you want to activate ${confirmAction.member?.full_name}? They will be able to access the system again.`
            : `Are you sure you want to deactivate ${confirmAction.member?.full_name}? They will not be able to access the system until reactivated.`
        }
        confirmText={confirmAction.type === 'activate' ? 'Activate' : 'Deactivate'}
        confirmVariant={confirmAction.type === 'activate' ? 'info' : 'warning'}
        onConfirm={handleToggleActive}
        onCancel={() => setConfirmAction({ type: 'activate', member: null })}
        loading={actionLoading}
      />

      <DeleteConfirmationModal
        isOpen={confirmAction.member !== null && confirmAction.type === 'delete'}
        userName={confirmAction.member?.full_name || ''}
        onSoftDelete={handleSoftDelete}
        onHardDelete={handleHardDelete}
        onCancel={() => setConfirmAction({ type: 'delete', member: null })}
        loading={actionLoading}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
