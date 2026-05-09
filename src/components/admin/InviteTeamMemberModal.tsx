import { useState, useEffect } from 'react';
import { X, Mail, User, Briefcase, Building, LayoutGrid, ChevronDown, Users, Upload, Clock, Hash, CircleUser as UserCircle2, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PhoneInput from '../common/PhoneInput';

interface InviteTeamMemberModalProps {
  onClose: () => void;
  onCreated: () => void;
}

type InviteRole = 'supervisor' | 'member';

interface DropdownOption {
  id: string;
  name: string;
}

interface SupervisorOption {
  userId: string;
  fullName: string;
  email: string;
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function InviteTeamMemberModal({ onClose, onCreated }: InviteTeamMemberModalProps) {
  const { activeRole, profile } = useAuth();
  const isIndividualAccount = profile?.account_type === 'individual';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [gender, setGender] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [unitDepartment, setUnitDepartment] = useState('');
  const [division, setDivision] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [supervisorId, setSupervisorId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [departments, setDepartments] = useState<DropdownOption[]>([]);
  const [divisions, setDivisions] = useState<DropdownOption[]>([]);

  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accountId = activeRole?.type === 'account' ? activeRole.accountId : null;

  useEffect(() => {
    if (accountId) {
      fetchOrgData();
    }
  }, [accountId]);

  useEffect(() => {
    if (role === 'member' && accountId && !isIndividualAccount) {
      fetchSupervisors();
    }
  }, [role, accountId, isIndividualAccount]);

  const fetchOrgData = async () => {
    if (!accountId) return;
    const [depts, divs] = await Promise.all([
      supabase.from('departments').select('id, name').eq('account_id', accountId).eq('is_active', true).order('name'),
      supabase.from('divisions').select('id, name').eq('account_id', accountId).eq('is_active', true).order('name'),
    ]);
    setDepartments((depts.data || []).map((d: any) => ({ id: d.id, name: d.name })));
    setDivisions((divs.data || []).map((d: any) => ({ id: d.id, name: d.name })));
  };

  const fetchSupervisors = async () => {
    if (!accountId) return;
    setLoadingSupervisors(true);
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, profile:profiles!user_roles_user_id_fkey(full_name, email, is_active)')
        .eq('account_id', accountId)
        .eq('role', 'supervisor');

      const active = (data || [])
        .filter((r: any) => r.profile?.is_active !== false)
        .map((r: any) => ({
          userId: r.user_id,
          fullName: r.profile?.full_name || 'Unknown',
          email: r.profile?.email || '',
        }));
      setSupervisors(active);
    } catch (e) {
      console.error('Error fetching supervisors:', e);
    } finally {
      setLoadingSupervisors(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!accountId) { setError('No account context found.'); return; }
    if (role === 'member' && !isIndividualAccount && !supervisorId) { setError('Please select a supervisor for this member.'); return; }
    if (!employeeId.trim()) { setError('Employee ID is required.'); return; }
    if (employeeId.trim().toLowerCase().startsWith('sys:')) {
      setError('Employee ID cannot start with "sys:". Please enter a valid ID.');
      return;
    }

    setLoading(true);
    try {
      const selectedSupervisor = supervisors.find(s => s.userId === supervisorId);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-team-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            email,
            fullName,
            designation,
            gender,
            employeeId: employeeId.trim(),
            unitDepartment,
            division,
            role,
            mobileNumber: mobileNumber.trim() || null,
            supervisorId: role === 'member' ? supervisorId : null,
            supervisorName: role === 'member' ? selectedSupervisor?.fullName : null,
            accountId,
            appUrl: window.location.origin,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send invite');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite team member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" style={{ paddingTop: '30px', paddingBottom: '30px' }}>
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col" style={{ maxHeight: 'calc(100vh - 60px)' }}>

        {/* Header — fixed */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Invite Team Member</h2>
            <p className="text-sm text-slate-500 mt-0.5">An invitation email will be sent with an activation link</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-5 overflow-y-auto flex-1" style={{ scrollBehavior: 'smooth' }}>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Photo placeholder — coming soon */}
            <div className="flex items-center gap-4 p-3.5 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
              <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <UserCircle2 className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Profile Photo</p>
                <p className="text-xs text-slate-400 mt-0.5">Photo upload — <span className="font-semibold text-slate-500">Coming Soon</span></p>
              </div>
            </div>

            {/* Row 1: Full Name + Email */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text" value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                    placeholder="John Doe" required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                    placeholder="john@company.com" required
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Employee ID + Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Employee ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text" value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                    placeholder="e.g. EMP-0042" required
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Must be unique within this account</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Gender</label>
                <div className="relative">
                  <UserCircle2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <select
                    value={gender} onChange={e => setGender(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                  >
                    <option value="">Select gender...</option>
                    {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 3: Designation + Role */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text" value={designation}
                    onChange={e => setDesignation(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                    placeholder="e.g. Senior Analyst"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Role <span className="text-red-500">*</span>
                </label>
                {isIndividualAccount ? (
                  <div className="relative">
                    <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <div className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 bg-slate-50 select-none">
                      Member
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <select
                      value={role}
                      onChange={e => { setRole(e.target.value as InviteRole); setSupervisorId(''); }}
                      className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                    >
                      <option value="member">Member</option>
                      <option value="supervisor">Supervisor</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number</label>
              <PhoneInput
                value={mobileNumber}
                onChange={setMobileNumber}
                placeholder="1X XXX XXXX"
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <p className="text-xs text-slate-400">Used for SMS and WhatsApp message communications</p>
              </div>
            </div>

            {/* Row 4: Department + Division */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Department</label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  {departments.length > 0 ? (
                    <>
                      <select
                        value={unitDepartment} onChange={e => setUnitDepartment(e.target.value)}
                        className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                      >
                        <option value="">Select department...</option>
                        {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    </>
                  ) : (
                    <input
                      type="text" value={unitDepartment}
                      onChange={e => setUnitDepartment(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                      placeholder="e.g. Finance"
                    />
                  )}
                </div>
                {departments.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">Add departments in Settings for a dropdown</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Division</label>
                <div className="relative">
                  <LayoutGrid className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  {divisions.length > 0 ? (
                    <>
                      <select
                        value={division} onChange={e => setDivision(e.target.value)}
                        className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                      >
                        <option value="">Select division...</option>
                        {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    </>
                  ) : (
                    <input
                      type="text" value={division}
                      onChange={e => setDivision(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                      placeholder="e.g. Operations"
                    />
                  )}
                </div>
                {divisions.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">Add divisions in Settings for a dropdown</p>
                )}
              </div>
            </div>

            {/* Supervisor assignment — only for members in business accounts */}
            {role === 'member' && !isIndividualAccount && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Assign Supervisor <span className="text-red-500">*</span>
                </label>
                {loadingSupervisors ? (
                  <div className="w-full py-2.5 px-4 border border-slate-200 rounded-lg text-sm text-slate-400 bg-slate-50">Loading supervisors...</div>
                ) : supervisors.length === 0 ? (
                  <div className="w-full py-2.5 px-4 border border-amber-200 rounded-lg text-sm text-amber-700 bg-amber-50">
                    No active supervisors found. Please invite a supervisor first.
                  </div>
                ) : (
                  <div className="relative">
                    <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <select
                      value={supervisorId} onChange={e => setSupervisorId(e.target.value)}
                      className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                      required
                    >
                      <option value="">Select a supervisor...</option>
                      {supervisors.map(s => (
                        <option key={s.userId} value={s.userId}>{s.fullName} — {s.email}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>
            )}

            {/* Invite link expiry notice */}
            <div className="flex items-start gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-500 leading-relaxed">
                An invitation email with a temporary password and activation link will be sent. The link expires as configured in system settings (default: 24 hours).
              </p>
            </div>

            {/* Bulk upload — coming soon */}
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 flex items-center gap-3 opacity-50 cursor-not-allowed select-none">
              <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Bulk Upload via Excel</p>
                <p className="text-xs text-slate-400 mt-0.5">Upload multiple users at once — <span className="font-semibold text-slate-500">Coming Soon</span></p>
              </div>
            </div>
          </div>

          {/* Footer — fixed */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl flex-shrink-0">
            <p className="text-xs text-slate-400">* Required fields</p>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors font-medium">
                Cancel
              </button>
              <button type="submit"
                disabled={loading || (role === 'member' && !isIndividualAccount && supervisors.length === 0)}
                className="px-5 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium disabled:bg-slate-300 disabled:cursor-not-allowed">
                {loading ? 'Sending Invite...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
