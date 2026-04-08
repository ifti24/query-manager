import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase, UserProfile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CreateQueryModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateQueryModal({ onClose, onCreated }: CreateQueryModalProps) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [showPriority, setShowPriority] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!profile) return;

      try {
        // Check session
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('Current session:', sessionData.session?.user.id);
        console.log('Current profile:', profile);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'team_member')
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching team members:', error);
          setError(`Failed to load team members: ${error.message}`);
        }

        console.log('Team members data:', data);
        setTeamMembers(data || []);
      } catch (err) {
        console.error('Error fetching team members:', err);
      }
    };

    fetchTeamMembers();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (selectedMembers.length === 0) {
      setError('Please select at least one team member');
      setLoading(false);
      return;
    }

    try {
      if (!user) throw new Error('User not found');

      const { data: query, error: queryError } = await supabase
        .from('queries')
        .insert({
          created_by: user.id,
          title,
          description,
          priority,
          show_priority: showPriority,
          status: 'pending',
        })
        .select()
        .single();

      if (queryError) throw queryError;

      const assignments = selectedMembers.map((memberId) => ({
        query_id: query.id,
        assigned_to: memberId,
      }));

      const { error: assignError } = await supabase
        .from('query_assignments')
        .insert(assignments);

      if (assignError) throw assignError;

      if (sendEmail && selectedMembers.length > 0) {
        const selectedMemberProfiles = teamMembers.filter(m => selectedMembers.includes(m.id));
        const emailResults: string[] = [];

        for (const member of selectedMemberProfiles) {
          try {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;

            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: member.email,
                subject: `New Query Assigned: ${title}`,
                html: `
                  <h2>You have been assigned a new query</h2>
                  <p><strong>Title:</strong> ${title}</p>
                  <p><strong>Description:</strong> ${description || 'No description provided'}</p>
                  <p><strong>Priority:</strong> ${priority}</p>
                  <p><strong>Status:</strong> Pending</p>
                  <p>Please log in to the system to view and respond to this query.</p>
                `
              })
            });

            const result = await response.json();

            if (response.ok) {
              emailResults.push(`✓ Email sent successfully to: ${member.email}`);
            } else {
              const errorMsg = result.error || result.details || JSON.stringify(result);
              emailResults.push(`✗ Failed to send email to ${member.email}: ${errorMsg}`);
            }
          } catch (emailError) {
            console.error(`Failed to send email to ${member.email}:`, emailError);
            emailResults.push(`✗ Failed to send email to ${member.email}: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`);
          }
        }

        if (emailResults.length > 0) {
          alert('Email Status:\n\n' + emailResults.join('\n'));
        }
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Create New Query</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-medium mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              placeholder="Enter query title"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              placeholder="Enter query description"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-medium mb-2">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPriority}
                  onChange={(e) => setShowPriority(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-slate-700">Show priority to team</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-3">Assign to Members</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-300 rounded-lg p-3">
              {teamMembers.length === 0 ? (
                <p className="text-slate-500 text-sm py-2">No team members available</p>
              ) : (
                teamMembers.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-slate-700">
                      {member.full_name} ({member.email})
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-slate-700">Send email notification immediately</span>
          </label>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:bg-slate-400"
            >
              {loading ? 'Creating...' : 'Create Query'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
