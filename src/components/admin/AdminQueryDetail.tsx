import { useEffect, useState } from 'react';
import { supabase, Query, QueryResponse, QueryComment, UserProfile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, Flag, Calendar, User, CheckCircle, Archive, AlertTriangle, Clock } from 'lucide-react';
import { formatDateTime } from '../../lib/dateFormatter';
import { calculateQueryAge } from '../../lib/queryAge';
import { logUnauthorizedAccess, isUnauthorizedError, buildDescription } from '../../lib/securityAudit';

interface AdminQueryDetailProps {
  queryId: string;
  onClose?: () => void;
}

interface DetailedQuery extends Query {
  creator?: { full_name: string; email: string };
  assigned_members?: { id: string; full_name: string; email: string }[];
}

interface ResponseWithAuthor extends QueryResponse {
  author?: UserProfile;
}

interface CommentWithAuthor extends QueryComment {
  author?: UserProfile;
}

type Activity = (ResponseWithAuthor | CommentWithAuthor) & {
  type: 'response' | 'comment';
};

export default function AdminQueryDetail({ queryId, onClose }: AdminQueryDetailProps) {
  const { user, profile } = useAuth();
  const [query, setQuery] = useState<DetailedQuery | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [sendEmail, setSendEmail] = useState(true);

  const fetchQueryDetails = async () => {
    if (!queryId) return;

    try {
      const { data: queryData } = await supabase
        .from('queries')
        .select(`
          id, title, description, status, priority, show_priority, created_by, created_at, completed_at, archived, consecutive_admin_comments,
          profiles!queries_created_by_fkey(id, full_name, email, role)
        `)
        .eq('id', queryId)
        .maybeSingle();

      if (!queryData) return;

      const [{ data: assignments }, { data: responses }, { data: comments }] = await Promise.all([
        supabase
          .from('query_assignments')
          .select('assigned_to, profiles!query_assignments_assigned_to_fkey(id, full_name, email)')
          .eq('query_id', queryId),
        supabase
          .from('query_responses')
          .select('id, query_id, assignment_id, responded_by, content, created_at, profiles!query_responses_responded_by_fkey(id, full_name, role)')
          .eq('query_id', queryId)
          .order('created_at', { ascending: false }),
        supabase
          .from('query_comments')
          .select('id, query_id, created_by, content, created_at, profiles!query_comments_created_by_fkey(id, full_name, role)')
          .eq('query_id', queryId)
          .order('created_at', { ascending: false }),
      ]);

      const assignedMembers = assignments?.map((a: any) => ({
        id: a.profiles.id,
        full_name: a.profiles.full_name,
        email: a.profiles.email,
      }));

      setQuery({
        ...queryData,
        creator: queryData.profiles,
        assigned_members: assignedMembers || [],
      });

      const responsesWithType: Activity[] = (responses || []).map((r) => ({ ...r, type: 'response' as const }));
      const commentsWithType: Activity[] = (comments || []).map((c) => ({ ...c, type: 'comment' as const }));

      const allActivities = [...responsesWithType, ...commentsWithType].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(allActivities);

      const map: Record<string, UserProfile> = {};
      responses?.forEach((r) => {
        const p = r.profiles as any;
        if (p) map[r.responded_by] = p;
      });
      comments?.forEach((c) => {
        const p = c.profiles as any;
        if (p) map[c.created_by] = p;
      });
      if (queryData) {
        map[queryData.created_by] = queryData.profiles as any;
      }
      setProfilesMap(map);
    } catch (error) {
      console.error('Error fetching query details:', error);
      const e = error as { message?: string; code?: string };
      if (isUnauthorizedError(e)) {
        logUnauthorizedAccess({
          user_id: user?.id,
          service_context: 'queries:fetchQueryDetail',
          description: buildDescription('queries:fetchQueryDetail', e, { resource_id: queryId }),
          error_code: e.code,
          error_message: e.message,
          metadata: { query_id: queryId },
        });
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchQueryDetails().finally(() => setLoading(false));
  }, [queryId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentContent.trim()) return;

    setSubmitting(true);

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('query_comments')
        .insert({ query_id: queryId, created_by: user.id, content: commentContent })
        .select('id, query_id, created_by, content, created_at')
        .single();

      if (insertError) {
        console.error('Error inserting comment:', insertError);
        if (isUnauthorizedError({ message: insertError.message, code: insertError.code })) {
          logUnauthorizedAccess({
            user_id: user?.id,
            service_context: 'query_comments:insert',
            description: buildDescription('query_comments:insert', insertError, { resource_id: queryId }),
            error_code: insertError.code,
            error_message: insertError.message,
            metadata: { query_id: queryId },
          });
        }
        alert('Failed to post comment: ' + insertError.message);
        return;
      }

      const { error: updateError } = await supabase
        .from('queries')
        .update({ status: 'pending' })
        .eq('id', queryId);

      if (updateError) {
        console.error('Error updating query status:', updateError);
      }

      const newActivity: Activity = {
        ...inserted,
        type: 'comment' as const,
      };

      setActivities(prev => [newActivity, ...prev]);
      setProfilesMap(prev => ({
        ...prev,
        [user.id]: { id: user.id, full_name: profile?.full_name || '', email: profile?.email || '', role: profile?.role || 'admin' } as UserProfile,
      }));
      setQuery(prev => prev ? { ...prev, status: 'pending' } : prev);

      if (sendEmail && query?.assigned_members && query.assigned_members.length > 0) {
        for (const member of query.assigned_members) {
          try {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
            const { data: { session } } = await supabase.auth.getSession();

            await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: member.email,
                subject: `New Comment on Query: ${query.title}`,
                html: `
                  <h2>New comment added to query</h2>
                  <p><strong>Query:</strong> ${query.title}</p>
                  <p><strong>Comment:</strong> ${commentContent}</p>
                  <p><strong>From:</strong> ${profile?.full_name}</p>
                  <p>Please log in to the system to view and respond.</p>
                `
              })
            });
          } catch (emailError) {
            console.error(`Failed to send email to ${member.email}:`, emailError);
          }
        }
      }

      setCommentContent('');
      setSendEmail(true);
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseQuery = async () => {
    if (!user) return;

    try {
      await supabase
        .from('queries')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', queryId);

      setQuery(prev => prev ? { ...prev, status: 'done', completed_at: new Date().toISOString() } : prev);
    } catch (error) {
      console.error('Error closing query:', error);
    }
  };

  const handleArchive = async () => {
    if (!user) return;

    try {
      await supabase
        .from('queries')
        .update({
          status: 'archived',
          archived: true
        })
        .eq('id', queryId);

      if (onClose) onClose();
    } catch (error) {
      console.error('Error archiving query:', error);
    }
  };

  const priorityBadge = (priority: string) => {
    const styles = {
      urgent: 'bg-red-50 text-red-700 border-red-200',
      high: 'bg-red-50 text-red-700 border-red-200',
      normal: 'bg-slate-50 text-slate-700 border-slate-200',
      low: 'bg-green-50 text-green-700 border-green-200',
    };
    return styles[priority as keyof typeof styles] || styles.normal;
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

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    answered: 'Answered',
    done: 'Done',
    archived: 'Archived',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Loading query details...</p>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Query not found</p>
      </div>
    );
  }

  const isAdminUser = profile?.role === 'admin';
  const canComment = query.status !== 'done' && query.status !== 'archived';
  const canCloseQuery = query.status === 'pending' || query.status === 'answered';
  const canArchive = query.status === 'done';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-slate-200 p-6 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-slate-900">{query.title}</h2>
              {query.consecutive_admin_comments >= 3 && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Super Urgent
                </span>
              )}
              {query.consecutive_admin_comments === 2 && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Urgent
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {query.show_priority && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${priorityBadge(query.priority)}`}>
                {query.priority.charAt(0).toUpperCase() + query.priority.slice(1)}
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusBadge(query.status)}`}>
              {statusLabels[query.status] || query.status}
            </span>
          </div>
        </div>

        {query.description && (
          <p className="text-slate-700 mb-4">{query.description}</p>
        )}

        <div className="flex gap-6 text-sm mb-4 flex-wrap">
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="w-4 h-4" />
            {formatDateTime(query.created_at)}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <User className="w-4 h-4" />
            Created by: {query.creator?.full_name || 'Unknown'}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-4 h-4" />
            Age: {calculateQueryAge(query.created_at, activities.length > 0 ? activities[0].created_at : null).ageFromCreation}
          </div>
          {activities.length > 0 && (
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="w-4 h-4" />
              Last activity: {calculateQueryAge(query.created_at, activities[0].created_at).ageFromLastActivity} ago
            </div>
          )}
        </div>

        {query.assigned_members && query.assigned_members.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Assigned Team Members</h3>
            <div className="flex flex-wrap gap-2">
              {query.assigned_members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg text-sm"
                >
                  <span className="text-slate-900">{member.full_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Communication Details</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-600">No responses or comments yet</p>
          </div>
        ) : (
          activities.map((activity) => {
            const isResponse = activity.type === 'response';
            const authorId = isResponse
              ? (activity as ResponseWithAuthor).responded_by
              : (activity as CommentWithAuthor).created_by;
            const author = profilesMap[authorId];
            const isCurrentUser = authorId === user?.id;
            const isAdminAuthor = author?.role === 'admin';

            return (
              <div
                key={`${activity.type}-${activity.id}`}
                className={`flex ${isAdminAuthor ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    isAdminAuthor
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-900 border border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-medium ${isAdminAuthor ? 'text-blue-100' : 'text-slate-600'}`}>
                      {author?.full_name || 'Unknown'}
                    </span>
                    {isResponse && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          isAdminAuthor
                            ? 'bg-blue-500 text-blue-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Response
                      </span>
                    )}
                  </div>
                  <p className={isAdminAuthor ? 'text-white' : 'text-slate-900'}>
                    {activity.content}
                  </p>
                  <p className={`text-xs mt-2 ${isAdminAuthor ? 'text-blue-100' : 'text-slate-500'}`}>
                    {formatDateTime(activity.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isAdminUser && (
        <div className="border-t border-slate-200 p-6 bg-white flex-shrink-0">
          {query.status === 'done' || query.status === 'archived' ? (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-green-600 font-medium mb-4">
                <Flag className="w-5 h-5" />
                This query has been {query.status === 'done' ? 'completed' : 'archived'}
              </div>
              {canArchive && (
                <button
                  onClick={handleArchive}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Archive className="w-4 h-4" />
                  Archive Query
                </button>
              )}
            </div>
          ) : (
            <>
              {canComment && (
                <form onSubmit={handleSubmitComment} className="space-y-3 mb-3">
                  <textarea
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
                    rows={3}
                    disabled={submitting}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-slate-700 text-sm">Send email notification to assigned members</span>
                  </label>
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      {canCloseQuery && (
                        <button
                          type="button"
                          onClick={handleCloseQuery}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Close Query
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || !commentContent.trim()}
                      className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      {submitting ? 'Sending...' : 'Send Comment'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
