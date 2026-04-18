import { useEffect, useState } from 'react';
import { supabase, Query, QueryResponse, QueryComment, QueryAssignment, UserProfile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, MessageCircle, Flag, Calendar, User, AlertTriangle, Clock, ArrowLeft } from 'lucide-react';
import { formatDateTime } from '../../lib/dateFormatter';
import { calculateQueryAge } from '../../lib/queryAge';
import { logUnauthorizedAccess, isUnauthorizedError, buildDescription } from '../../lib/securityAudit';

interface QueryDetailProps {
  queryId: string;
  onClose?: (switchToTab?: string) => void;
}

interface DetailedQuery extends Query {
  creator?: { full_name: string; email: string };
  assignment?: QueryAssignment;
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

export default function QueryDetail({ queryId, onClose }: QueryDetailProps) {
  const { user, profile, isMember } = useAuth();
  const [query, setQuery] = useState<DetailedQuery | null>(null);
  const [responses, setResponses] = useState<ResponseWithAuthor[]>([]);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState(false);

  const isTeamMember = isMember || profile?.role === 'team_member';
  const hasUserResponded = responses.some(r => r.responded_by === user?.id);
  const canSubmitResponse = isTeamMember && query?.status === 'pending';
  const canComment = isTeamMember && query?.status === 'answered';

  const fetchQueryDetails = async () => {
    try {
      const { data: queryData } = await supabase
        .from('queries')
        .select('id, title, description, status, priority, show_priority, created_by, created_at, completed_at, archived, consecutive_admin_comments')
        .eq('id', queryId)
        .maybeSingle();

      if (!queryData) return;

      const [{ data: responseData }, { data: commentData }] = await Promise.all([
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

      setQuery(queryData);
      setResponses(responseData || []);
      setComments(commentData || []);

      const responsesWithType: Activity[] = (responseData || []).map((r) => ({ ...r, type: 'response' as const }));
      const commentsWithType: Activity[] = (commentData || []).map((c) => ({ ...c, type: 'comment' as const }));

      const allActivities = [...responsesWithType, ...commentsWithType].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(allActivities);

      const map: Record<string, UserProfile> = {};
      responseData?.forEach((r) => {
        const p = r.profiles as any;
        if (p) map[r.responded_by] = p;
      });
      commentData?.forEach((c) => {
        const p = c.profiles as any;
        if (p) map[c.created_by] = p;
      });
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueryDetails();
  }, [queryId]);

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentContent.trim() || !isTeamMember || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { data: assignment } = await supabase
        .from('query_assignments')
        .select('id')
        .eq('query_id', queryId)
        .eq('assigned_to', user.id)
        .maybeSingle();

      if (!assignment) throw new Error('Assignment not found');

      const { data: inserted, error: insertError } = await supabase
        .from('query_responses')
        .insert({ query_id: queryId, assignment_id: assignment.id, responded_by: user.id, content: commentContent })
        .select('id, query_id, assignment_id, responded_by, content, created_at')
        .single();

      if (insertError) {
        if (isUnauthorizedError({ message: insertError.message, code: insertError.code })) {
          logUnauthorizedAccess({
            user_id: user?.id,
            service_context: 'query_responses:insert',
            description: buildDescription('query_responses:insert', insertError, { resource_id: queryId }),
            error_code: insertError.code,
            error_message: insertError.message,
            metadata: { query_id: queryId },
          });
        }
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from('queries')
        .update({ status: 'answered' })
        .eq('id', queryId);

      if (updateError) throw updateError;

      const newActivity: Activity = { ...inserted, type: 'response' as const };
      setActivities(prev => [newActivity, ...prev]);
      setResponses(prev => [inserted, ...prev]);
      setProfilesMap(prev => ({
        ...prev,
        [user.id]: { id: user.id, full_name: profile?.full_name || '', email: profile?.email || '', role: profile?.role || 'team_member' } as UserProfile,
      }));
      setQuery(prev => prev ? { ...prev, status: 'answered' } : prev);

      if (sendEmail && query) {
        const adminProfile = profilesMap[query.created_by];
        if (adminProfile) {
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
                to: adminProfile.email,
                subject: `Response Submitted for Query: ${query.title}`,
                html: `
                  <h2>A team member has responded to your query</h2>
                  <p><strong>Query:</strong> ${query.title}</p>
                  <p><strong>Response:</strong> ${commentContent}</p>
                  <p><strong>From:</strong> ${profile?.full_name}</p>
                  <p>Please log in to the system to view the full response.</p>
                `
              })
            });
          } catch (emailError) {
            console.error('Failed to send email:', emailError);
          }
        }
      }

      setCommentContent('');
      setSendEmail(false);
      if (onClose) {
        setTimeout(() => onClose('pending'), 500);
      }
    } catch (error) {
      console.error('Error submitting response:', error);
      setErrorMessage('Failed to submit response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentContent.trim() || !isTeamMember) return;

    setSubmitting(true);

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('query_comments')
        .insert({ query_id: queryId, created_by: user.id, content: commentContent })
        .select('id, query_id, created_by, content, created_at')
        .single();

      if (insertError) {
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
        throw insertError;
      }

      const newActivity: Activity = { ...inserted, type: 'comment' as const };
      setActivities(prev => [newActivity, ...prev]);
      setComments(prev => [inserted, ...prev]);
      setProfilesMap(prev => ({
        ...prev,
        [user.id]: { id: user.id, full_name: profile?.full_name || '', email: profile?.email || '', role: profile?.role || 'team_member' } as UserProfile,
      }));

      if (sendEmail && query) {
        const adminProfile = profilesMap[query.created_by];
        if (adminProfile) {
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
                to: adminProfile.email,
                subject: `New Comment on Query: ${query.title}`,
                html: `
                  <h2>A team member has commented on your query</h2>
                  <p><strong>Query:</strong> ${query.title}</p>
                  <p><strong>Comment:</strong> ${commentContent}</p>
                  <p><strong>From:</strong> ${profile?.full_name}</p>
                  <p>Please log in to the system to view the full comment.</p>
                `
              })
            });
          } catch (emailError) {
            console.error('Failed to send email:', emailError);
          }
        }
      }

      setCommentContent('');
      setSendEmail(false);
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <p className="text-slate-600">Loading query...</p>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <p className="text-slate-600">Query not found</p>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    answered: 'Answered',
    done: 'Done',
    archived: 'Archived',
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-2 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-900 flex-1 min-w-0">{query.title}</h2>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
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
                {query.show_priority && (
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      query.priority === 'high'
                        ? 'bg-red-50 text-red-700'
                        : query.priority === 'normal'
                          ? 'bg-slate-50 text-slate-700'
                          : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {query.priority.charAt(0).toUpperCase() + query.priority.slice(1)} Priority
                  </span>
                )}
                {onClose && (
                  <button
                    onClick={() => onClose()}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                    title="Close"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-600" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {query.description && (
          <p className="text-slate-700 mb-4">{query.description}</p>
        )}

        <div className="flex gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="w-4 h-4" />
            {formatDateTime(query.created_at)}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Flag className="w-4 h-4" />
            Status: {statusLabels[query.status] || query.status}
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
      </div>

      <div className="p-6 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Communication Details</h2>
      </div>

      <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto bg-slate-50">

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
            const isAdminAuthor = author?.role === 'admin';

            return (
              <div
                key={`${activity.type}-${activity.id}`}
                className={`flex ${isAdminAuthor ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    isAdminAuthor
                      ? 'bg-white text-slate-900 border border-slate-200'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-medium ${isAdminAuthor ? 'text-slate-600' : 'text-blue-100'}`}>
                      {author?.full_name || 'Unknown'}
                    </span>
                    {isResponse && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          isAdminAuthor
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-blue-500 text-blue-100'
                        }`}
                      >
                        Response
                      </span>
                    )}
                  </div>
                  <p className={`whitespace-pre-wrap ${isAdminAuthor ? 'text-slate-900' : 'text-white'}`}>
                    {activity.content}
                  </p>
                  <p className={`text-xs mt-2 ${isAdminAuthor ? 'text-slate-500' : 'text-blue-100'}`}>
                    {formatDateTime(activity.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-6 border-t border-slate-200">
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}
        {query.status === 'done' || query.status === 'archived' ? (
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
              <Flag className="w-5 h-5" />
              This query has been {query.status === 'done' ? 'completed' : 'archived'}
            </div>
          </div>
        ) : canSubmitResponse ? (
          <form onSubmit={handleSubmitResponse} className="space-y-3">
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Type your response here..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              rows={3}
              disabled={submitting}
            />
            <div className="flex items-center justify-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-slate-600 text-sm">Send email notification to admin</span>
              </label>
            </div>
            <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
              {onClose && (
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Queries
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || !commentContent.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit Response'}
              </button>
            </div>
          </form>
        ) : canComment ? (
          <form onSubmit={handleSubmitComment} className="space-y-3">
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Add a comment..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
              rows={3}
              disabled={submitting}
            />
            <div className="flex items-center justify-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-slate-600 text-sm">Send email notification to admin</span>
              </label>
            </div>
            <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
              {onClose && (
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Queries
                </button>
              )}
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
        ) : (
          <div className="text-center py-4 text-slate-500">
            {query.status === 'answered' && 'Waiting for admin response'}
          </div>
        )}

        {onClose && !(canSubmitResponse || canComment) && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => onClose()}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Queries
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
