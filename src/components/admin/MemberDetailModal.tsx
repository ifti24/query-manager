import { useState, useEffect } from 'react';
import { X, User, Mail, Briefcase, Building, LayoutGrid, Users, Hash, CircleUser as UserCircle2, ChevronDown, CreditCard as Edit2, ToggleLeft, ToggleRight, Trash2, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Save, Ban, UserCheck, MessageCircle, Phone } from 'lucide-react';
import { supabase, UserProfile, UserRoleRecord, ROLE_DISPLAY_NAMES } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PhoneInput from '../common/PhoneInput';

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
  employee_id?: string;
  designation?: string;
  unit_department?: string;
  division?: string;
  supervisor_id?: string | null;
  gender?: string;
}

interface DropdownOption {
  id: string;
  name: string;
}

interface SupervisorOption {
  userId: string;
  fullName: string;
  email: string;
}

interface MemberDetailModalProps {
  member: MemberWithRole;
  allMembers: MemberWithRole[];
  onClose: () => void;
  onUpdated: () => void;
  onToggleActive: (member: MemberWithRole) => void;
  onDelete: (member: MemberWithRole) => void;
  onResendInvite: (member: MemberWithRole) => void;
  resendingId: string | null;
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

function ReadonlyField({ label, value, icon }: { label: string; value: string | null | undefined; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
        {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
        <span className="text-sm text-slate-800 truncate">{value || <span className="text-slate-400 italic">Not set</span>}</span>
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  active: { label: 'Active', classes: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" /> },
  inactive: { label: 'Inactive', classes: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
  invited: { label: 'Invited', classes: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Mail className="w-3 h-3" /> },
  expired: { label: 'Expired', classes: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertCircle className="w-3 h-3" /> },
};

export default function MemberDetailModal({
  member,
  allMembers,
  onClose,
  onUpdated,
  onToggleActive,
  onDelete,
  onResendInvite,
  resendingId,
}: MemberDetailModalProps) {
  const { activeRole } = useAuth();
  const accountId = activeRole?.type === 'account' ? activeRole.accountId : null;

  const isSupervisorRole = member.roleRecord?.role === 'supervisor';
  const [activeTab, setActiveTab] = useState<'details' | 'team'>('details');

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState(member.full_name || '');
  const [designation, setDesignation] = useState((member as any).designation || '');
  const [gender, setGender] = useState((member as any).gender || '');
  const [unitDepartment, setUnitDepartment] = useState((member as any).unit_department || '');
  const [division, setDivision] = useState((member as any).division || '');
  const [supervisorId, setSupervisorId] = useState<string>((member as any).supervisor_id || '');
  const [mobileNumber, setMobileNumber] = useState((member as any).mobile_number || '');

  const [departments, setDepartments] = useState<DropdownOption[]>([]);
  const [divisions, setDivisions] = useState<DropdownOption[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);

  const isExpired = member.accountStatus === 'expired';
  const isInvited = member.accountStatus === 'invited';
  const isMember = member.roleRecord?.role === 'member';

  const directReports = allMembers.filter(m => (m as any).supervisor_id === member.id);

  useEffect(() => {
    if (!accountId) return;
    Promise.all([
      supabase.from('departments').select('id, name').eq('account_id', accountId).eq('is_active', true).order('name'),
      supabase.from('divisions').select('id, name').eq('account_id', accountId).eq('is_active', true).order('name'),
    ]).then(([depts, divs]) => {
      setDepartments((depts.data || []).map((d: any) => ({ id: d.id, name: d.name })));
      setDivisions((divs.data || []).map((d: any) => ({ id: d.id, name: d.name })));
    });

    supabase
      .from('user_roles')
      .select('user_id, profile:profiles!user_roles_user_id_fkey(full_name, email, is_active)')
      .eq('account_id', accountId)
      .eq('role', 'supervisor')
      .then(({ data }) => {
        const active = (data || [])
          .filter((r: any) => r.profile?.is_active !== false && r.user_id !== member.id)
          .map((r: any) => ({
            userId: r.user_id,
            fullName: r.profile?.full_name || 'Unknown',
            email: r.profile?.email || '',
          }));
        setSupervisors(active);
      });
  }, [accountId, member.id]);

  const supervisorMember = allMembers.find(m => m.id === (member as any).supervisor_id);
  const supervisorDisplay = supervisorMember?.full_name || member.invitationToken?.supervisor_name || null;

  const handleSave = async () => {
    setError('');
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          designation: designation.trim(),
          gender: gender || null,
          unit_department: unitDepartment.trim(),
          division: division.trim(),
          mobile_number: mobileNumber.trim() || null,
          supervisor_id: isMember && supervisorId ? supervisorId : null,
        })
        .eq('id', member.id);

      if (updateError) throw updateError;
      onUpdated();
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setFullName(member.full_name || '');
    setDesignation((member as any).designation || '');
    setGender((member as any).gender || '');
    setUnitDepartment((member as any).unit_department || '');
    setDivision((member as any).division || '');
    setSupervisorId((member as any).supervisor_id || '');
    setMobileNumber((member as any).mobile_number || '');
    setError('');
    setEditing(false);
  };

  const status = STATUS_CONFIG[member.accountStatus];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" style={{ paddingTop: 30, paddingBottom: 30 }}>
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col" style={{ maxHeight: 'calc(100vh - 60px)' }}>

        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
              <UserCircle2 className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{member.full_name || 'Team Member'}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-sm text-slate-500">{member.email}</span>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${status.classes}`}>
                  {status.icon}
                  {status.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  {ROLE_DISPLAY_NAMES[member.roleRecord?.role ?? member.role] ?? member.roleRecord?.role}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0 mt-0.5">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs — only shown for supervisors */}
        {isSupervisorRole && (
          <div className="flex border-b border-slate-200 flex-shrink-0 px-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-1.5 px-1 py-3 mr-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <User className="w-4 h-4" />
              Details
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-1.5 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'team'
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="w-4 h-4" />
              Team Members
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'team' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {directReports.length}
              </span>
            </button>
          </div>
        )}

        {/* Tab: Team Members */}
        {activeTab === 'team' && isSupervisorRole ? (
          <div className="flex-1 overflow-y-auto min-h-0 p-6">
            {directReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <UserCheck className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">No members assigned</p>
                <p className="text-xs text-slate-400 mt-1">No team members are currently reporting to this supervisor.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {directReports.map(m => {
                  const mStatus = STATUS_CONFIG[m.accountStatus];
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <UserCircle2 className="w-4.5 h-4.5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{m.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-500 truncate">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(m as any).designation && (
                          <span className="hidden sm:block text-xs text-slate-500 truncate max-w-[120px]">{(m as any).designation}</span>
                        )}
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${mStatus.classes}`}>
                          {mStatus.icon}
                          {mStatus.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Scrollable body — Details tab */}
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              {/* Locked fields — always readonly */}
              <div className="grid grid-cols-2 gap-4">
                <ReadonlyField
                  label="Employee ID"
                  value={(member as any).employee_id}
                  icon={<Hash className="w-4 h-4" />}
                />
                <ReadonlyField
                  label="Email Address"
                  value={member.email}
                  icon={<Mail className="w-4 h-4" />}
                />
              </div>

              {/* Editable fields */}
              {editing ? (
                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                        placeholder="Full name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Designation */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Designation</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={designation}
                          onChange={e => setDesignation(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                          placeholder="e.g. Senior Analyst"
                        />
                      </div>
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Gender</label>
                      <div className="relative">
                        <UserCircle2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <select
                          value={gender}
                          onChange={e => setGender(e.target.value)}
                          className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                        >
                          <option value="">Select gender...</option>
                          {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Department */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
                      <div className="relative">
                        <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        {departments.length > 0 ? (
                          <>
                            <select
                              value={unitDepartment}
                              onChange={e => setUnitDepartment(e.target.value)}
                              className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                            >
                              <option value="">Select department...</option>
                              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                          </>
                        ) : (
                          <input
                            type="text"
                            value={unitDepartment}
                            onChange={e => setUnitDepartment(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                            placeholder="e.g. Finance"
                          />
                        )}
                      </div>
                    </div>

                    {/* Division */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Division</label>
                      <div className="relative">
                        <LayoutGrid className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        {divisions.length > 0 ? (
                          <>
                            <select
                              value={division}
                              onChange={e => setDivision(e.target.value)}
                              className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                            >
                              <option value="">Select division...</option>
                              {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                          </>
                        ) : (
                          <input
                            type="text"
                            value={division}
                            onChange={e => setDivision(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                            placeholder="e.g. Operations"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Supervisor — only for members */}
                  {isMember && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Supervisor</label>
                      {supervisors.length === 0 ? (
                        <div className="py-2.5 px-4 border border-amber-200 rounded-lg text-sm text-amber-700 bg-amber-50">
                          No active supervisors found.
                        </div>
                      ) : (
                        <div className="relative">
                          <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <select
                            value={supervisorId}
                            onChange={e => setSupervisorId(e.target.value)}
                            className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                          >
                            <option value="">No supervisor...</option>
                            {supervisors.map(s => (
                              <option key={s.userId} value={s.userId}>{s.fullName} — {s.email}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Mobile Number</label>
                    <PhoneInput
                      value={mobileNumber}
                      onChange={setMobileNumber}
                      placeholder="1X XXX XXXX"
                    />
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <MessageCircle className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <p className="text-xs text-slate-400">Used for SMS and WhatsApp message communications</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <ReadonlyField label="Full Name" value={member.full_name} icon={<User className="w-4 h-4" />} />
                  <div className="grid grid-cols-2 gap-4">
                    <ReadonlyField label="Designation" value={(member as any).designation} icon={<Briefcase className="w-4 h-4" />} />
                    <ReadonlyField
                      label="Gender"
                      value={(member as any).gender ? GENDER_LABELS[(member as any).gender] || (member as any).gender : null}
                      icon={<UserCircle2 className="w-4 h-4" />}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <ReadonlyField label="Department" value={(member as any).unit_department} icon={<Building className="w-4 h-4" />} />
                    <ReadonlyField label="Division" value={(member as any).division} icon={<LayoutGrid className="w-4 h-4" />} />
                  </div>
                  {isMember && (
                    <ReadonlyField label="Supervisor" value={supervisorDisplay} icon={<Users className="w-4 h-4" />} />
                  )}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Mobile Number</p>
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-800 flex-1">{(member as any).mobile_number || <span className="text-slate-400 italic">Not set</span>}</span>
                      {(member as any).mobile_number && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MessageCircle className="w-3 h-3" />
                          SMS / WhatsApp
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Last Login</p>
                  <p className="text-sm text-slate-700">
                    {member.last_login_at
                      ? new Date(member.last_login_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : <span className="text-slate-400 italic">Never logged in</span>
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Member Since</p>
                  <p className="text-sm text-slate-700">
                    {new Date(member.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                {(isInvited || isExpired) && member.invitationToken && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      {isInvited ? 'Invitation Expires' : 'Invitation Expired'}
                    </p>
                    <p className={`text-sm flex items-center gap-1.5 ${isExpired ? 'text-amber-600' : 'text-slate-700'}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(member.invitationToken.expires_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {isInvited && (() => {
                        const diffMs = new Date(member.invitationToken!.expires_at).getTime() - Date.now();
                        if (diffMs <= 0) return null;
                        const totalMins = Math.floor(diffMs / 60000);
                        const hrs = Math.floor(totalMins / 60);
                        const mins = totalMins % 60;
                        const label = hrs === 0 ? `${mins}m left` : mins === 0 ? `${hrs}h left` : `${hrs}h ${mins}m left`;
                        return <span className="text-xs text-slate-400">({label})</span>;
                      })()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50 rounded-b-xl flex-shrink-0 gap-3">
              {/* Left: destructive / status actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggleActive(member)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    member.is_active
                      ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                      : 'border-green-300 text-green-700 hover:bg-green-50'
                  }`}
                  title={member.is_active ? 'Deactivate user' : 'Activate user'}
                >
                  {member.is_active
                    ? <><ToggleRight className="w-4 h-4 text-green-600" /> Deactivate</>
                    : <><ToggleLeft className="w-4 h-4 text-slate-400" /> Activate</>
                  }
                </button>

                {(isInvited || isExpired) && (
                  <button
                    onClick={() => onResendInvite(member)}
                    disabled={resendingId === member.id}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border disabled:opacity-60 ${
                      isExpired
                        ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                        : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${resendingId === member.id ? 'animate-spin' : ''}`} />
                    Resend Invite
                  </button>
                )}

                <button
                  onClick={() => onDelete(member)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>

              {/* Right: edit / save / cancel */}
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-60"
                    >
                      <Ban className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-900 transition-colors disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-900 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
