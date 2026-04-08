import { useState } from 'react';
import { LogOut, Plus, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../lib/auth';
import AdminNav from '../components/admin/AdminNav';
import QueryManagement from '../components/admin/QueryManagement';
import AdminSettings from '../components/admin/AdminSettings';
import Dashboard, { DashboardFilter } from '../components/admin/Dashboard';
import TeamManagement from '../components/admin/TeamManagement';

type AdminTab = 'dashboard' | 'queries' | 'team' | 'settings';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [queryFilter, setQueryFilter] = useState<DashboardFilter | undefined>();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Query Manager</h1>
            <p className="text-slate-600 text-sm mt-1">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
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
          {activeTab === 'dashboard' && (
            <Dashboard
              onFilterChange={(filter) => {
                setQueryFilter(filter);
                setActiveTab('queries');
              }}
            />
          )}
          {activeTab === 'queries' && <QueryManagement initialFilter={queryFilter} />}
          {activeTab === 'team' && <TeamManagement />}
          {activeTab === 'settings' && <AdminSettings />}
        </div>
      </div>
    </div>
  );
}
