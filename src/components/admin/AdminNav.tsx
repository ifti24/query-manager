import { FileText, Users, Settings, CreditCard, CircleUser as UserCircle, ShieldAlert, Globe } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type AdminTab = 'queries' | 'team' | 'settings' | 'subscription' | 'profile' | 'audit-log' | 'platform' | 'platform-users';

interface AdminNavProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export default function AdminNav({ activeTab, onTabChange }: AdminNavProps) {
  const { isPlatformAdmin, isAccountOwner, isSupervisor } = useAuth();

  const allTabs: { id: AdminTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    {
      id: 'platform',
      label: 'Platform Overview',
      icon: <Globe className="w-5 h-5" />,
      show: isPlatformAdmin,
    },
    {
      id: 'platform-users',
      label: 'Users',
      icon: <Users className="w-5 h-5" />,
      show: isPlatformAdmin,
    },
    {
      id: 'queries',
      label: 'Queries',
      icon: <FileText className="w-5 h-5" />,
      show: isAccountOwner || isSupervisor,
    },
    {
      id: 'team',
      label: 'Team Members',
      icon: <Users className="w-5 h-5" />,
      show: isAccountOwner || isSupervisor,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      show: isAccountOwner || isPlatformAdmin,
    },
    {
      id: 'subscription',
      label: 'Subscription',
      icon: <CreditCard className="w-5 h-5" />,
      show: isAccountOwner,
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: <UserCircle className="w-5 h-5" />,
      show: isAccountOwner || isPlatformAdmin,
    },
    {
      id: 'audit-log',
      label: 'Audit Log',
      icon: <ShieldAlert className="w-5 h-5" />,
      show: isPlatformAdmin,
    },
  ];

  const tabs = allTabs.filter(t => t.show);

  return (
    <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === tab.id
              ? 'border-slate-800 text-slate-900 font-medium'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
