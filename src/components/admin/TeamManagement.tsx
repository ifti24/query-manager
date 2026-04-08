import { useEffect, useState } from 'react';
import { supabase, UserProfile } from '../../lib/supabase';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import InviteTeamMemberModal from './InviteTeamMemberModal';
import { ConfirmationModal, DeleteConfirmationModal } from '../common/ConfirmationModal';

export default function TeamManagement() {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'activate' | 'deactivate' | 'delete';
    member: UserProfile | null;
  }>({ type: 'activate', member: null });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching members:', error);
      }

      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleToggleActive = async () => {
    if (!confirmAction.member) return;

    setActionLoading(true);
    try {
      await supabase
        .from('profiles')
        .update({ is_active: !confirmAction.member.is_active })
        .eq('id', confirmAction.member.id);
      fetchMembers();
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
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', confirmAction.member.id);
      fetchMembers();
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
      const { error: authError } = await supabase.auth.admin.deleteUser(
        confirmAction.member.id
      );
      if (authError) throw authError;

      await supabase.from('profiles').delete().eq('id', confirmAction.member.id);
      fetchMembers();
      setConfirmAction({ type: 'delete', member: null });
    } catch (error) {
      console.error('Error hard deleting member:', error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Invite Team Member
        </button>
      </div>

      {showInviteModal && (
        <InviteTeamMemberModal
          onClose={() => setShowInviteModal(false)}
          onCreated={() => {
            setShowInviteModal(false);
            fetchMembers();
          }}
        />
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-900 font-medium">
                    {member.full_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{member.email}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">
                      {member.role === 'admin' ? 'Admin' : 'Team Member'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        member.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    {member.last_login_at
                      ? new Date(member.last_login_at).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          setConfirmAction({
                            type: member.is_active ? 'deactivate' : 'activate',
                            member,
                          })
                        }
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title={member.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {member.is_active ? (
                          <ToggleRight className="w-5 h-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setConfirmAction({ type: 'delete', member })
                        }
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              No team members found
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmationModal
        isOpen={
          confirmAction.member !== null &&
          (confirmAction.type === 'activate' || confirmAction.type === 'deactivate')
        }
        title={
          confirmAction.type === 'activate'
            ? 'Activate User'
            : 'Deactivate User'
        }
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
    </div>
  );
}
