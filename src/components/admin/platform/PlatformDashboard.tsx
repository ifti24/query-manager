import { useState } from 'react';
import {
  Building2,
  Users,
  UserCheck,
  Shield,
  FileText,
  CheckCircle2,
  Clock,
  Archive,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Hourglass,
  User,
  UserX,
  UsersRound,
} from 'lucide-react';
import { usePlatformStats } from './usePlatformStats';
import type { AccountSummary } from './usePlatformStats';
import PlatformStatCard from './PlatformStatCard';
import PlanBreakdown from './PlanBreakdown';
import AccountsTable from './AccountsTable';
import ActivityLeaderboard from './ActivityLeaderboard';
import StatCarousel from './StatCarousel';
import AccountOwnerDetailModal from './AccountOwnerDetailModal';
import UnverifiedSignupsTable from './UnverifiedSignupsTable';
import OtherUsersTable from './OtherUsersTable';

interface BigStatTileProps {
  label: string;
  value: number | string;
  subLabel?: string;
  icon: React.ReactNode;
  colorClass: string;
  badge?: { text: string; color: string };
}

function BigStatTile({ label, value, subLabel, icon, colorClass, badge }: BigStatTileProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-7 flex items-center gap-6 w-full">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-5xl font-bold text-slate-900 mt-1 leading-none">{value}</p>
        {subLabel && <p className="text-sm text-slate-400 mt-2">{subLabel}</p>}
        {badge && (
          <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-semibold mt-2 ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PlatformDashboard() {
  const { overview, loading, error, refresh } = usePlatformStats();
  const [showAlerts, setShowAlerts] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<AccountSummary | null>(null);
  const [drilldownTab, setDrilldownTab] = useState<'accounts' | 'unverified' | 'others'>('accounts');

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-sm">Failed to load platform data</p>
          <p className="text-xs mt-0.5">{error}</p>
        </div>
        <button
          onClick={refresh}
          className="ml-auto text-xs border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!overview) return null;

  const hasAlerts = overview.expiredUnrenewed > 0 || overview.trialExpired > 0;

  const resolveRate =
    overview.totalQueries > 0
      ? Math.round((overview.resolvedQueries / overview.totalQueries) * 100)
      : 0;

  const accountUserSlides = [
    <BigStatTile
      label="Total Accounts"
      value={overview.totalAccounts}
      subLabel={`${overview.activeAccounts} active`}
      icon={<Building2 className="w-8 h-8 text-slate-600" />}
      colorClass="bg-slate-100"
    />,
    <BigStatTile
      label="Account Owners"
      value={overview.totalOwners}
      subLabel="license holders"
      icon={<UserCheck className="w-8 h-8 text-blue-600" />}
      colorClass="bg-blue-50"
    />,
    <BigStatTile
      label="Supervisors"
      value={overview.totalSupervisors}
      subLabel="across all accounts"
      icon={<Shield className="w-8 h-8 text-teal-600" />}
      colorClass="bg-teal-50"
    />,
    <BigStatTile
      label="Members"
      value={overview.totalMembers}
      subLabel="active team members"
      icon={<User className="w-8 h-8 text-emerald-600" />}
      colorClass="bg-emerald-50"
    />,
    <BigStatTile
      label="Total Users"
      value={overview.totalUsers}
      subLabel="all roles combined"
      icon={<Users className="w-8 h-8 text-slate-600" />}
      colorClass="bg-slate-100"
    />,
    <BigStatTile
      label="Active Trials"
      value={overview.trialActive}
      subLabel={overview.trialExpired > 0 ? `${overview.trialExpired} expired` : 'no expired trials'}
      icon={<Hourglass className="w-8 h-8 text-amber-600" />}
      colorClass="bg-amber-50"
      badge={
        overview.trialExpired > 0
          ? { text: `${overview.trialExpired} unconverted`, color: 'bg-amber-100 text-amber-700' }
          : undefined
      }
    />,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Platform Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">Real-time business intelligence across all accounts</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Alerts banner */}
      {hasAlerts && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAlerts((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">
                {overview.expiredUnrenewed + overview.trialExpired} action{overview.expiredUnrenewed + overview.trialExpired !== 1 ? 's' : ''} require attention
              </span>
            </div>
            {showAlerts ? (
              <ChevronUp className="w-4 h-4 text-amber-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-amber-600" />
            )}
          </button>
          {showAlerts && (
            <div className="px-5 pb-4 flex flex-wrap gap-3">
              {overview.expiredUnrenewed > 0 && (
                <div className="bg-white border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{overview.expiredUnrenewed}</p>
                    <p className="text-xs text-slate-500">Expired — not renewed</p>
                  </div>
                </div>
              )}
              {overview.trialExpired > 0 && (
                <div className="bg-white border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <Hourglass className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{overview.trialExpired}</p>
                    <p className="text-xs text-slate-500">Trial expired — unconverted</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 1: Accounts & Users — auto-sliding carousel */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Accounts & Users</p>
        <div className="px-6">
          <StatCarousel autoPlayInterval={4000}>
            {accountUserSlides}
          </StatCarousel>
        </div>
      </div>

      {/* Section 2: Query Health */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Query Health</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PlatformStatCard
            label="Total Queries"
            value={overview.totalQueries}
            subLabel="across all accounts"
            icon={<FileText className="w-5 h-5 text-blue-600" />}
            colorClass="bg-blue-50"
          />
          <PlatformStatCard
            label="Open / Pending"
            value={overview.openQueries}
            subLabel={`${overview.totalQueries > 0 ? Math.round((overview.openQueries / overview.totalQueries) * 100) : 0}% of total`}
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            colorClass="bg-amber-50"
          />
          <PlatformStatCard
            label="Resolved"
            value={overview.resolvedQueries}
            subLabel={`${resolveRate}% resolution rate`}
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            colorClass="bg-emerald-50"
            badge={
              resolveRate >= 80
                ? { text: 'Healthy', color: 'bg-emerald-100 text-emerald-700' }
                : resolveRate >= 50
                ? { text: 'Moderate', color: 'bg-amber-100 text-amber-700' }
                : { text: 'Low', color: 'bg-red-100 text-red-700' }
            }
          />
          <PlatformStatCard
            label="Archived"
            value={overview.archivedQueries}
            icon={<Archive className="w-5 h-5 text-slate-500" />}
            colorClass="bg-slate-100"
          />
        </div>
      </div>

      {/* Section 3: Plan & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlanBreakdown plans={overview.planBreakdown} totalAccounts={overview.totalAccounts} />
        <ActivityLeaderboard accounts={overview.accounts} totalQueries={overview.totalQueries} />
      </div>

      {/* Section 4: Accounts drilldown table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Account Drilldown</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setDrilldownTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
              drilldownTab === 'accounts'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Company / Accounts
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              drilldownTab === 'accounts' ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
            }`}>
              {overview.totalAccounts}
            </span>
          </button>
          <button
            onClick={() => setDrilldownTab('unverified')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
              drilldownTab === 'unverified'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            Unverified Signups
            {overview.unverifiedSignups.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                drilldownTab === 'unverified'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-amber-100 text-amber-600'
              }`}>
                {overview.unverifiedSignups.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setDrilldownTab('others')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
              drilldownTab === 'others'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UsersRound className="w-3.5 h-3.5" />
            Others
            {overview.otherUsers.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                drilldownTab === 'others'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-slate-200 text-slate-500'
              }`}>
                {overview.otherUsers.length}
              </span>
            )}
          </button>
        </div>

        {drilldownTab === 'accounts' ? (
          <AccountsTable
            accounts={overview.accounts}
            totalQueries={overview.totalQueries}
            onSelectAccount={setSelectedAccount}
          />
        ) : drilldownTab === 'unverified' ? (
          <UnverifiedSignupsTable signups={overview.unverifiedSignups} />
        ) : (
          <OtherUsersTable users={overview.otherUsers} />
        )}
      </div>

      {selectedAccount && (
        <AccountOwnerDetailModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </div>
  );
}
