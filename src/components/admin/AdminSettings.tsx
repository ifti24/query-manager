import { useEffect, useState } from 'react';
import { supabase, AdminSettings } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Send, Clock, Users, FileText, ChevronDown, ChevronUp, Mail, File, Archive, Shield, Lock, X, ChevronLeft, ChevronRight, Ban, MessageCircle } from 'lucide-react';
import { FeatureLocked } from '../common/FeatureLocked';
import { logUnauthorizedAccess, isUnauthorizedError, buildDescription } from '../../lib/securityAudit';
import PlatformSubscriptionSettings from '../admin/platform/PlatformSubscriptionSettings';

interface DigestSummary {
  last_sent_at: string | null;
  total_recipients: number;
  total_queries: number;
  triggered_by: string;
}

const TIMEZONE_OPTIONS = [
  { label: 'GMT-12', value: 'GMT-12' },
  { label: 'GMT-11', value: 'GMT-11' },
  { label: 'GMT-10', value: 'GMT-10' },
  { label: 'GMT-9', value: 'GMT-9' },
  { label: 'GMT-8', value: 'GMT-8' },
  { label: 'GMT-7', value: 'GMT-7' },
  { label: 'GMT-6', value: 'GMT-6' },
  { label: 'GMT-5', value: 'GMT-5' },
  { label: 'GMT-4', value: 'GMT-4' },
  { label: 'GMT-3', value: 'GMT-3' },
  { label: 'GMT-2', value: 'GMT-2' },
  { label: 'GMT-1', value: 'GMT-1' },
  { label: 'GMT+0 (UTC)', value: 'GMT+0' },
  { label: 'GMT+1', value: 'GMT+1' },
  { label: 'GMT+2', value: 'GMT+2' },
  { label: 'GMT+3', value: 'GMT+3' },
  { label: 'GMT+4', value: 'GMT+4' },
  { label: 'GMT+5', value: 'GMT+5' },
  { label: 'GMT+5:30 (IST)', value: 'GMT+5:30' },
  { label: 'GMT+5:45 (NPT)', value: 'GMT+5:45' },
  { label: 'GMT+6', value: 'GMT+6' },
  { label: 'GMT+6:30', value: 'GMT+6:30' },
  { label: 'GMT+7', value: 'GMT+7' },
  { label: 'GMT+8', value: 'GMT+8' },
  { label: 'GMT+9', value: 'GMT+9' },
  { label: 'GMT+9:30', value: 'GMT+9:30' },
  { label: 'GMT+10', value: 'GMT+10' },
  { label: 'GMT+11', value: 'GMT+11' },
  { label: 'GMT+12', value: 'GMT+12' },
];

const WEEKDAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isDateInBlacklist(dateKey: string, blacklist: string[]): boolean {
  for (const entry of blacklist) {
    if (entry.includes('/')) {
      const [start, end] = entry.split('/');
      if (dateKey >= start && dateKey <= end) return true;
    } else if (entry === dateKey) {
      return true;
    }
  }
  return false;
}

interface BlacklistCalendarProps {
  blacklist: string[];
  onChange: (updated: string[]) => void;
}

function BlacklistCalendar({ blacklist, onChange }: BlacklistCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [rangeStart, setRangeStart] = useState<string | null>(null);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long' });

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(m => m + 1);
  }

  function handleDayClick(dateKey: string) {
    if (!rangeStart) {
      setRangeStart(dateKey);
    } else {
      const start = rangeStart < dateKey ? rangeStart : dateKey;
      const end = rangeStart < dateKey ? dateKey : rangeStart;
      const newEntry = start === end ? start : `${start}/${end}`;
      if (!blacklist.includes(newEntry)) {
        onChange([...blacklist, newEntry]);
      }
      setRangeStart(null);
    }
  }

  function removeEntry(entry: string) {
    onChange(blacklist.filter(e => e !== entry));
  }

  function isInRange(dateKey: string): boolean {
    if (!rangeStart) return false;
    const lo = rangeStart < dateKey ? rangeStart : dateKey;
    const hi = rangeStart < dateKey ? dateKey : rangeStart;
    return dateKey >= lo && dateKey <= hi;
  }

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(formatDateKey(new Date(viewYear, viewMonth, d)));
  }

  return (
    <div>
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-800">{monthName} {viewYear}</span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d.value} className="text-center text-xs font-medium text-slate-400 py-1">
                {d.label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((dateKey, i) => {
              if (!dateKey) return <div key={`empty-${i}`} />;
              const isBlacklisted = isDateInBlacklist(dateKey, blacklist);
              const isRangeHighlighted = isInRange(dateKey);
              const isRangeStart = rangeStart === dateKey;
              const dayNum = parseInt(dateKey.split('-')[2]);
              const isPast = dateKey < formatDateKey(today);

              return (
                <button
                  type="button"
                  key={dateKey}
                  onClick={() => !isPast && handleDayClick(dateKey)}
                  disabled={isPast}
                  className={[
                    'relative text-center text-sm py-1.5 rounded-lg transition-all font-medium',
                    isPast ? 'text-slate-300 cursor-not-allowed' : 'cursor-pointer',
                    isBlacklisted && !isPast ? 'bg-red-100 text-red-700 hover:bg-red-200' : '',
                    isRangeStart ? 'bg-amber-500 text-white ring-2 ring-amber-300' : '',
                    isRangeHighlighted && !isRangeStart && !isBlacklisted ? 'bg-amber-100 text-amber-800' : '',
                    !isBlacklisted && !isRangeHighlighted && !isPast ? 'hover:bg-slate-100 text-slate-700' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {dayNum}
                  {isBlacklisted && !isPast && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {rangeStart && (
        <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center justify-between">
          <span>Range start: <strong>{rangeStart}</strong> — now click an end date (or same date for single day)</span>
          <button type="button" onClick={() => setRangeStart(null)} className="ml-2 text-amber-600 hover:text-amber-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {blacklist.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Blacklisted dates</p>
          <div className="flex flex-wrap gap-2">
            {blacklist.map(entry => {
              let label = entry;
              if (entry.includes('/')) {
                const [s, e] = entry.split('/');
                const sd = parseDateKey(s);
                const ed = parseDateKey(e);
                label = `${sd.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${ed.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
              } else {
                const d = parseDateKey(entry);
                label = d.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
              }
              return (
                <span
                  key={entry}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 text-xs rounded-full font-medium"
                >
                  <Ban className="w-3 h-3" />
                  {label}
                  <button
                    type="button"
                    onClick={() => removeEntry(entry)}
                    className="ml-0.5 hover:text-red-900 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_FORM_DATA = {
  email_schedule_time: '08:00',
  email_schedule_enabled: true,
  email_timezone: 'GMT+0',
  email_schedule_days: [1, 2, 3, 4, 5] as number[],
  digest_blacklist_dates: [] as string[],
  email_send_on_create: true,
  max_file_size_mb: 5,
  allowed_file_types: 'pdf,jpg,png,mail',
  blacklisted_file_types: '',
  auto_archive_days: 30,
  session_idle_timeout_minutes: 5,
  session_warning_seconds: 60,
  password_reset_link_validity_hours: 24,
  invite_link_validity_hours: 24,
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
  const { user, features, isPlatformAdmin } = useAuth();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestSummary, setDigestSummary] = useState<DigestSummary | null>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    email: false,
    whatsapp: false,
    file: false,
    archive: false,
    session: false,
    password: false,
  });

  const [originalData, setOriginalData] = useState({ ...DEFAULT_FORM_DATA });
  const [formData, setFormData] = useState({ ...DEFAULT_FORM_DATA });

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
            email_timezone: data.email_timezone || 'GMT+0',
            email_schedule_days: Array.isArray(data.email_schedule_days) ? data.email_schedule_days : [1, 2, 3, 4, 5],
            digest_blacklist_dates: Array.isArray(data.digest_blacklist_dates) ? data.digest_blacklist_dates : [],
            email_send_on_create: data.email_send_on_create,
            max_file_size_mb: data.max_file_size_mb,
            allowed_file_types: data.allowed_file_types.join(','),
            blacklisted_file_types: data.blacklisted_file_types.join(','),
            auto_archive_days: data.auto_archive_days || 30,
            session_idle_timeout_minutes: data.session_idle_timeout_minutes || 5,
            session_warning_seconds: data.session_warning_seconds || 60,
            password_reset_link_validity_hours: data.password_reset_link_validity_hours || 24,
            invite_link_validity_hours: (data as any).invite_link_validity_hours || 24,
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
          await supabase.from('admin_settings').insert({ admin_id: user.id });
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
        body: JSON.stringify({ triggered_by: 'admin' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send digest emails');
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

  const toggleScheduleDay = (day: number) => {
    const days = formData.email_schedule_days;
    const updated = days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort();
    setFormData({ ...formData, email_schedule_days: updated });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updateData: any = {};

      if (formData.email_schedule_time !== originalData.email_schedule_time)
        updateData.email_schedule_time = formData.email_schedule_time;
      if (formData.email_schedule_enabled !== originalData.email_schedule_enabled)
        updateData.email_schedule_enabled = formData.email_schedule_enabled;
      if (formData.email_timezone !== originalData.email_timezone)
        updateData.email_timezone = formData.email_timezone;
      if (JSON.stringify(formData.email_schedule_days) !== JSON.stringify(originalData.email_schedule_days))
        updateData.email_schedule_days = formData.email_schedule_days;
      if (JSON.stringify(formData.digest_blacklist_dates) !== JSON.stringify(originalData.digest_blacklist_dates))
        updateData.digest_blacklist_dates = formData.digest_blacklist_dates;
      if (formData.email_send_on_create !== originalData.email_send_on_create)
        updateData.email_send_on_create = formData.email_send_on_create;
      if (formData.max_file_size_mb !== originalData.max_file_size_mb)
        updateData.max_file_size_mb = formData.max_file_size_mb;
      if (formData.allowed_file_types !== originalData.allowed_file_types)
        updateData.allowed_file_types = formData.allowed_file_types.split(',').map(t => t.trim()).filter(Boolean);
      if (formData.blacklisted_file_types !== originalData.blacklisted_file_types)
        updateData.blacklisted_file_types = formData.blacklisted_file_types.split(',').map(t => t.trim()).filter(Boolean);
      if (formData.auto_archive_days !== originalData.auto_archive_days)
        updateData.auto_archive_days = formData.auto_archive_days > 0 ? formData.auto_archive_days : null;
      if (formData.session_idle_timeout_minutes !== originalData.session_idle_timeout_minutes)
        updateData.session_idle_timeout_minutes = formData.session_idle_timeout_minutes;
      if (formData.session_warning_seconds !== originalData.session_warning_seconds)
        updateData.session_warning_seconds = formData.session_warning_seconds;
      if (formData.password_reset_link_validity_hours !== originalData.password_reset_link_validity_hours)
        updateData.password_reset_link_validity_hours = formData.password_reset_link_validity_hours;
      if ((formData as any).invite_link_validity_hours !== (originalData as any).invite_link_validity_hours)
        (updateData as any).invite_link_validity_hours = (formData as any).invite_link_validity_hours;
      if (formData.password_min_length !== originalData.password_min_length)
        updateData.password_min_length = formData.password_min_length;
      if (formData.password_max_length !== originalData.password_max_length)
        updateData.password_max_length = formData.password_max_length;
      if (formData.password_require_uppercase !== originalData.password_require_uppercase)
        updateData.password_require_uppercase = formData.password_require_uppercase;
      if (formData.password_min_uppercase !== originalData.password_min_uppercase)
        updateData.password_min_uppercase = formData.password_min_uppercase;
      if (formData.password_require_lowercase !== originalData.password_require_lowercase)
        updateData.password_require_lowercase = formData.password_require_lowercase;
      if (formData.password_min_lowercase !== originalData.password_min_lowercase)
        updateData.password_min_lowercase = formData.password_min_lowercase;
      if (formData.password_require_numbers !== originalData.password_require_numbers)
        updateData.password_require_numbers = formData.password_require_numbers;
      if (formData.password_min_numbers !== originalData.password_min_numbers)
        updateData.password_min_numbers = formData.password_min_numbers;
      if (formData.password_require_special !== originalData.password_require_special)
        updateData.password_require_special = formData.password_require_special;
      if (formData.password_min_special !== originalData.password_min_special)
        updateData.password_min_special = formData.password_min_special;
      if (formData.password_allowed_special_chars !== originalData.password_allowed_special_chars)
        updateData.password_allowed_special_chars = formData.password_allowed_special_chars;
      if (JSON.stringify(formData.password_policy_applies_to.sort()) !== JSON.stringify(originalData.password_policy_applies_to.sort()))
        updateData.password_policy_applies_to = formData.password_policy_applies_to;

      if (Object.keys(updateData).length === 0) {
        setSuccess('No changes to save');
        setSaving(false);
        return;
      }

      const { error: saveError } = await supabase.from('admin_settings').update(updateData).eq('admin_id', user.id);
      if (saveError) {
        if (isUnauthorizedError({ message: saveError.message, code: saveError.code })) {
          logUnauthorizedAccess({
            user_id: user?.id,
            service_context: 'admin_settings:update',
            description: buildDescription('admin_settings:update', saveError),
            error_code: saveError.code,
            error_message: saveError.message,
          });
        }
        throw saveError;
      }
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

      {/* Platform-admin-only settings */}
      {isPlatformAdmin && <>

      {/* Email Settings */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('email')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Email Settings</h2>
          </div>
          {openSections.email ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
        </button>

        {openSections.email && (
          <div className="px-6 pb-6 border-t border-slate-200 space-y-8">

            {/* Enable toggle */}
            <div className="pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setFormData({ ...formData, email_schedule_enabled: !formData.email_schedule_enabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${formData.email_schedule_enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.email_schedule_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-slate-700 font-medium">Enable daily email digest</span>
              </label>
            </div>

            {/* Schedule time + timezone */}
            <div className={`space-y-5 transition-opacity ${!formData.email_schedule_enabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Daily Email Schedule</label>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Send time</label>
                    <input
                      type="time"
                      value={formData.email_schedule_time}
                      onChange={(e) => setFormData({ ...formData, email_schedule_time: e.target.value })}
                      className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Timezone</label>
                    <select
                      value={formData.email_timezone}
                      onChange={(e) => setFormData({ ...formData, email_timezone: e.target.value })}
                      className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800 bg-white"
                    >
                      {TIMEZONE_OPTIONS.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-2">
                  Digest emails will be sent at this time in the selected timezone.
                </p>
              </div>

              {/* Days of week */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Send on these days</label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(day => {
                    const active = formData.email_schedule_days.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleScheduleDay(day.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                          active
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                            : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                {formData.email_schedule_days.length === 0 && (
                  <p className="text-red-500 text-xs mt-1">Select at least one day</p>
                )}
              </div>

              {/* Blacklist calendar */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Ban className="w-4 h-4 text-slate-600" />
                  <label className="text-sm font-semibold text-slate-700">Holiday / Blackout Dates</label>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Click a date to mark it as a single blackout day. Click a start date then an end date to block a range (e.g. a holiday week).
                </p>
                <BlacklistCalendar
                  blacklist={formData.digest_blacklist_dates}
                  onChange={(updated) => setFormData({ ...formData, digest_blacklist_dates: updated })}
                />
              </div>
            </div>

            {/* Send on create */}
            <div className="border-t border-slate-100 pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setFormData({ ...formData, email_send_on_create: !formData.email_send_on_create })}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${formData.email_send_on_create ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.email_send_on_create ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-slate-700 font-medium">Send email immediately when query is created</span>
              </label>
            </div>

            {/* Send digest now */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4">Send Digest Email Now</h3>

              {digestSummary ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-slate-600" />
                      <span className="text-sm text-slate-600">Last Sent</span>
                    </div>
                    <p className="text-base font-semibold text-slate-900">
                      {new Date(digestSummary.last_sent_at!).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Triggered by: {digestSummary.triggered_by}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <span className="text-sm text-blue-600">Recipients</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{digestSummary.total_recipients}</p>
                    <p className="text-xs text-blue-600 mt-1">team members notified</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-600">Total Queries</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">{digestSummary.total_queries}</p>
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
              <p className="text-slate-500 text-xs mt-2">
                This bypasses the schedule and immediately sends digest emails to all team members with pending queries.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Notifications */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('whatsapp')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">WhatsApp Notifications</h2>
            {!features.hasWhatsApp && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">Basic+</span>
            )}
          </div>
          {openSections.whatsapp ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
        </button>
        {openSections.whatsapp && (
          <div className="px-6 pb-6 border-t border-slate-200">
            {features.hasWhatsApp ? (
              <div className="pt-5 space-y-4">
                <p className="text-sm text-slate-500">
                  Configure WhatsApp notification settings for your team. Notifications will be sent via the configured WhatsApp Business API.
                </p>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                  WhatsApp notifications are enabled on your plan. Integration configuration coming soon.
                </div>
              </div>
            ) : (
              <div className="pt-5">
                <FeatureLocked
                  featureName="WhatsApp Notifications"
                  requiredPlan="Basic"
                  onUpgrade={onShowPricing}
                />
              </div>
            )}
          </div>
        )}
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
                value={formData.max_file_size_mb}
                onChange={(e) => setFormData({ ...formData, max_file_size_mb: parseInt(e.target.value) || 5 })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-2">Allowed File Types (comma-separated)</label>
              <input
                type="text"
                value={formData.allowed_file_types}
                onChange={(e) => setFormData({ ...formData, allowed_file_types: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                placeholder="pdf,jpg,png,mail"
              />
              <p className="text-slate-600 text-sm mt-1">Example: pdf,jpg,png,mail</p>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-2">Blacklisted File Types (comma-separated)</label>
              <input
                type="text"
                value={formData.blacklisted_file_types}
                onChange={(e) => setFormData({ ...formData, blacklisted_file_types: e.target.value })}
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
                value={formData.auto_archive_days}
                onChange={(e) => setFormData({ ...formData, auto_archive_days: parseInt(e.target.value) || 0 })}
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
                value={formData.session_idle_timeout_minutes}
                onChange={(e) => setFormData({ ...formData, session_idle_timeout_minutes: parseInt(e.target.value) || 5 })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">Users will be automatically logged out after this period of inactivity</p>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-2">Session Warning Time (Seconds)</label>
              <input
                type="number" min="10" max="300"
                value={formData.session_warning_seconds}
                onChange={(e) => setFormData({ ...formData, session_warning_seconds: parseInt(e.target.value) || 60 })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">Show warning dialog this many seconds before session expires</p>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-2">Password Reset Link Validity (Hours)</label>
              <input
                type="number" min="1" max="72"
                value={formData.password_reset_link_validity_hours}
                onChange={(e) => setFormData({ ...formData, password_reset_link_validity_hours: parseInt(e.target.value) || 24 })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">Password reset links will expire after this many hours</p>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-2">Invitation Link Validity (Hours)</label>
              <input
                type="number" min="1" max="168"
                value={(formData as any).invite_link_validity_hours ?? 24}
                onChange={(e) => setFormData({ ...formData, ...{ invite_link_validity_hours: parseInt(e.target.value) || 24 } } as any)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <p className="text-slate-600 text-sm mt-1">Team member invitation links will expire after this many hours (max 168 = 7 days)</p>
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
                  { key: 'admin', label: 'Admin' },
                  { key: 'team_member', label: 'Team Member' },
                ].map(role => (
                  <label key={role.key} className="flex items-center space-x-3 p-3 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.password_policy_applies_to.includes(role.key)}
                      onChange={(e) => {
                        const newRoles = e.target.checked
                          ? [...formData.password_policy_applies_to, role.key]
                          : formData.password_policy_applies_to.filter(r => r !== role.key);
                        setFormData({ ...formData, password_policy_applies_to: newRoles });
                      }}
                      className="w-4 h-4 text-slate-600 rounded focus:ring-2 focus:ring-slate-500"
                    />
                    <span className="text-slate-700">{role.label}</span>
                  </label>
                ))}
              </div>
              {formData.password_policy_applies_to.length === 0 && (
                <p className="text-red-600 text-sm mt-1">Please select at least one role</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-slate-700 font-medium mb-2">Minimum Length</label>
                <input
                  type="number" min="4" max="128"
                  value={formData.password_min_length}
                  onChange={(e) => setFormData({ ...formData, password_min_length: parseInt(e.target.value) || 8 })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-2">Maximum Length</label>
                <input
                  type="number" min="8" max="256"
                  value={formData.password_max_length}
                  onChange={(e) => setFormData({ ...formData, password_max_length: parseInt(e.target.value) || 128 })}
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
                      checked={(formData as any)[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-slate-700 font-medium">{label}</span>
                  </label>
                  {(formData as any)[key] && (
                    <input
                      type="number" min="0" max="10"
                      value={(formData as any)[minKey]}
                      onChange={(e) => setFormData({ ...formData, [minKey]: parseInt(e.target.value) || 1 })}
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
                value={formData.password_allowed_special_chars}
                onChange={(e) => setFormData({ ...formData, password_allowed_special_chars: e.target.value })}
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

      </>}

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
