import { useEffect, useState } from 'react';
import { supabase, Query, QueryAssignment } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { TruncatedText } from '../common/TruncatedText';
import { formatDateTime } from '../../lib/dateFormatter';

interface QueryListProps {
  onSelectQuery: (queryId: string) => void;
  selectedQueryId: string | null;
  filter: 'all' | 'pending' | 'answered' | 'done' | 'archived';
  onFilterChange: (filter: 'all' | 'pending' | 'answered' | 'done' | 'archived') => void;
}

export default function QueryList({ onSelectQuery, selectedQueryId, filter, onFilterChange }: QueryListProps) {
  const { user } = useAuth();
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueries = async () => {
    if (!user) return;

    try {
      const { data: assignments } = await supabase
        .from('query_assignments')
        .select('*, queries(*)')
        .eq('assigned_to', user.id);

      if (assignments) {
        let queries = assignments.map((a: any) => a.queries).filter(Boolean);

        if (filter === 'all') {
          queries = queries.filter((q: any) => q.status !== 'archived');
        } else if (filter === 'pending') {
          queries = queries.filter((q: any) => q.status === 'pending');
        } else if (filter === 'answered') {
          queries = queries.filter((q: any) => q.status === 'answered');
        } else if (filter === 'done') {
          queries = queries.filter((q: any) => q.status === 'done');
        } else if (filter === 'archived') {
          queries = queries.filter((q: any) => q.status === 'archived');
        }

        setQueries(queries);
      }
    } catch (error) {
      console.error('Error fetching queries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchQueries();
  }, [user, filter]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <p className="text-slate-600">Loading queries...</p>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    all: 'All',
    pending: 'Pending',
    answered: 'Answered',
    done: 'Done',
    archived: 'Archived',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'answered', 'done', 'archived'] as const).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {statusLabels[f]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {queries.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
            <p className="text-slate-600">No queries found</p>
          </div>
        ) : (
          queries.map((query) => (
            <button
              key={query.id}
              onClick={() => onSelectQuery(query.id)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                selectedQueryId === query.id
                  ? 'bg-slate-100 border-slate-800'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <TruncatedText
                        text={query.title}
                        className="font-semibold text-slate-900"
                        maxLines={2}
                      />
                    </div>
                    {query.consecutive_admin_comments >= 3 && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1 flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Super Urgent
                      </span>
                    )}
                    {query.consecutive_admin_comments === 2 && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 flex items-center gap-1 flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-sm mt-1 line-clamp-2">
                    {query.description}
                  </p>
                  <p className="text-slate-500 text-xs mt-2">
                    {formatDateTime(query.created_at)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {query.status === 'answered' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : query.status === 'done' ? (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
