import { useEffect, useState } from 'react';
import { FileText, Clock, BarChart3, CheckCircle, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logUnauthorizedAccess, isUnauthorizedError, buildDescription } from '../../lib/securityAudit';

interface MemberStats {
  totalAssigned: number;
  pending: number;
  answered: number;
  done: number;
  myAssigned: number;
  myAnswered: number;
  myPending: number;
}

interface MemberDashboardProps {
  onFilterChange?: (filter: string) => void;
}

export default function MemberDashboard({ onFilterChange }: MemberDashboardProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<MemberStats>({
    totalAssigned: 0,
    pending: 0,
    answered: 0,
    done: 0,
    myAssigned: 0,
    myAnswered: 0,
    myPending: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const { data: assignments } = await supabase
          .from('query_assignments')
          .select('id, queries!inner(id, status, archived)')
          .eq('assigned_to', user.id)
          .eq('queries.archived', false);

        const allAssignments = assignments || [];
        const assignmentIds = allAssignments.map((a: any) => a.id);

        let myAnswered = 0;
        if (assignmentIds.length > 0) {
          const { data: responses } = await supabase
            .from('query_responses')
            .select('assignment_id')
            .in('assignment_id', assignmentIds);
          const respondedSet = new Set((responses || []).map((r: any) => r.assignment_id));
          myAnswered = respondedSet.size;
        }

        const total = allAssignments.length;
        const pending = allAssignments.filter((a: any) => a.queries?.status === 'pending').length;
        const answered = allAssignments.filter((a: any) => a.queries?.status === 'answered').length;
        const done = allAssignments.filter((a: any) => a.queries?.status === 'done').length;

        setStats({
          totalAssigned: total,
          pending,
          answered,
          done,
          myAssigned: total,
          myAnswered,
          myPending: total - myAnswered,
        });
      } catch (err) {
        console.error('Error fetching member stats:', err);
        const e = err as { message?: string; code?: string };
        if (isUnauthorizedError(e)) {
          logUnauthorizedAccess({
            user_id: user?.id,
            service_context: 'query_assignments:fetch',
            description: buildDescription('query_assignments:fetch', e),
            error_code: e.code,
            error_message: e.message,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const responseRate = stats.myAssigned > 0 ? Math.round((stats.myAnswered / stats.myAssigned) * 100) : 0;

  const StatCard = ({
    icon,
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
        <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center py-12 text-slate-400 text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-6 h-6 text-blue-600" />}
          label="Total Assigned"
          value={stats.totalAssigned}
          color="bg-blue-50"
          onClick={() => onFilterChange?.('all')}
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-amber-600" />}
          label="Pending"
          value={stats.pending}
          color="bg-amber-50"
          onClick={() => onFilterChange?.('pending')}
        />
        <StatCard
          icon={<BarChart3 className="w-6 h-6 text-teal-600" />}
          label="Answered"
          value={stats.answered}
          color="bg-teal-50"
          onClick={() => onFilterChange?.('answered')}
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          label="Done"
          value={stats.done}
          color="bg-green-50"
          onClick={() => onFilterChange?.('done')}
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">My Response Rate</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Assigned</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Responded</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Pending Response</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Response Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="px-6 py-4 text-slate-600 font-medium">{stats.myAssigned}</td>
                <td className="px-6 py-4 text-green-600 font-medium">{stats.myAnswered}</td>
                <td className="px-6 py-4 text-amber-600 font-medium">{stats.myPending}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${responseRate}%` }}
                      />
                    </div>
                    <span className="text-slate-900 font-semibold text-sm">{responseRate}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          {stats.myAssigned === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">No queries assigned yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
