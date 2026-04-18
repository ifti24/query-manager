import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, CheckCircle, Clock, BarChart3, Archive } from 'lucide-react';
import { FeatureLocked } from '../common/FeatureLocked';

interface DashboardStats {
  totalQueries: number;
  pendingQueries: number;
  answeredQueries: number;
  completedQueries: number;
  archivedQueries: number;
  teamResponseMetrics: {
    name: string;
    assigned: number;
    answered: number;
    pending: number;
  }[];
}

export interface DashboardFilter {
  status?: string;
  archived?: boolean;
}

interface DashboardProps {
  onFilterChange?: (filter: DashboardFilter) => void;
  onShowPricing?: () => void;
}

export default function Dashboard({ onFilterChange, onShowPricing }: DashboardProps) {
  const { user, features, isAccountOwner, isSupervisor } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalQueries: 0,
    pendingQueries: 0,
    answeredQueries: 0,
    completedQueries: 0,
    archivedQueries: 0,
    teamResponseMetrics: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        const { data: queries } = await supabase
          .from('queries')
          .select('*')
          .eq('created_by', user.id);

        const queryIds = queries?.map((q) => q.id) || [];

        let supervisedMemberIds: string[] | null = null;
        if (isSupervisor && !isAccountOwner) {
          const { data: supervised } = await supabase
            .from('profiles')
            .select('id')
            .eq('supervisor_id', user.id);
          supervisedMemberIds = (supervised || []).map((p: any) => p.id);
        }

        let matrixAssignments: any[] = [];
        let matrixRespondedIds = new Set<string>();

        if (supervisedMemberIds !== null) {
          if (supervisedMemberIds.length > 0) {
            const [aRes, rRes] = await Promise.all([
              supabase
                .from('query_assignments')
                .select('id, query_id, assigned_to, profiles:assigned_to(*)')
                .in('assigned_to', supervisedMemberIds),
              supabase
                .from('query_responses')
                .select('assignment_id'),
            ]);
            matrixAssignments = aRes.data || [];
            matrixRespondedIds = new Set((rRes.data || []).map((r: any) => r.assignment_id));
          }
        } else if (queryIds.length > 0) {
          const [aRes, rRes] = await Promise.all([
            supabase
              .from('query_assignments')
              .select('id, query_id, assigned_to, profiles:assigned_to(*)')
              .in('query_id', queryIds),
            supabase
              .from('query_responses')
              .select('assignment_id')
              .in('query_id', queryIds),
          ]);
          matrixAssignments = aRes.data || [];
          matrixRespondedIds = new Set((rRes.data || []).map((r: any) => r.assignment_id));
        }

        const assignments = matrixAssignments;
        const respondedAssignmentIds = matrixRespondedIds;

        const activeQueries = queries?.filter((q: any) => !q.archived) || [];
        const archivedQueries = queries?.filter((q: any) => q.archived) || [];

        const stats: DashboardStats = {
          totalQueries: activeQueries.length,
          pendingQueries: activeQueries.filter((q: any) => q.status === 'pending').length,
          answeredQueries: activeQueries.filter((q: any) => q.status === 'answered').length,
          completedQueries: activeQueries.filter((q: any) => q.status === 'completed').length,
          archivedQueries: archivedQueries.length,
          teamResponseMetrics: [],
        };

        const metricsMap = new Map<
          string,
          { name: string; assigned: number; answered: number; pending: number }
        >();

        const filteredAssignments = assignments;

        filteredAssignments.forEach((assignment: any) => {
          const key = assignment.assigned_to;
          if (!metricsMap.has(key)) {
            metricsMap.set(key, {
              name: assignment.profiles?.full_name || assignment.profiles?.email || 'Unknown',
              assigned: 0,
              answered: 0,
              pending: 0,
            });
          }
          const metric = metricsMap.get(key)!;
          metric.assigned++;
          if (respondedAssignmentIds.has(assignment.id)) {
            metric.answered++;
          } else {
            metric.pending++;
          }
        });

        stats.teamResponseMetrics = Array.from(metricsMap.values());
        setStats(stats);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, isAccountOwner, isSupervisor]);

  const StatCard = ({
    icon: Icon,
    label,
    value,
    color,
    onClick,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: string;
    onClick?: () => void;
  }) => (
    <div
      className={`bg-white rounded-lg border border-slate-200 p-6 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-600 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>{Icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<FileText className="w-6 h-6 text-blue-600" />}
          label="Total Queries"
          value={stats.totalQueries}
          color="bg-blue-50"
          onClick={() => onFilterChange?.({ archived: false })}
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-amber-600" />}
          label="Pending"
          value={stats.pendingQueries}
          color="bg-amber-50"
          onClick={() => onFilterChange?.({ status: 'pending', archived: false })}
        />
        <StatCard
          icon={<BarChart3 className="w-6 h-6 text-teal-600" />}
          label="Answered"
          value={stats.answeredQueries}
          color="bg-teal-50"
          onClick={() => onFilterChange?.({ status: 'answered', archived: false })}
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          label="Completed"
          value={stats.completedQueries}
          color="bg-green-50"
          onClick={() => onFilterChange?.({ status: 'completed', archived: false })}
        />
        <StatCard
          icon={<Archive className="w-6 h-6 text-gray-600" />}
          label="Archived"
          value={stats.archivedQueries}
          color="bg-gray-50"
          onClick={() => onFilterChange?.({ archived: true })}
        />
      </div>

      {features.hasReports && isSupervisor ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Team Response Metrics</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Team Member</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Assigned</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Answered</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Pending</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Response Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.teamResponseMetrics.map((metric) => {
                  const responseRate =
                    metric.assigned > 0
                      ? Math.round((metric.answered / metric.assigned) * 100)
                      : 0;
                  return (
                    <tr key={metric.name} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 text-slate-900 font-medium">{metric.name}</td>
                      <td className="px-6 py-4 text-slate-600">{metric.assigned}</td>
                      <td className="px-6 py-4 text-green-600 font-medium">{metric.answered}</td>
                      <td className="px-6 py-4 text-amber-600 font-medium">{metric.pending}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 transition-all" style={{ width: `${responseRate}%` }} />
                          </div>
                          <span className="text-slate-900 font-medium text-sm">{responseRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {stats.teamResponseMetrics.length === 0 && (
              <div className="text-center py-8 text-slate-600">No queries assigned yet</div>
            )}
          </div>
        </div>
      ) : !features.hasReports && isSupervisor ? (
        <div>
          <div className="px-0 py-3 mb-2">
            <h3 className="text-lg font-semibold text-slate-900">Team Response Metrics</h3>
          </div>
          <FeatureLocked
            featureName="Reports & Analytics"
            requiredPlan="Basic"
            onUpgrade={onShowPricing}
          />
        </div>
      ) : null}
    </div>
  );
}
