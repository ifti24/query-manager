import { useEffect, useState } from 'react';
import { User, Mail, Hash, ChevronDown, CircleUser as UserCircle2, Save, AlertTriangle, CheckCircle, Briefcase, Building, LayoutGrid, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PhoneInput from '../common/PhoneInput';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

interface DropdownOption {
  id: string;
  name: string;
}

interface ProfileForm {
  full_name: string;
  employee_id: string;
  gender: string;
  designation: string;
  unit_department: string;
  division: string;
  mobile_number: string;
}

export default function ProfileSettings() {
  const { user, profile, activeRole } = useAuth();
  const accountId = activeRole?.type === 'account' ? activeRole.accountId : null;

  const [form, setForm] = useState<ProfileForm>({
    full_name: '',
    employee_id: '',
    gender: '',
    designation: '',
    unit_department: '',
    division: '',
    mobile_number: '',
  });
  const [original, setOriginal] = useState<ProfileForm | null>(null);
  const [departments, setDepartments] = useState<DropdownOption[]>([]);
  const [divisions, setDivisions] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isSysEmployeeId = (id: string) => id.startsWith('sys:');

  useEffect(() => {
    if (user && accountId) {
      loadProfile();
      loadOrgData();
    } else if (user) {
      loadProfile();
    }
  }, [user, accountId]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, employee_id, gender, designation, unit_department, division, mobile_number')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        const loaded: ProfileForm = {
          full_name: data.full_name || '',
          employee_id: isSysEmployeeId(data.employee_id || '') ? '' : (data.employee_id || ''),
          gender: data.gender || '',
          designation: data.designation || '',
          unit_department: data.unit_department || '',
          division: data.division || '',
          mobile_number: data.mobile_number || '',
        };
        setForm(loaded);
        setOriginal(loaded);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgData = async () => {
    if (!accountId) return;
    const [depts, divs] = await Promise.all([
      supabase.from('departments').select('id, name').eq('account_id', accountId).eq('is_active', true).order('name'),
      supabase.from('divisions').select('id, name').eq('account_id', accountId).eq('is_active', true).order('name'),
    ]);
    setDepartments((depts.data || []).map((d: any) => ({ id: d.id, name: d.name })));
    setDivisions((divs.data || []).map((d: any) => ({ id: d.id, name: d.name })));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.employee_id.trim()) {
      setError('Employee ID is required. Please set a real Employee ID for your profile.');
      return;
    }
    if (isSysEmployeeId(form.employee_id.trim())) {
      setError('Employee ID cannot start with "sys:". Please enter a valid ID.');
      return;
    }

    setSaving(true);
    try {
      const updates: any = {};
      if (form.full_name !== original?.full_name) updates.full_name = form.full_name;
      if (form.employee_id !== original?.employee_id) updates.employee_id = form.employee_id.trim();
      if (form.gender !== original?.gender) updates.gender = form.gender;
      if (form.designation !== original?.designation) updates.designation = form.designation;
      if (form.unit_department !== original?.unit_department) updates.unit_department = form.unit_department;
      if (form.division !== original?.division) updates.division = form.division;
      if (form.mobile_number !== original?.mobile_number) updates.mobile_number = form.mobile_number.trim() || null;

      if (Object.keys(updates).length === 0) {
        setSuccess('No changes to save.');
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user!.id);

      if (updateError) {
        if (updateError.message.includes('unique') || updateError.message.includes('duplicate')) {
          throw new Error('This Employee ID is already in use within your account. Please choose a different one.');
        }
        throw updateError;
      }

      setOriginal({ ...form, employee_id: form.employee_id.trim() });
      setSuccess('Profile updated successfully.');
    } catch (e: any) {
      setError(e.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const rawEmployeeId = profile ? (profile as any).employee_id || '' : '';
  const hasSysId = isSysEmployeeId(rawEmployeeId);

  if (loading) {
    return <div className="text-center py-16 text-slate-400 text-sm">Loading profile...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Forced employee ID banner */}
      {hasSysId && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Action Required: Set Your Employee ID</p>
            <p className="text-sm text-amber-700 mt-0.5">
              A system-generated placeholder ID was assigned to your account. Please replace it with your real Employee ID before saving.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-700">{success}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Photo section — coming soon */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-5 bg-slate-50">
          <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 border-2 border-slate-300">
            <UserCircle2 className="w-11 h-11 text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{profile?.full_name || 'Your Name'}</p>
            <p className="text-sm text-slate-500 mt-0.5">{profile?.email}</p>
            <span className="inline-block mt-2 text-xs px-2.5 py-1 bg-slate-200 text-slate-500 rounded-full">
              Photo upload — Coming Soon
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* Row 1: Full Name + Email (read-only) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed here</p>
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
                  type="text"
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-100 ${
                    !form.employee_id.trim()
                      ? 'border-amber-300 focus:border-amber-400 bg-amber-50'
                      : 'border-slate-300 focus:border-slate-600'
                  }`}
                  placeholder="e.g. EMP-0001"
                  required
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Must be unique within your account</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Gender</label>
              <div className="relative">
                <UserCircle2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <select
                  value={form.gender}
                  onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                >
                  <option value="">Select gender...</option>
                  {GENDER_OPTIONS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 3: Designation + Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={form.designation}
                  onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                  placeholder="e.g. Account Manager"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Department</label>
              <div className="relative">
                <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                {departments.length > 0 ? (
                  <>
                    <select
                      value={form.unit_department}
                      onChange={e => setForm(f => ({ ...f, unit_department: e.target.value }))}
                      className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                    >
                      <option value="">Select department...</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </>
                ) : (
                  <input
                    type="text"
                    value={form.unit_department}
                    onChange={e => setForm(f => ({ ...f, unit_department: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                    placeholder="e.g. Finance"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number</label>
            <PhoneInput
              value={form.mobile_number}
              onChange={v => setForm(f => ({ ...f, mobile_number: v }))}
              placeholder="1X XXX XXXX"
            />
            <div className="flex items-center gap-1.5 mt-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <p className="text-xs text-slate-400">Used for SMS and WhatsApp message communications</p>
            </div>
          </div>

          {/* Row 4: Division (full width) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Division</label>
              <div className="relative">
                <LayoutGrid className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                {divisions.length > 0 ? (
                  <>
                    <select
                      value={form.division}
                      onChange={e => setForm(f => ({ ...f, division: e.target.value }))}
                      className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 bg-white appearance-none"
                    >
                      <option value="">Select division...</option>
                      {divisions.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </>
                ) : (
                  <input
                    type="text"
                    value={form.division}
                    onChange={e => setForm(f => ({ ...f, division: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                    placeholder="e.g. Operations"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <p className="text-xs text-slate-400">* Required fields</p>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium text-sm disabled:bg-slate-400"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
