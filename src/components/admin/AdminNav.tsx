import { BarChart3, FileText, Users, Settings } from 'lucide-react';

type AdminTab = 'dashboard' | 'queries' | 'team' | 'settings';

interface AdminNavProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export default function AdminNav({ activeTab, onTabChange }: AdminNavProps) {
  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'queries', label: 'Queries', icon: <FileText className="w-5 h-5" /> },
    { id: 'team', label: 'Team Members', icon: <Users className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

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
