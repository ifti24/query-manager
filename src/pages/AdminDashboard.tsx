import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../lib/auth';
import AdminNav from '../components/admin/AdminNav';
import QueryManagement from '../components/admin/QueryManagement';
import AdminSettings from '../components/admin/AdminSettings';
import TeamManagement from '../components/admin/TeamManagement';
import SubscriptionPanel from '../components/admin/SubscriptionPanel';
import ProfileSettings from '../components/admin/ProfileSettings';
import AuditLog from '../components/admin/AuditLog';
import PlatformDashboard from '../components/admin/platform/PlatformDashboard';
import PlatformUsersTab from '../components/admin/platform/PlatformUsersTab';
import { RoleSwitcherDropdown } from '../components/common/RoleSwitcher';

type AdminTab = 'queries' | 'team' | 'settings' | 'subscription' | 'profile' | 'audit-log' | 'platform' | 'platform-users';

interface AdminDashboardProps {
  onShowPricing?: () => void;
}

function getAdminSubline(activeRole: import('../lib/supabase').ActiveRoleType | null): string {
  if (!activeRole) return 'Dashboard';
  if (activeRole.type === 'platform') {
    return activeRole.role === 'super_admin' ? 'Super Admin Dashboard' : 'Support Dashboard';
  }
  if (activeRole.role === 'account_owner') return 'Account Owner Dashboard';
  if (activeRole.role === 'supervisor') return 'Supervisor Dashboard';
  return 'Dashboard';
}

export default function AdminDashboard({ onShowPricing }: AdminDashboardProps) {
  const { profile, activeRole, isPlatformAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>(isPlatformAdmin ? 'platform' : 'queries');
  const [queryFilter] = useState<{ status?: string } | undefined>();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      window.location.replace(window.location.origin + '/');
      setTimeout(() => window.location.reload(), 50);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">QueryPing</h1>
            <p className="text-slate-600 text-sm mt-1">{getAdminSubline(activeRole)}</p>
          </div>
          <div className="flex items-center gap-3">
            <RoleSwitcherDropdown />
            <div className="text-right hidden sm:block">
              <p className="text-slate-900 font-medium">{profile?.full_name}</p>
              <p className="text-slate-600 text-sm">{profile?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminNav activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="mt-8">
          {activeTab === 'queries' && <QueryManagement initialFilter={queryFilter} onShowPricing={onShowPricing} />}
          {activeTab === 'team' && <TeamManagement onShowPricing={onShowPricing} />}
          {activeTab === 'settings' && <AdminSettings onShowPricing={onShowPricing} />}
          {activeTab === 'subscription' && (
            <SubscriptionPanel onShowPricing={onShowPricing} />
          )}
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'audit-log' && <AuditLog />}
          {activeTab === 'platform' && <PlatformDashboard />}
          {activeTab === 'platform-users' && <PlatformUsersTab />}
        </div>
      </div>
    </div>
  );
}
