import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Send, Clock, Users, FileText, ChevronDown, ChevronUp,
  Mail, MessageCircle, Ban, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { FeatureLocked } from '../common/FeatureLocked';

export interface NotificationFormData {
  email_schedule_time: string;
  email_schedule_enabled: boolean;
  email_timezone: string;
  email_schedule_days: number[];
  digest_blacklist_dates: string[];
  email_send_on_create: boolean;
}

export const DEFAULT_NOTIFICATION_FORM: NotificationFormData = {
  email_schedule_time: '08:00',
  email_schedule_enabled: true,
  email_timezone: 'GMT+0',
  email_schedule_days: [1, 2, 3, 4, 5],
  digest_blacklist_dates: [],
  email_send_on_create: true,
};

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

function BlacklistCalendar({ blacklist, onChange }: { blacklist: string[]; onChange: (updated: string[]) => void }) {
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
      if (!blacklist.includes(newEntry)) onChange([...blacklist, newEntry]);
      setRangeStart(null);
    }
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
          <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-800">{monthName} {viewYear}</span>
          <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d.value} className="text-center text-xs font-medium text-slate-400 py-1">{d.label}</div>
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
          <span>Range start: <strong>{rangeStart}</strong> — click an end date (or same date for single day)</span>
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
                label = `${parseDateKey(s).toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${parseDateKey(e).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
              } else {
                label = parseDateKey(entry).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
              }
              return (
                <span key={entry} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 text-xs rounded-full font-medium">
                  <Ban className="w-3 h-3" />
                  {label}
                  <button type="button" onClick={() => onChange(blacklist.filter(e => e !== entry))} className="ml-0.5 hover:text-red-900 transition-colors">
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

interface AccountNotificationSettingsProps {
  formData: NotificationFormData;
  onChange: (data: NotificationFormData) => void;
  openSections: Record<string, boolean>;
  onToggleSection: (section: string) => void;
  onShowPricing?: () => void;
}

export default function AccountNotificationSettings({
  formData,
  onChange,
  openSections,
  onToggleSection,
  onShowPricing,
}: AccountNotificationSettingsProps) {
  const { activeRole, features } = useAuth();
  const accountId = activeRole?.type === 'account' ? activeRole.accountId : null;

  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestFeedback, setDigestFeedback] = useState('');
  const [digestSummary, setDigestSummary] = useState<DigestSummary | null>(null);

  const toggleScheduleDay = (day: number) => {
    const days = formData.email_schedule_days;
    const updated = days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort();
    onChange({ ...formData, email_schedule_days: updated });
  };

  const fetchDigestSummary = async () => {
    if (!accountId) return;
    try {
      const { data } = await supabase
        .from('email_logs')
        .select('sent_at, total_queries_count, triggered_by, digest_batch_id, profiles!inner(account_id)')
        .eq('email_type', 'digest')
        .eq('profiles.account_id', accountId)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (data && data.length > 0) {
        const lastBatch = data.filter(log => log.digest_batch_id === data[0].digest_batch_id);
        setDigestSummary({
          last_sent_at: data[0].sent_at,
          total_recipients: lastBatch.length,
          total_queries: lastBatch.reduce((sum, log) => sum + (log.total_queries_count || 0), 0),
          triggered_by: data[0].triggered_by || 'system',
        });
      }
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    fetchDigestSummary();
  }, [accountId]);

  const handleSendDigestNow = async () => {
    setSendingDigest(true);
    setDigestFeedback('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-daily-reminders`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ triggered_by: 'admin', account_id: accountId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send digest emails');

      const parts: string[] = [`Sent! ${data.emailsSent ?? 0} emails delivered to your team members.`];

      const sentEmails = (data.summary as { email: string; status: string }[] ?? [])
        .filter((e) => e.status.startsWith('sent'))
        .map((e) => e.email);
      if (sentEmails.length > 0) {
        parts.push(`Recipients: ${sentEmails.join(', ')}`);
      }

      if (data.emailsFailed > 0) {
        parts.push(`${data.emailsFailed} failed.`);
        if (data.errors?.length) parts.push(`Errors: ${data.errors.join('; ')}`);
      }
      if (data.emailsSent === 0 && data.skipped?.length) {
        const reasons = (data.skipped as { account_id: string; reason: string }[])
          .map((s) => s.reason)
          .join('; ');
        parts.push(`Skip reasons: ${reasons}`);
      }
      setDigestFeedback(parts.join(' '));
      fetchDigestSummary();
    } catch (err) {
      setDigestFeedback(err instanceof Error ? err.message : 'Failed to send digest emails');
    } finally {
      setSendingDigest(false);
    }
  };

  if (!accountId) return null;

  return (
    <>
      {/* Email Settings */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => onToggleSection('email')}
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

            <div className="pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => onChange({ ...formData, email_schedule_enabled: !formData.email_schedule_enabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${formData.email_schedule_enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.email_schedule_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-slate-700 font-medium">Enable daily email digest</span>
              </label>
              <p className="text-slate-500 text-xs mt-1.5 ml-14">
                Send a daily summary of pending and open queries to your team members.
              </p>
            </div>

            <div className={`space-y-5 transition-opacity ${!formData.email_schedule_enabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Daily Email Schedule</label>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Send time</label>
                    <input
                      type="time"
                      value={formData.email_schedule_time}
                      onChange={(e) => onChange({ ...formData, email_schedule_time: e.target.value })}
                      className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Timezone</label>
                    <select
                      value={formData.email_timezone}
                      onChange={(e) => onChange({ ...formData, email_timezone: e.target.value })}
                      className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800 bg-white"
                    >
                      {TIMEZONE_OPTIONS.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-2">Digest emails will be sent at this time in the selected timezone.</p>
              </div>

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
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${active ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'}`}
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

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Ban className="w-4 h-4 text-slate-600" />
                  <label className="text-sm font-semibold text-slate-700">Holiday / Blackout Dates</label>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Click a date to mark it as a single blackout day. Click a start date then an end date to block a range.
                </p>
                <BlacklistCalendar
                  blacklist={formData.digest_blacklist_dates}
                  onChange={(updated) => onChange({ ...formData, digest_blacklist_dates: updated })}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => onChange({ ...formData, email_send_on_create: !formData.email_send_on_create })}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${formData.email_send_on_create ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.email_send_on_create ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-slate-700 font-medium">Send email immediately when a query is created</span>
              </label>
              <p className="text-slate-500 text-xs mt-1.5 ml-14">
                Notify the assigned team member by email as soon as a new query is raised.
              </p>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4">Send Digest Email Now</h3>
              {digestSummary ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-slate-600" />
                      <span className="text-sm text-slate-600">Last Sent</span>
                    </div>
                    <p className="text-base font-semibold text-slate-900">{new Date(digestSummary.last_sent_at!).toLocaleString()}</p>
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
                    <p className="text-xs text-green-600 mt-1">pending queries included</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                  <p className="text-slate-600 text-center text-sm">No digest emails have been sent yet for your account</p>
                </div>
              )}
              {digestFeedback && (
                <p className="text-sm mb-3 text-slate-600">{digestFeedback}</p>
              )}
              <button
                onClick={handleSendDigestNow}
                disabled={sendingDigest}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 text-sm font-medium"
              >
                <Send className="w-4 h-4" />
                {sendingDigest ? 'Sending...' : 'Send Digest Email Now'}
              </button>
              <p className="text-slate-500 text-xs mt-2">
                Bypass the schedule and immediately send a digest to all your team members with pending queries.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Notifications */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => onToggleSection('whatsapp')}
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
    </>
  );
}
