import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { User, Mail, Briefcase, Building, LayoutGrid, Hash, Phone, X, MessageCircle, BadgeCheck } from 'lucide-react';

interface SupervisorProfile {
  id: string;
  full_name: string | null;
  email: string;
  designation: string | null;
  unit_department: string | null;
  division: string | null;
  employee_id: string | null;
  mobile_number: string | null;
  gender: string | null;
}

function SupervisorDetailModal({ supervisor, isDirectSupervisor, onClose }: {
  supervisor: SupervisorProfile;
  isDirectSupervisor: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-md shadow-2xl border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">{supervisor.full_name || 'N/A'}</h2>
                {isDirectSupervisor && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-white">
                    Your Supervisor
                  </span>
                )}
              </div>
              {supervisor.designation && (
                <p className="text-sm text-slate-500 mt-0.5">{supervisor.designation}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <DetailRow icon={<Mail className="w-4 h-4 text-slate-400" />} label="Email" value={supervisor.email} />

          <DetailRow
            icon={<BadgeCheck className="w-4 h-4 text-slate-400" />}
            label="Designation"
            value={supervisor.designation || ''}
            empty={!supervisor.designation}
          />

          <DetailRow
            icon={<Building className="w-4 h-4 text-slate-400" />}
            label="Department"
            value={supervisor.unit_department || ''}
            empty={!supervisor.unit_department}
          />

          <DetailRow
            icon={<LayoutGrid className="w-4 h-4 text-slate-400" />}
            label="Division"
            value={supervisor.division || ''}
            empty={!supervisor.division}
          />

          {supervisor.mobile_number && (
            <div>
              <DetailRow icon={<Phone className="w-4 h-4 text-slate-400" />} label="Mobile" value={supervisor.mobile_number} />
              <div className="flex items-center gap-1.5 mt-1 ml-6">
                <MessageCircle className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-400">SMS & WhatsApp</span>
              </div>
            </div>
          )}

          {supervisor.employee_id && (
            <DetailRow icon={<Hash className="w-4 h-4 text-slate-400" />} label="Employee ID" value={supervisor.employee_id} />
          )}

          {supervisor.gender && (
            <DetailRow
              icon={<User className="w-4 h-4 text-slate-400" />}
              label="Gender"
              value={{ male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say' }[supervisor.gender] || supervisor.gender}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, empty }: { icon: React.ReactNode; label: string; value: string; empty?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        {empty
          ? <p className="text-sm text-slate-400 italic">Not set</p>
          : <p className="text-sm text-slate-700 truncate">{value}</p>
        }
      </div>
    </div>
  );
}

export default function MySupervisorsTab() {
  const { profile, activeRole } = useAuth();
  const [supervisors, setSupervisors] = useState<SupervisorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupervisorProfile | null>(null);
  const [directSupervisorId, setDirectSupervisorId] = useState<string | null>(null);

  const accountId = activeRole?.type === 'account' ? activeRole.accountId : null;

  useEffect(() => {
    const fetchSupervisors = async () => {
      if (!profile?.id) return;
      setLoading(true);
      try {
        const resolvedAccountId = accountId || (() => {
          return null;
        })();

        if (!resolvedAccountId) {
          const { data: myProfileData } = await supabase
            .from('profiles')
            .select('supervisor_id, account_id')
            .eq('id', profile.id)
            .maybeSingle();
          if (!myProfileData?.account_id) {
            setSupervisors([]);
            return;
          }
        }

        const effectiveAccountId = resolvedAccountId || (await (async () => {
          const { data } = await supabase
            .from('profiles')
            .select('account_id')
            .eq('id', profile.id)
            .maybeSingle();
          return data?.account_id;
        })());

        if (!effectiveAccountId) {
          setSupervisors([]);
          return;
        }

        const [profileResult, supervisorRolesResult] = await Promise.all([
          supabase.from('profiles').select('supervisor_id').eq('id', profile.id).maybeSingle(),
          supabase
            .from('user_roles')
            .select('user_id, profile:profiles!user_roles_user_id_fkey(id, full_name, email, designation, unit_department, division, employee_id, mobile_number, gender)')
            .eq('account_id', effectiveAccountId)
            .in('role', ['supervisor', 'account_owner']),
        ]);

        const supervisorId = profileResult.data?.supervisor_id;
        setDirectSupervisorId(supervisorId || null);

        const allSupervisors: SupervisorProfile[] = (supervisorRolesResult.data || [])
          .map((r: any) => r.profile)
          .filter(Boolean);

        const unique = Array.from(new Map(allSupervisors.map(s => [s.id, s])).values());

        if (supervisorId) {
          const direct = unique.find(s => s.id === supervisorId);
          const others = unique.filter(s => s.id !== supervisorId);
          setSupervisors(direct ? [direct, ...others] : unique);
        } else {
          setSupervisors(unique);
        }
      } catch (err) {
        console.error('Error fetching supervisors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSupervisors();
  }, [profile?.id, accountId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading supervisors...</p>
        </div>
      </div>
    );
  }

  if (supervisors.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">No supervisors found</p>
          <p className="text-slate-400 text-sm mt-1">No supervisors are assigned to your account yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">My Supervisors</h2>
          <p className="text-sm text-slate-500 mt-0.5">{supervisors.length} supervisor{supervisors.length !== 1 ? 's' : ''} in your organisation</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {supervisors.map((sv) => {
          const isDirectReport = sv.id === directSupervisorId;

          return (
            <button
              key={sv.id}
              onClick={() => setSelected(sv)}
              className={`bg-white rounded-xl border p-5 transition-all text-left hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 w-full ${
                isDirectReport ? 'border-slate-400 ring-1 ring-slate-300' : 'border-slate-200'
              }`}
            >
              {isDirectReport && (
                <div className="mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-white">
                    Your Direct Supervisor
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{sv.full_name || 'N/A'}</p>
                  {sv.designation && (
                    <p className="text-sm text-slate-500 truncate">{sv.designation}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">{sv.email}</span>
                </div>

                {sv.mobile_number && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{sv.mobile_number}</span>
                  </div>
                )}

                {sv.unit_department && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Building className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{sv.unit_department}</span>
                  </div>
                )}

                {sv.division && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <LayoutGrid className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{sv.division}</span>
                  </div>
                )}

                {!sv.mobile_number && !sv.unit_department && !sv.division && (
                  <p className="text-xs text-slate-400 mt-1">Click to view full details</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <SupervisorDetailModal
          supervisor={selected}
          isDirectSupervisor={selected.id === directSupervisorId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
