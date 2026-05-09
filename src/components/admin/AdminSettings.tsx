import { useEffect, useState } from 'react';
import { supabase, AdminSettings } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, ChevronDown, ChevronUp, File, Archive, Shield, Lock, Building2 } from 'lucide-react';
import { logUnauthorizedAccess, isUnauthorizedError, buildDescription } from '../../lib/securityAudit';
import PlatformSubscriptionSettings from '../admin/platform/PlatformSubscriptionSettings';
import AccountNotificationSettings, { NotificationFormData, DEFAULT_NOTIFICATION_FORM } from './AccountNotificationSettings';
import OrgStructureSettings from './OrgStructureSettings';

const DEFAULT_PLATFORM_FORM = {
  max_file_size_mb: 5,
  allowed_file_types: 'pdf,jpg,png,mail',
  blacklisted_file_types: '',
  auto_archive_days: 30,
  session_idle_timeout_minutes: 5,
  session_warning_seconds: 60,
  password_reset_link_validity_hours: 24,
  invite_link_validity_hours: 24,
  require_email_verification: false,
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
};

interface AdminSettingsProps {
  onShowPricing?: () => void;
}

export default function AdminSettingsComponent({ onShowPricing }: AdminSettingsProps) {
  const { user, activeRole, isPlatformAdmin, isAccountOwner } = useAuth();

  const accountId = activeRole?.type === 'account' ? activeRole.accountId : null;

  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    email: false,
    whatsapp: false,
    org: false,
    file: false,
    archive: false,
    session: false,
    password: false,
  });

  // Platform admin form state
  const [platformForm, setPlatformForm] = useState({ ...DEFAULT_PLATFORM_FORM });
  const [originalPlatformForm, setOriginalPlatformForm] = useState({ ...DEFAULT_PLATFORM_FORM });

  // Account owner notification form state (lifted from AccountNotificationSettings)
  const [notifForm, setNotifForm] = useState<NotificationFormData>({ ...DEFAULT_NOTIFICATION_FORM });
  const [originalNotifForm, setOriginalNotifForm] = useState<NotificationFormData>({ ...DEFAULT_NOTIFICATION_FORM });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        if (isPlatformAdmin) {
          const { data } = await supabase
            .from('admin_settings')
            .select('*')
            .is('account_id', null)
            .maybeSingle();

          if (data) {
            setSettings(data);
            const loaded = {
              max_file_size_mb: data.max_file_size_mb,
              allowed_file_types: data.allowed_file_types.join(','),
              blacklisted_file_types: data.blacklisted_file_types.join(','),
              auto_archive_days: data.auto_archive_days || 30,
              session_idle_timeout_minutes: data.session_idle_timeout_minutes || 5,
              session_warning_seconds: data.session_warning_seconds || 60,
              password_reset_link_validity_hours: data.password_reset_link_validity_hours || 24,
              invite_link_validity_hours: (data as any).invite_link_validity_hours || 24,
              require_email_verification: data.require_email_verification ?? false,
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
            setPlatformForm(loaded);
            setOriginalPlatformForm(loaded);
          }
        } else if (isAccountOwner && accountId) {
          const { data } = await supabase
            .from('admin_settings')
            .select('*')
            .eq('account_id', accountId)
            .maybeSingle();

          if (data) {
            setSettings(data);
            const loaded: NotificationFormData = {
              email_schedule_time: data.email_schedule_time || '08:00',
              email_schedule_enabled: data.email_schedule_enabled ?? true,
              email_timezone: data.email_timezone || 'GMT+0',
              email_schedule_days: Array.isArray(data.email_schedule_days) ? data.email_schedule_days : [1, 2, 3, 4, 5],
              digest_blacklist_dates: Array.isArray(data.digest_blacklist_dates) ? data.digest_blacklist_dates : [],
              email_send_on_create: data.email_send_on_create ?? true,
            };
            setNotifForm(loaded);
            setOriginalNotifForm(loaded);
          } else {
            await supabase.from('admin_settings').insert({ account_id: accountId });
          }
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
        const e = err as { message?: string; code?: string };
        if (isUnauthorizedError(e)) {
          logUnauthorizedAccess({
            user_id: user?.id,
            service_context: 'admin_settings:fetch',
            description: buildDescription('admin_settings:fetch', e),
            error_code: e.code,
            error_message: e.message,
          });
        }
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user, isPlatformAdmin, isAccountOwner, accountId]);

  const toggleSection = (section: string) =>
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updateData: any = {};

      if (isPlatformAdmin && settings) {
        const f = platformForm;
        const o = originalPlatformForm;
        if (f.max_file_size_mb !== o.max_file_size_mb) updateData.max_file_size_mb = f.max_file_size_mb;
        if (f.allowed_file_types !== o.allowed_file_types) updateData.allowed_file_types = f.allowed_file_types.split(',').map((t: string) => t.trim()).filter(Boolean);
        if (f.blacklisted_file_types !== o.blacklisted_file_types) updateData.blacklisted_file_types = f.blacklisted_file_types.split(',').map((t: string) => t.trim()).filter(Boolean);
        if (f.auto_archive_days !== o.auto_archive_days) updateData.auto_archive_days = f.auto_archive_days > 0 ? f.auto_archive_days : null;
        if (f.session_idle_timeout_minutes !== o.session_idle_timeout_minutes) updateData.session_idle_timeout_minutes = f.session_idle_timeout_minutes;
        if (f.session_warning_seconds !== o.session_warning_seconds) updateData.session_warning_seconds = f.session_warning_seconds;
        if (f.password_reset_link_validity_hours !== o.password_reset_link_validity_hours) updateData.password_reset_link_validity_hours = f.password_reset_link_validity_hours;
        if (f.invite_link_validity_hours !== o.invite_link_validity_hours) updateData.invite_link_validity_hours = f.invite_link_validity_hours;
        if (f.require_email_verification !== o.require_email_verification) updateData.require_email_verification = f.require_email_verification;
        // Always include all password policy fields unconditionally — avoids
        // stale-baseline bugs where the diff detects "no change" on fields that
        // actually differ from the DB value.
        updateData.password_min_length = f.password_min_length;
        updateData.password_max_length = f.password_max_length;
        updateData.password_require_uppercase = f.password_require_uppercase;
        updateData.password_min_uppercase = f.password_min_uppercase;
        updateData.password_require_lowercase = f.password_require_lowercase;
        updateData.password_min_lowercase = f.password_min_lowercase;
        updateData.password_require_numbers = f.password_require_numbers;
        updateData.password_min_numbers = f.password_min_numbers;
        updateData.password_require_special = f.password_require_special;
        updateData.password_min_special = f.password_min_special;
        updateData.password_allowed_special_chars = f.password_allowed_special_chars;
        updateData.password_policy_applies_to = f.password_policy_applies_to;

        const { error: saveError } = await supabase.from('admin_settings').update(updateData).is('account_id', null);
        if (saveError) throw saveError;
        setOriginalPlatformForm(f);

      } else if (isAccountOwner && accountId) {
        const f = notifForm;
        const o = originalNotifForm;
        if (f.email_schedule_time !== o.email_schedule_time) updateData.email_schedule_time = f.email_schedule_time;
        if (f.email_schedule_enabled !== o.email_schedule_enabled) updateData.email_schedule_enabled = f.email_schedule_enabled;
        if (f.email_timezone !== o.email_timezone) updateData.email_timezone = f.email_timezone;
        if (JSON.stringify(f.email_schedule_days) !== JSON.stringify(o.email_schedule_days)) updateData.email_schedule_days = f.email_schedule_days;
        if (JSON.stringify(f.digest_blacklist_dates) !== JSON.stringify(o.digest_blacklist_dates)) updateData.digest_blacklist_dates = f.digest_blacklist_dates;
        if (f.email_send_on_create !== o.email_send_on_create) updateData.email_send_on_create = f.email_send_on_create;

        if (Object.keys(updateData).length === 0) { setSuccess('No changes to save'); setSaving(false); return; }
        const { error: saveError } = await supabase.from('admin_settings').update(updateData).eq('account_id', accountId);
        if (saveError) throw saveError;
        setOriginalNotifForm(f);
      }

      if (isPlatformAdmin || isAccountOwner) {
        setSuccess('Settings saved successfully');
      }
    } catch (err) {
      const e = err as { message?: string; code?: string };
      if (isUnauthorizedError(e)) {
        logUnauthorizedAccess({
          user_id: user?.id,
          service_context: 'admin_settings:update',
          description: buildDescription('admin_settings:update', e),
          error_code: e.code,
          error_message: e.message,
        });
      }
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

      {/* Account owner sections */}
      {isAccountOwner && (<>
        <AccountNotificationSettings
          formData={notifForm}
          onChange={setNotifForm}
          openSections={openSections}
          onToggleSection={toggleSection}
          onShowPricing={onShowPricing}
        />

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => toggleSection('org')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Departments & Divisions</h2>
            </div>
            {openSections.org ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
          </button>
          {openSections.org && (
            <div className="px-6 pb-6 border-t border-slate-200 pt-6">
              <OrgStructureSettings />
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
      </>)}

      {/* Platform-admin-only settings */}
      {isPlatformAdmin && <>

      {/* Email Verification Toggle — top-level, always visible */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-slate-800 font-semibold text-sm">Require Email Verification on Signup</p>
              <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
                When enabled, new account owners must verify their email before they can log in. They will receive a 24-hour verification link.
              </p>
              {platformForm.require_email_verification && (
                <p className="text-amber-700 text-xs mt-2 font-medium">
                  Active — new signups cannot log in until they click the verification link.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPlatformForm(f => ({ ...f, require_email_verification: !f.require_email_verification }))}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none mt-0.5 ${
              platformForm.require_email_verification ? 'bg-slate-800' : 'bg-slate-200'
            }`}
            role="switch"
            aria-checked={platformForm.require_email_verification}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                platformForm.require_email_verification ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* File Settings */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('file')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <File className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">File Settings</h2>
          </div>
          {openSections.file ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
        </button>

        {openSections.file && (
          <div className="px-6 pb-6 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <label className="block text-slate-700 font-medium mb-2">Maximum File Size (MB)</label>
              <input
                type="number" min="1" max="50"
                value={platformForm.max_file_size_mb}
                onChange={(e) => setPlatformForm({ ...platformForm, max_file_size_mb: parseInt(e.target.value) || 5 })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-2">Allowed File Types (comma-separated)</label>
              <input
                type="text"
                value={platformForm.allowed_file_types}
                onChange={(e) => setPlatformForm({ ...platformForm, allowed_file_types: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                placeholder="pdf,jpg,png,mail"
              />
              <p className="text-slate-600 text-sm mt-1">Example: pdf,jpg,png,mail</p>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-2">Blacklisted File Types (comma-separated)</label>
              <input
                type="text"
                value={platformForm.blacklisted_file_types}
                onChange={(e) => setPlatformForm({ ...platformForm, blacklisted_file_types: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                placeholder="exe,bat,cmd"
              />
              <p className="text-slate-600 text-sm mt-1">Leave empty to allow all configured types</p>
            </div>
          </div>
        )}
      </div>

      {/* Archive Settings */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('archive')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Archive className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Query Archive Settings</h2>
          </div>
          {openSections.archive ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
        </button>

        {openSections.archive && (
          <div className="px-6 pb-6 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <label className="block text-slate-700 font-medium mb-2">Auto-Archive After (Days)</label>
              <input
                type="number" min="0" max="365"
                value={platformForm.auto_archive_days}
                onChange={(e) => setPlatformForm({ ...platformForm, auto_archive_days: parseInt(e.target.value) || 0 })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">
                Automatically archive queries marked as "Done" after this many days. Set to 0 to disable.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Session & Security */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('session')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Session & Security Settings</h2>
          </div>
          {openSections.session ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
        </button>

        {openSections.session && (
          <div className="px-6 pb-6 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <label className="block text-slate-700 font-medium mb-2">Session Idle Timeout (Minutes)</label>
              <input
                type="number" min="1" max="60"
                value={platformForm.session_idle_timeout_minutes}
                onChange={(e) => setPlatformForm({ ...platformForm, session_idle_timeout_minutes: parseInt(e.target.value) || 5 })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">Users will be automatically logged out after this period of inactivity</p>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-2">Session Warning Time (Seconds)</label>
              <input
                type="number" min="10" max="300"
                value={platformForm.session_warning_seconds}
                onChange={(e) => setPlatformForm({ ...platformForm, session_warning_seconds: parseInt(e.target.value) || 60 })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">Show warning dialog this many seconds before session expires</p>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-2">Password Reset Link Validity (Hours)</label>
              <input
                type="number" min="1" max="72"
                value={platformForm.password_reset_link_validity_hours}
                onChange={(e) => setPlatformForm({ ...platformForm, password_reset_link_validity_hours: parseInt(e.target.value) || 24 })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">Password reset links will expire after this many hours</p>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-2">Invitation Link Validity (Hours)</label>
              <input
                type="number" min="1" max="168"
                value={platformForm.invite_link_validity_hours}
                onChange={(e) => setPlatformForm({ ...platformForm, invite_link_validity_hours: parseInt(e.target.value) || 24 })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">Team member invitation links will expire after this many hours (max 168 = 7 days)</p>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-700 font-medium">Require Email Verification on Signup</p>
                  <p className="text-slate-500 text-sm mt-0.5">
                    When enabled, new account owners must verify their email before they can log in. They will receive a verification link valid for 24 hours.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlatformForm(f => ({ ...f, require_email_verification: !f.require_email_verification }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    platformForm.require_email_verification ? 'bg-slate-800' : 'bg-slate-200'
                  }`}
                  role="switch"
                  aria-checked={platformForm.require_email_verification}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      platformForm.require_email_verification ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {platformForm.require_email_verification && (
                <div className="mt-3 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <Shield className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700">New signups will not be able to log in until they click the verification link sent to their email.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Password Policy */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('password')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Password Policy Settings</h2>
          </div>
          {openSections.password ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
        </button>

        {openSections.password && (
          <div className="px-6 pb-6 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <label className="block text-slate-700 font-medium mb-2">Apply Password Policy To</label>
              <div className="space-y-2">
                {[
                  { key: 'admin', label: 'Account Owner / Supervisor' },
                  { key: 'team_member', label: 'Team Member' },
                ].map(role => (
                  <label key={role.key} className="flex items-center space-x-3 p-3 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformForm.password_policy_applies_to.includes(role.key)}
                      onChange={(e) => {
                        const newRoles = e.target.checked
                          ? [...platformForm.password_policy_applies_to, role.key]
                          : platformForm.password_policy_applies_to.filter(r => r !== role.key);
                        setPlatformForm({ ...platformForm, password_policy_applies_to: newRoles });
                      }}
                      className="w-4 h-4 text-slate-600 rounded focus:ring-2 focus:ring-slate-500"
                    />
                    <span className="text-slate-700">{role.label}</span>
                  </label>
                ))}
              </div>
              {platformForm.password_policy_applies_to.length === 0 && (
                <p className="text-red-600 text-sm mt-1">Please select at least one role</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-slate-700 font-medium mb-2">Minimum Length</label>
                <input
                  type="number" min="4" max="128"
                  value={platformForm.password_min_length}
                  onChange={(e) => setPlatformForm({ ...platformForm, password_min_length: parseInt(e.target.value) || 8 })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-2">Maximum Length</label>
                <input
                  type="number" min="8" max="256"
                  value={platformForm.password_max_length}
                  onChange={(e) => setPlatformForm({ ...platformForm, password_max_length: parseInt(e.target.value) || 128 })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>

            <div className="space-y-4">
              {[
                { key: 'password_require_uppercase', minKey: 'password_min_uppercase', label: 'Require Uppercase Letters' },
                { key: 'password_require_lowercase', minKey: 'password_min_lowercase', label: 'Require Lowercase Letters' },
                { key: 'password_require_numbers', minKey: 'password_min_numbers', label: 'Require Numbers' },
                { key: 'password_require_special', minKey: 'password_min_special', label: 'Require Special Characters' },
              ].map(({ key, minKey, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(platformForm as any)[key]}
                      onChange={(e) => setPlatformForm({ ...platformForm, [key]: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-slate-700 font-medium">{label}</span>
                  </label>
                  {(platformForm as any)[key] && (
                    <input
                      type="number" min="0" max="10"
                      value={(platformForm as any)[minKey]}
                      onChange={(e) => setPlatformForm({ ...platformForm, [minKey]: parseInt(e.target.value) || 1 })}
                      className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600"
                      placeholder="Min"
                    />
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-2">Allowed Special Characters</label>
              <input
                type="text"
                value={platformForm.password_allowed_special_chars}
                onChange={(e) => setPlatformForm({ ...platformForm, password_allowed_special_chars: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 font-mono"
                placeholder="!@#$%^&*()_+-=[]{}|;:,.<>?"
              />
              <p className="text-slate-600 text-sm mt-1">Define which special characters are allowed in passwords</p>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Settings - platform admin only */}
      <PlatformSubscriptionSettings />

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

      </>}
    </div>
  );
}
