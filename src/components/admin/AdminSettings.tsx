import { useEffect, useState } from 'react';
import { supabase, AdminSettings } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Send, Clock, Users, FileText, ChevronDown, ChevronUp, Mail, File, Archive, Shield, Lock } from 'lucide-react';

interface DigestSummary {
  last_sent_at: string | null;
  total_recipients: number;
  total_queries: number;
  triggered_by: string;
}

export default function AdminSettingsComponent() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestSummary, setDigestSummary] = useState<DigestSummary | null>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    email: false,
    file: false,
    archive: false,
    session: false,
    password: false,
  });

  const [originalData, setOriginalData] = useState({
    email_schedule_time: '08:00',
    email_schedule_enabled: true,
    email_send_on_create: true,
    max_file_size_mb: 5,
    allowed_file_types: 'pdf,jpg,png,mail',
    blacklisted_file_types: '',
    auto_archive_days: 30,
    session_idle_timeout_minutes: 5,
    session_warning_seconds: 60,
    password_reset_link_validity_hours: 24,
    password_min_length: 8,
    password_max_length: 128,
    password_require_uppercase: true,
    password_min_uppercase: 1,
    password_require_lowercase: true,
    password_min_lowercase: 1,
    password_require_numbers: true,
    password_min_numbers: 1,
    password_require_special: true,
    password_min_special: 1,
    password_allowed_special_chars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    password_policy_applies_to: ['admin', 'team_member'] as string[],
  });

  const [formData, setFormData] = useState({
    email_schedule_time: '08:00',
    email_schedule_enabled: true,
    email_send_on_create: true,
    max_file_size_mb: 5,
    allowed_file_types: 'pdf,jpg,png,mail',
    blacklisted_file_types: '',
    auto_archive_days: 30,
    session_idle_timeout_minutes: 5,
    session_warning_seconds: 60,
    password_reset_link_validity_hours: 24,
    password_min_length: 8,
    password_max_length: 128,
    password_require_uppercase: true,
    password_min_uppercase: 1,
    password_require_lowercase: true,
    password_min_lowercase: 1,
    password_require_numbers: true,
    password_min_numbers: 1,
    password_require_special: true,
    password_min_special: 1,
    password_allowed_special_chars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    password_policy_applies_to: ['admin', 'team_member'] as string[],
  });

  const fetchDigestSummary = async () => {
    try {
      const { data } = await supabase
        .from('email_logs')
        .select('sent_at, total_queries_count, triggered_by, digest_batch_id')
        .eq('email_type', 'digest')
        .order('sent_at', { ascending: false })
        .limit(100);

      if (data && data.length > 0) {
        const lastBatch = data.filter(log => log.digest_batch_id === data[0].digest_batch_id);
        const totalRecipients = lastBatch.length;
        const totalQueries = lastBatch.reduce((sum, log) => sum + (log.total_queries_count || 0), 0);

        setDigestSummary({
          last_sent_at: data[0].sent_at,
          total_recipients: totalRecipients,
          total_queries: totalQueries,
          triggered_by: data[0].triggered_by || 'system',
        });
      }
    } catch (err) {
      console.error('Error fetching digest summary:', err);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;

      try {
        const { data } = await supabase
          .from('admin_settings')
          .select('*')
          .eq('admin_id', user.id)
          .maybeSingle();

        if (data) {
          setSettings(data);
          const loadedData = {
            email_schedule_time: data.email_schedule_time,
            email_schedule_enabled: data.email_schedule_enabled,
            email_send_on_create: data.email_send_on_create,
            max_file_size_mb: data.max_file_size_mb,
            allowed_file_types: data.allowed_file_types.join(','),
            blacklisted_file_types: data.blacklisted_file_types.join(','),
            auto_archive_days: data.auto_archive_days || 30,
            session_idle_timeout_minutes: data.session_idle_timeout_minutes || 5,
            session_warning_seconds: data.session_warning_seconds || 60,
            password_reset_link_validity_hours: data.password_reset_link_validity_hours || 24,
            password_min_length: data.password_min_length || 8,
            password_max_length: data.password_max_length || 128,
            password_require_uppercase: data.password_require_uppercase ?? true,
            password_min_uppercase: data.password_min_uppercase || 1,
            password_require_lowercase: data.password_require_lowercase ?? true,
            password_min_lowercase: data.password_min_lowercase || 1,
            password_require_numbers: data.password_require_numbers ?? true,
            password_min_numbers: data.password_min_numbers || 1,
            password_require_special: data.password_require_special ?? true,
            password_min_special: data.password_min_special || 1,
            password_allowed_special_chars: data.password_allowed_special_chars || '!@#$%^&*()_+-=[]{}|;:,.<>?',
            password_policy_applies_to: Array.isArray(data.password_policy_applies_to)
              ? data.password_policy_applies_to
              : ['admin', 'team_member'],
          };
          setFormData(loadedData);
          setOriginalData(loadedData);
        } else {
          await supabase.from('admin_settings').insert({
            admin_id: user.id,
          });
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
    fetchDigestSummary();
  }, [user]);

  const handleSendDigestNow = async () => {
    setSendingDigest(true);
    setError('');
    setSuccess('');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-daily-reminders`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          triggered_by: 'admin',
        }),
      });

      const data = await response.json();

      console.log('Edge function response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send digest emails');
      }

      setSuccess(`Digest emails sent successfully! ${data.emailsSent} emails sent to team members.`);
      fetchDigestSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send digest emails');
    } finally {
      setSendingDigest(false);
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updateData: any = {};

      if (formData.email_schedule_time !== originalData.email_schedule_time) {
        updateData.email_schedule_time = formData.email_schedule_time;
      }
      if (formData.email_schedule_enabled !== originalData.email_schedule_enabled) {
        updateData.email_schedule_enabled = formData.email_schedule_enabled;
      }
      if (formData.email_send_on_create !== originalData.email_send_on_create) {
        updateData.email_send_on_create = formData.email_send_on_create;
      }
      if (formData.max_file_size_mb !== originalData.max_file_size_mb) {
        updateData.max_file_size_mb = formData.max_file_size_mb;
      }
      if (formData.allowed_file_types !== originalData.allowed_file_types) {
        updateData.allowed_file_types = formData.allowed_file_types
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }
      if (formData.blacklisted_file_types !== originalData.blacklisted_file_types) {
        updateData.blacklisted_file_types = formData.blacklisted_file_types
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }
      if (formData.auto_archive_days !== originalData.auto_archive_days) {
        updateData.auto_archive_days = formData.auto_archive_days > 0 ? formData.auto_archive_days : null;
      }
      if (formData.session_idle_timeout_minutes !== originalData.session_idle_timeout_minutes) {
        updateData.session_idle_timeout_minutes = formData.session_idle_timeout_minutes;
      }
      if (formData.session_warning_seconds !== originalData.session_warning_seconds) {
        updateData.session_warning_seconds = formData.session_warning_seconds;
      }
      if (formData.password_reset_link_validity_hours !== originalData.password_reset_link_validity_hours) {
        updateData.password_reset_link_validity_hours = formData.password_reset_link_validity_hours;
      }
      if (formData.password_min_length !== originalData.password_min_length) {
        updateData.password_min_length = formData.password_min_length;
      }
      if (formData.password_max_length !== originalData.password_max_length) {
        updateData.password_max_length = formData.password_max_length;
      }
      if (formData.password_require_uppercase !== originalData.password_require_uppercase) {
        updateData.password_require_uppercase = formData.password_require_uppercase;
      }
      if (formData.password_min_uppercase !== originalData.password_min_uppercase) {
        updateData.password_min_uppercase = formData.password_min_uppercase;
      }
      if (formData.password_require_lowercase !== originalData.password_require_lowercase) {
        updateData.password_require_lowercase = formData.password_require_lowercase;
      }
      if (formData.password_min_lowercase !== originalData.password_min_lowercase) {
        updateData.password_min_lowercase = formData.password_min_lowercase;
      }
      if (formData.password_require_numbers !== originalData.password_require_numbers) {
        updateData.password_require_numbers = formData.password_require_numbers;
      }
      if (formData.password_min_numbers !== originalData.password_min_numbers) {
        updateData.password_min_numbers = formData.password_min_numbers;
      }
      if (formData.password_require_special !== originalData.password_require_special) {
        updateData.password_require_special = formData.password_require_special;
      }
      if (formData.password_min_special !== originalData.password_min_special) {
        updateData.password_min_special = formData.password_min_special;
      }
      if (formData.password_allowed_special_chars !== originalData.password_allowed_special_chars) {
        updateData.password_allowed_special_chars = formData.password_allowed_special_chars;
      }
      if (JSON.stringify(formData.password_policy_applies_to.sort()) !== JSON.stringify(originalData.password_policy_applies_to.sort())) {
        updateData.password_policy_applies_to = formData.password_policy_applies_to;
      }

      if (Object.keys(updateData).length === 0) {
        setSuccess('No changes to save');
        setSaving(false);
        return;
      }

      await supabase
        .from('admin_settings')
        .update(updateData)
        .eq('admin_id', user.id);

      setOriginalData(formData);
      setSuccess('Settings saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('email')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Email Settings</h2>
          </div>
          {openSections.email ? (
            <ChevronUp className="w-5 h-5 text-slate-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {openSections.email && (
          <div className="px-6 pb-6 space-y-6 border-t border-slate-200">
            <div className="pt-6">
              <label className="block text-slate-700 font-medium mb-2">
                Daily Email Schedule Time
              </label>
              <input
                type="time"
                value={formData.email_schedule_time}
                onChange={(e) =>
                  setFormData({ ...formData, email_schedule_time: e.target.value })
                }
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">
                Time to send daily summary emails to team members
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.email_schedule_enabled}
                onChange={(e) =>
                  setFormData({ ...formData, email_schedule_enabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-slate-700 font-medium">
                Enable daily email digest
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.email_send_on_create}
                onChange={(e) =>
                  setFormData({ ...formData, email_send_on_create: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-slate-700 font-medium">
                Send email immediately when query is created
              </span>
            </label>

            <div className="border-t border-slate-200 pt-6 mt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Send Digest Email Now</h3>

              {digestSummary ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-slate-600" />
                      <span className="text-sm text-slate-600">Last Sent</span>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">
                      {new Date(digestSummary.last_sent_at!).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Triggered by: {digestSummary.triggered_by}
                    </p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <span className="text-sm text-blue-600">Recipients</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">
                      {digestSummary.total_recipients}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">team members notified</p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-600">Total Queries</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">
                      {digestSummary.total_queries}
                    </p>
                    <p className="text-xs text-green-600 mt-1">pending queries</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                  <p className="text-slate-600 text-center">No digest emails have been sent yet</p>
                </div>
              )}

              <button
                onClick={handleSendDigestNow}
                disabled={sendingDigest}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400"
              >
                <Send className="w-5 h-5" />
                {sendingDigest ? 'Sending...' : 'Send Digest Email Now'}
              </button>
              <p className="text-slate-600 text-sm mt-2">
                This will immediately send digest emails to all team members with pending queries
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('file')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <File className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">File Settings</h2>
          </div>
          {openSections.file ? (
            <ChevronUp className="w-5 h-5 text-slate-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {openSections.file && (
          <div className="px-6 pb-6 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Maximum File Size (MB)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.max_file_size_mb}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_file_size_mb: parseInt(e.target.value) || 5,
                  })
                }
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Allowed File Types (comma-separated)
              </label>
              <input
                type="text"
                value={formData.allowed_file_types}
                onChange={(e) =>
                  setFormData({ ...formData, allowed_file_types: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                placeholder="pdf,jpg,png,mail"
              />
              <p className="text-slate-600 text-sm mt-1">
                Example: pdf,jpg,png,mail
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Blacklisted File Types (comma-separated)
              </label>
              <input
                type="text"
                value={formData.blacklisted_file_types}
                onChange={(e) =>
                  setFormData({ ...formData, blacklisted_file_types: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                placeholder="exe,bat,cmd"
              />
              <p className="text-slate-600 text-sm mt-1">
                Leave empty to allow all configured types
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('archive')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Archive className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Query Archive Settings</h2>
          </div>
          {openSections.archive ? (
            <ChevronUp className="w-5 h-5 text-slate-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {openSections.archive && (
          <div className="px-6 pb-6 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Auto-Archive After (Days)
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={formData.auto_archive_days}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    auto_archive_days: parseInt(e.target.value) || 0,
                  })
                }
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">
                Automatically archive queries marked as "Done" after this many days. Set to 0 to disable auto-archiving.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('session')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Session & Security Settings</h2>
          </div>
          {openSections.session ? (
            <ChevronUp className="w-5 h-5 text-slate-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {openSections.session && (
          <div className="px-6 pb-6 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Session Idle Timeout (Minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={formData.session_idle_timeout_minutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    session_idle_timeout_minutes: parseInt(e.target.value) || 5,
                  })
                }
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">
                Users will be automatically logged out after this period of inactivity
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Session Warning Time (Seconds)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={formData.session_warning_seconds}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    session_warning_seconds: parseInt(e.target.value) || 60,
                  })
                }
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">
                Show warning dialog this many seconds before session expires
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Password Reset Link Validity (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="72"
                value={formData.password_reset_link_validity_hours}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    password_reset_link_validity_hours: parseInt(e.target.value) || 24,
                  })
                }
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">
                Password reset links will expire after this many hours
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('password')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Password Policy Settings</h2>
          </div>
          {openSections.password ? (
            <ChevronUp className="w-5 h-5 text-slate-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {openSections.password && (
          <div className="px-6 pb-6 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Apply Password Policy To
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-3 p-3 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.password_policy_applies_to.includes('admin')}
                    onChange={(e) => {
                      const newRoles = e.target.checked
                        ? [...formData.password_policy_applies_to, 'admin']
                        : formData.password_policy_applies_to.filter(r => r !== 'admin');
                      setFormData({
                        ...formData,
                        password_policy_applies_to: newRoles,
                      });
                    }}
                    className="w-4 h-4 text-slate-600 rounded focus:ring-2 focus:ring-slate-500"
                  />
                  <span className="text-slate-700">Admin</span>
                </label>
                <label className="flex items-center space-x-3 p-3 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.password_policy_applies_to.includes('team_member')}
                    onChange={(e) => {
                      const newRoles = e.target.checked
                        ? [...formData.password_policy_applies_to, 'team_member']
                        : formData.password_policy_applies_to.filter(r => r !== 'team_member');
                      setFormData({
                        ...formData,
                        password_policy_applies_to: newRoles,
                      });
                    }}
                    className="w-4 h-4 text-slate-600 rounded focus:ring-2 focus:ring-slate-500"
                  />
                  <span className="text-slate-700">Team Member</span>
                </label>
              </div>
              <p className="text-slate-600 text-sm mt-2">
                Select which user roles this password policy applies to. You can select one or both roles.
              </p>
              {formData.password_policy_applies_to.length === 0 && (
                <p className="text-red-600 text-sm mt-1">
                  Please select at least one role
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-slate-700 font-medium mb-2">
                  Minimum Length
                </label>
                <input
                  type="number"
                  min="4"
                  max="128"
                  value={formData.password_min_length}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password_min_length: parseInt(e.target.value) || 8,
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-2">
                  Maximum Length
                </label>
                <input
                  type="number"
                  min="8"
                  max="256"
                  value={formData.password_max_length}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password_max_length: parseInt(e.target.value) || 128,
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.password_require_uppercase}
                    onChange={(e) =>
                      setFormData({ ...formData, password_require_uppercase: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-slate-700 font-medium">Require Uppercase Letters</span>
                </label>
                {formData.password_require_uppercase && (
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.password_min_uppercase}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        password_min_uppercase: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600"
                    placeholder="Min"
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.password_require_lowercase}
                    onChange={(e) =>
                      setFormData({ ...formData, password_require_lowercase: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-slate-700 font-medium">Require Lowercase Letters</span>
                </label>
                {formData.password_require_lowercase && (
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.password_min_lowercase}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        password_min_lowercase: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600"
                    placeholder="Min"
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.password_require_numbers}
                    onChange={(e) =>
                      setFormData({ ...formData, password_require_numbers: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-slate-700 font-medium">Require Numbers</span>
                </label>
                {formData.password_require_numbers && (
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.password_min_numbers}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        password_min_numbers: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600"
                    placeholder="Min"
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.password_require_special}
                    onChange={(e) =>
                      setFormData({ ...formData, password_require_special: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-slate-700 font-medium">Require Special Characters</span>
                </label>
                {formData.password_require_special && (
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.password_min_special}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        password_min_special: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600"
                    placeholder="Min"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-2">
                Allowed Special Characters
              </label>
              <input
                type="text"
                value={formData.password_allowed_special_chars}
                onChange={(e) =>
                  setFormData({ ...formData, password_allowed_special_chars: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 font-mono"
                placeholder="!@#$%^&*()_+-=[]{}|;:,.<>?"
              />
              <p className="text-slate-600 text-sm mt-1">
                Define which special characters are allowed in passwords
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:bg-slate-400"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
