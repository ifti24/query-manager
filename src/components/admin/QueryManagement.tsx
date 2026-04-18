import { useCallback, useEffect, useState } from 'react';
import { supabase, Query } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logUnauthorizedAccess, isUnauthorizedError, buildDescription } from '../../lib/securityAudit';
import { Plus, Trash2, Archive, RotateCcw, X, AlertTriangle, Lock } from 'lucide-react';
import CreateQueryModal from './CreateQueryModal';
import AdminQueryDetail from './AdminQueryDetail';
import { DataGrid, Column } from '../common/DataGrid';
import { TruncatedText } from '../common/TruncatedText';
import { DashboardFilter } from './Dashboard';
import { formatDateTime } from '../../lib/dateFormatter';
import { calculateQueryAge } from '../../lib/queryAge';
import { QueryLimitBanner } from '../common/FeatureLocked';
import { ToastContainer, ToastMessage } from '../common/Toast';

interface QueryWithActivity extends Query {
  lastActivityAt: string | null;
}

interface QueryManagementProps {
  initialFilter?: DashboardFilter;
  onShowPricing?: () => void;
}

export default function QueryManagement({ initialFilter, onShowPricing }: QueryManagementProps) {
  const { user, features } = useAuth();
  const [queries, setQueries] = useState<QueryWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filter, setFilter] = useState<DashboardFilter>(initialFilter || { archived: false });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => [...prev, { ...toast, id: crypto.randomUUID() }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchQueries = async () => {
    if (!user) return;

    try {
      setLoading(true);

      let countQuery = supabase
        .from('queries')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id);

      let dataQuery = supabase
        .from('queries')
        .select('*')
        .eq('created_by', user.id);

      const isArchived = filter.archived === true;

      countQuery = countQuery.eq('archived', isArchived);
      dataQuery = dataQuery.eq('archived', isArchived);

      if (filter.status) {
        countQuery = countQuery.eq('status', filter.status);
        dataQuery = dataQuery.eq('status', filter.status);
      }

      const { count } = await countQuery;
      const { data } = await dataQuery
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      const queryIds = (data || []).map((q) => q.id);

      let responsesByQuery = new Map<string, string>();
      let commentsByQuery = new Map<string, string>();

      if (queryIds.length > 0) {
        const [{ data: allResponses }, { data: allComments }] = await Promise.all([
          supabase
            .from('query_responses')
            .select('query_id, created_at')
            .in('query_id', queryIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('query_comments')
            .select('query_id, created_at')
            .in('query_id', queryIds)
            .order('created_at', { ascending: false }),
        ]);

        (allResponses || []).forEach((r) => {
          if (!responsesByQuery.has(r.query_id)) {
            responsesByQuery.set(r.query_id, r.created_at);
          }
        });
        (allComments || []).forEach((c) => {
          if (!commentsByQuery.has(c.query_id)) {
            commentsByQuery.set(c.query_id, c.created_at);
          }
        });
      }

      const queriesWithActivity: QueryWithActivity[] = (data || []).map((query) => {
        const latestResponse = responsesByQuery.get(query.id) ?? null;
        const latestComment = commentsByQuery.get(query.id) ?? null;

        let lastActivityAt: string | null = null;
        if (latestResponse && latestComment) {
          lastActivityAt = new Date(latestResponse) > new Date(latestComment)
            ? latestResponse
            : latestComment;
        } else if (latestResponse) {
          lastActivityAt = latestResponse;
        } else if (latestComment) {
          lastActivityAt = latestComment;
        }

        return {
          ...query,
          lastActivityAt,
        };
      });

      setQueries(queriesWithActivity);
      setTotalRecords(count || 0);
    } catch (error) {
      console.error('Error fetching queries:', error);
      const err = error as { message?: string; code?: string };
      if (isUnauthorizedError(err)) {
        logUnauthorizedAccess({
          user_id: user?.id,
          service_context: 'queries:fetchQueries',
          description: buildDescription('queries', err),
          error_code: err.code,
          error_message: err.message,
          metadata: { filter },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, [user, filter, currentPage, pageSize]);

  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter);
      setCurrentPage(1);
    }
  }, [initialFilter]);

  const handleDeleteQuery = async (queryId: string) => {
    if (!confirm('Are you sure you want to delete this query?')) return;

    try {
      await supabase.from('queries').delete().eq('id', queryId);
      fetchQueries();
    } catch (error) {
      console.error('Error deleting query:', error);
    }
  };

  const handleArchiveQuery = async (queryId: string) => {
    try {
      await supabase
        .from('queries')
        .update({ archived: true })
        .eq('id', queryId);
      fetchQueries();
    } catch (error) {
      console.error('Error archiving query:', error);
    }
  };

  const handleRestoreQuery = async (queryId: string) => {
    try {
      await supabase
        .from('queries')
        .update({ archived: false, status: 'pending' })
        .eq('id', queryId);
      fetchQueries();
    } catch (error) {
      console.error('Error restoring query:', error);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      answered: 'bg-green-50 text-green-700 border-green-200',
      done: 'bg-blue-50 text-blue-700 border-blue-200',
      archived: 'bg-slate-50 text-slate-700 border-slate-200',
    };
    return styles[status] || styles.pending;
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    answered: 'Answered',
    done: 'Done',
    archived: 'Archived',
  };

  const priorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      high: 'bg-red-50 text-red-700',
      normal: 'bg-slate-50 text-slate-700',
      low: 'bg-green-50 text-green-700',
    };
    return styles[priority] || styles.normal;
  };

  const handleSelectQuery = (query: Query) => {
    setSelectedQueryId(query.id);
  };

  const handleCloseDetail = () => {
    setSelectedQueryId(null);
    fetchQueries();
  };

  const columns: Column<Query>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (query) => (
        <div className="flex items-start gap-2">
          <button
            onClick={() => handleSelectQuery(query)}
            className="text-left font-medium text-slate-900 hover:text-blue-600 transition-colors flex-1 min-w-0"
          >
            <TruncatedText text={query.title} maxLines={2} spanFullRow={true} />
          </button>
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
      ),
      width: '30%',
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
      width: '12%',
    },
    {
      key: 'age',
      header: 'Age',
      render: (query) => (
        <span className="text-slate-600 text-sm">
          {calculateQueryAge(query.created_at, query.lastActivityAt).ageFromCreation}
        </span>
      ),
      width: '8%',
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
      width: '12%',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (query) => (
        <div className="flex justify-end gap-2">
          {(filter.archived || (query as any).archived) ? (
            <button
              onClick={() => handleRestoreQuery(query.id)}
              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
              title="Restore"
            >
              <RotateCcw className="w-4 h-4 text-blue-600" />
            </button>
          ) : (
            <button
              onClick={() => handleArchiveQuery(query.id)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Archive"
            >
              <Archive className="w-4 h-4 text-slate-600" />
            </button>
          )}
          <button
            onClick={() => handleDeleteQuery(query.id)}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      ),
      width: '25%',
    },
  ];

  const atQueryLimit = features.queriesLimit !== null && features.queriesUsed >= features.queriesLimit;

  return (
    <div className="space-y-6">
      {features.queriesLimit !== null && (
        <QueryLimitBanner
          used={features.queriesUsed}
          limit={features.queriesLimit}
          onUpgrade={onShowPricing}
        />
      )}
      <div className="flex gap-4 items-center justify-between flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setFilter({ archived: false });
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              !filter.status && !filter.archived
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Active
          </button>
          {(['pending', 'answered', 'done'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilter({ status, archived: false });
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter.status === status && !filter.archived
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {statusLabels[status]}
            </button>
          ))}
          <button
            onClick={() => {
              setFilter({ archived: true });
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter.archived
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Archived
          </button>
        </div>
        {atQueryLimit ? (
          <button
            onClick={onShowPricing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-500 rounded-lg cursor-not-allowed"
            title="Query limit reached — upgrade to create more"
          >
            <Lock className="w-4 h-4" />
            Query Limit Reached
          </button>
        ) : (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Query
          </button>
        )}
      </div>

      {showCreateModal && (
        <CreateQueryModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchQueries();
          }}
          onToast={addToast}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex gap-6 min-h-[calc(100vh-20rem)]">
        {!selectedQueryId && (
          <div className="w-full transition-all duration-300">
            <DataGrid
              data={queries}
              columns={columns}
              currentPage={currentPage}
              pageSize={pageSize}
              totalRecords={totalRecords}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              isLoading={loading}
            />
          </div>
        )}

        {selectedQueryId && (
          <div className="w-full transition-all duration-300">
            <div className="bg-white rounded-lg border border-slate-200 h-full flex flex-col">
              <div className="border-b border-slate-200 p-4 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-semibold text-slate-900">Query Details</h2>
                <button
                  onClick={handleCloseDetail}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <AdminQueryDetail queryId={selectedQueryId} onClose={handleCloseDetail} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
