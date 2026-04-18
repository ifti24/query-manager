import { useEffect, useState } from 'react';
import { LogOut, AlertTriangle, Users, FileText, BarChart3, Settings, CircleUser as UserCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../lib/auth';
import { supabase, Query } from '../lib/supabase';
import { DataGrid, Column } from '../components/common/DataGrid';
import { formatDateTime } from '../lib/dateFormatter';
import { calculateQueryAge } from '../lib/queryAge';
import QueryDetail from '../components/team/QueryDetail';
import MySupervisorsTab from '../components/team/MySupervisorsTab';
import MemberDashboard from '../components/team/MemberDashboard';
import MemberSettings, { getMemberLandingPage } from '../components/team/MemberSettings';
import ProfileSettings from '../components/admin/ProfileSettings';
import { RoleSwitcherDropdown } from '../components/common/RoleSwitcher';

interface QueryWithActivity extends Query {
  lastActivityAt: string | null;
}

type PortalTab = 'dashboard' | 'queries' | 'my-supervisors' | 'profile' | 'settings';

export default function TeamMemberPortal() {
  const { profile, user, activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState<PortalTab>(getMemberLandingPage() === 'queries' ? 'queries' : 'dashboard');
  const [queries, setQueries] = useState<QueryWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'answered' | 'done' | 'archived'>('pending');
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchQueries = async () => {
    if (!user) return;

    try {
      setLoading(true);

      let countQuery = supabase
        .from('query_assignments')
        .select('*, queries!inner(*)', { count: 'exact', head: true })
        .eq('assigned_to', user.id);

      let dataQuery = supabase
        .from('query_assignments')
        .select('*, queries!inner(*)')
        .eq('assigned_to', user.id);

      if (filter === 'all') {
        countQuery = countQuery.eq('queries.archived', false);
        dataQuery = dataQuery.eq('queries.archived', false);
      } else if (filter === 'pending') {
        countQuery = countQuery.eq('queries.status', 'pending');
        dataQuery = dataQuery.eq('queries.status', 'pending');
      } else if (filter === 'answered') {
        countQuery = countQuery.eq('queries.status', 'answered');
        dataQuery = dataQuery.eq('queries.status', 'answered');
      } else if (filter === 'done') {
        countQuery = countQuery.eq('queries.status', 'done');
        dataQuery = dataQuery.eq('queries.status', 'done');
      } else if (filter === 'archived') {
        countQuery = countQuery.eq('queries.status', 'archived');
        dataQuery = dataQuery.eq('queries.status', 'archived');
      }

      const { count } = await countQuery;
      const { data: assignments } = await dataQuery
        .order('created_at', { ascending: false, referencedTable: 'queries' })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (assignments) {
        const queriesData = assignments.map((a: any) => a.queries).filter(Boolean);

        const queriesWithActivity: QueryWithActivity[] = await Promise.all(
          queriesData.map(async (query: Query) => {
            const { data: responses } = await supabase
              .from('query_responses')
              .select('created_at')
              .eq('query_id', query.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const { data: comments } = await supabase
              .from('query_comments')
              .select('created_at')
              .eq('query_id', query.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            let lastActivityAt: string | null = null;
            if (responses && comments) {
              lastActivityAt = new Date(responses.created_at) > new Date(comments.created_at)
                ? responses.created_at
                : comments.created_at;
            } else if (responses) {
              lastActivityAt = responses.created_at;
            } else if (comments) {
              lastActivityAt = comments.created_at;
            }

            return { ...query, lastActivityAt };
          })
        );

        const sorted = queriesWithActivity.sort((a, b) => {
          const aTime = a.lastActivityAt ?? a.created_at;
          const bTime = b.lastActivityAt ?? b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
        setQueries(sorted);
      }

      setTotalRecords(count || 0);
    } catch (error) {
      console.error('Error fetching queries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'queries') {
      fetchQueries();
    }
  }, [user, filter, currentPage, pageSize, activeTab]);

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

  const handleSelectQuery = (query: Query) => {
    setSelectedQueryId(query.id);
  };

  const handleCloseDetail = (switchToTab?: string) => {
    setSelectedQueryId(null);
    if (switchToTab && ['all', 'pending', 'answered', 'done', 'archived'].includes(switchToTab)) {
      setFilter(switchToTab as 'all' | 'pending' | 'answered' | 'done' | 'archived');
      setCurrentPage(1);
    }
    fetchQueries();
  };

  const handleDashboardFilter = (f: string) => {
    setFilter(f as 'all' | 'pending' | 'answered' | 'done' | 'archived');
    setCurrentPage(1);
    setActiveTab('queries');
  };

  const statusBadge = (status: string) => {
    const styles = {
      pending: 'border-amber-200 bg-amber-50 text-amber-700',
      answered: 'border-green-200 bg-green-50 text-green-700',
      done: 'border-blue-200 bg-blue-50 text-blue-700',
      archived: 'border-slate-200 bg-slate-50 text-slate-700',
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const priorityBadge = (priority: string) => {
    const styles = {
      urgent: 'bg-red-50 text-red-700',
      high: 'bg-red-50 text-red-700',
      normal: 'bg-slate-50 text-slate-700',
      low: 'bg-green-50 text-green-700',
    };
    return styles[priority as keyof typeof styles] || styles.normal;
  };

  const statusLabels: Record<string, string> = {
    all: 'All',
    pending: 'Pending',
    answered: 'Answered',
    done: 'Done',
    archived: 'Archived',
  };

  const columns: Column<Query>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (query) => (
        <button
          onClick={() => handleSelectQuery(query)}
          className="text-left font-medium text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-2"
        >
          {query.title}
          {query.is_urgent && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1 flex-shrink-0">
              <AlertTriangle className="w-3 h-3" />
              Urgent
            </span>
          )}
        </button>
      ),
      width: '35%',
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (query) =>
        query.show_priority ? (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityBadge(query.priority)}`}>
            {query.priority.charAt(0).toUpperCase() + query.priority.slice(1)}
          </span>
        ) : null,
      width: '15%',
    },
    {
      key: 'status',
      header: 'Status',
      render: (query) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusBadge(query.status)}`}>
          {statusLabels[query.status] || query.status}
        </span>
      ),
      width: '15%',
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (query) => (
        <span className="text-slate-600 text-sm">{formatDateTime(query.created_at)}</span>
      ),
      width: '15%',
    },
    {
      key: 'age',
      header: 'Age',
      render: (query) => (
        <span className="text-slate-600 text-sm">
          {calculateQueryAge(query.created_at, query.lastActivityAt).ageFromCreation}
        </span>
      ),
      width: '10%',
    },
    {
      key: 'last_activity',
      header: 'Last Activity',
      render: (query) => (
        <span className="text-slate-600 text-sm">
          {query.lastActivityAt
            ? `${calculateQueryAge(query.created_at, query.lastActivityAt).ageFromLastActivity} ago`
            : 'No activity'
          }
        </span>
      ),
      width: '15%',
    },
  ];

  const navTabs: { id: PortalTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'queries', label: 'My Queries', icon: <FileText className="w-5 h-5" /> },
    { id: 'my-supervisors', label: 'My Supervisors', icon: <Users className="w-5 h-5" /> },
    { id: 'profile', label: 'My Profile', icon: <UserCircle className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">QueryPing</h1>
            <p className="text-slate-600 text-sm mt-1">
              {activeRole?.type === 'account' && activeRole.role === 'supervisor'
                ? 'Supervisor Dashboard'
                : 'Member Dashboard'}
            </p>
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
        <div className="flex gap-2 border-b border-slate-200 overflow-x-auto mb-8">
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedQueryId(null);
              }}
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

        {activeTab === 'dashboard' && (
          <MemberDashboard onFilterChange={handleDashboardFilter} />
        )}

        {activeTab === 'my-supervisors' && <MySupervisorsTab />}

        {activeTab === 'profile' && <ProfileSettings />}

        {activeTab === 'settings' && <MemberSettings />}

        {activeTab === 'queries' && (
          <div className="flex gap-6">
            {!selectedQueryId && (
              <div className="w-full transition-all duration-300">
                <div className="bg-white rounded-lg border border-slate-200">
                  <div className="border-b border-slate-200 p-4">
                    <div className="flex gap-2 flex-wrap">
                      {(['all', 'pending', 'answered', 'done', 'archived'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setFilter(f);
                            setCurrentPage(1);
                          }}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                            filter === f
                              ? 'bg-slate-800 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {statusLabels[f]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <DataGrid
                    data={queries}
                    columns={columns}
                    isLoading={loading}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalRecords={totalRecords}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
            )}

            {selectedQueryId && (
              <div className="w-full transition-all duration-300">
                <QueryDetail queryId={selectedQueryId} onClose={handleCloseDetail} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
