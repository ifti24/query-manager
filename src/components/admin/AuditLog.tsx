import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DataGrid, Column } from '../common/DataGrid';
import { formatDateTime } from '../../lib/dateFormatter';
import { ShieldAlert, RefreshCw, Info } from 'lucide-react';
import type { ViolationType } from '../../lib/securityAudit';

interface SecurityAuditLog {
  id: string;
  user_id: string | null;
  service_context: string;
  attempted_at: string;
  description: string;
  violation_type: ViolationType;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

const VIOLATION_BADGE: Record<ViolationType, { label: string; classes: string }> = {
  expired_token: {
    label: 'Expired Token',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  permission_denied: {
    label: 'Permission Denied',
    classes: 'bg-red-50 text-red-700 border-red-200',
  },
  invalid_credentials: {
    label: 'Invalid Credentials',
    classes: 'bg-red-50 text-red-700 border-red-200',
  },
  rls_violation: {
    label: 'RLS Violation',
    classes: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  unknown: {
    label: 'Unknown',
    classes: 'bg-slate-50 text-slate-600 border-slate-200',
  },
};

export default function AuditLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: fetchError, count } = await supabase
        .from('security_audit_log')
        .select('*', { count: 'exact' })
        .order('attempted_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      setLogs(data ?? []);
      setTotalRecords(count ?? 0);
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message ?? 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [user, currentPage, pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setExpandedId(null);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setExpandedId(null);
  };

  const columns: Column<SecurityAuditLog>[] = [
    {
      key: 'attempted_at',
      header: 'Date & Time',
      width: '13%',
      render: (item) => (
        <span className="text-slate-700 text-xs whitespace-nowrap font-mono">
          {formatDateTime(item.attempted_at)}
        </span>
      ),
    },
    {
      key: 'violation_type',
      header: 'Violation Type',
      width: '14%',
      render: (item) => {
        const vt = (item.violation_type ?? 'unknown') as ViolationType;
        const badge = VIOLATION_BADGE[vt] ?? VIOLATION_BADGE.unknown;
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${badge.classes}`}>
            {badge.label}
          </span>
        );
      },
    },
    {
      key: 'service_context',
      header: 'Service Context',
      width: '15%',
      render: (item) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
          {item.service_context}
        </span>
      ),
    },
    {
      key: 'user_id',
      header: 'User ID',
      width: '16%',
      render: (item) => (
        item.user_id ? (
          <span className="text-xs font-mono text-slate-600 break-all">{item.user_id}</span>
        ) : (
          <span className="text-xs text-slate-400 italic">anonymous</span>
        )
      ),
    },
    {
      key: 'description',
      header: 'Description',
      width: '32%',
      render: (item) => (
        <div className="space-y-1">
          <p className="text-sm text-slate-800 leading-snug">{item.description}</p>
          {item.error_code && (
            <span className="inline-block text-xs font-mono text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
              {item.error_code}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      width: '10%',
      render: (item) => (
        item.metadata || item.error_message ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId(prev => prev === item.id ? null : item.id);
            }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            {expandedId === item.id ? 'Hide' : 'View'}
          </button>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )
      ),
    },
  ];

  const expandedLog = expandedId ? logs.find(l => l.id === expandedId) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Unauthorized Access Log</h2>
            <p className="text-sm text-slate-500">All detected unauthorized access attempts, ordered by most recent</p>
          </div>
        </div>
        <button
          onClick={() => { setCurrentPage(1); fetchLogs(); }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-500 mr-1">Violation types:</span>
        {(Object.entries(VIOLATION_BADGE) as [ViolationType, (typeof VIOLATION_BADGE)[ViolationType]][]).map(([key, val]) => (
          <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${val.classes}`}>
            {val.label}
          </span>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {expandedLog && (
        <div className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono space-y-2 border border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 uppercase tracking-wider text-[10px]">
              Detail View — {expandedLog.service_context} — {VIOLATION_BADGE[expandedLog.violation_type ?? 'unknown']?.label}
            </span>
            <button onClick={() => setExpandedId(null)} className="text-slate-400 hover:text-slate-200 text-xs">close</button>
          </div>
          {expandedLog.error_message && (
            <div>
              <span className="text-slate-400">error_message: </span>
              <span className="text-rose-300">{expandedLog.error_message}</span>
            </div>
          )}
          {expandedLog.metadata && (
            <div>
              <span className="text-slate-400">metadata: </span>
              <span className="text-emerald-300">{JSON.stringify(expandedLog.metadata, null, 2)}</span>
            </div>
          )}
          <div>
            <span className="text-slate-400">log_id: </span>
            <span className="text-slate-300">{expandedLog.id}</span>
          </div>
          <div>
            <span className="text-slate-400">user_id: </span>
            <span className="text-slate-300">{expandedLog.user_id ?? 'anonymous'}</span>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <DataGrid
          data={logs}
          columns={columns}
          currentPage={currentPage}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={loading}
        />
      </div>
    </div>
  );
}
