import { useEffect, useState } from 'react';
import { supabase, Query, QueryResponse, QueryComment, QueryAssignment, UserProfile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, MessageCircle, Flag, Calendar, User, AlertTriangle, Clock } from 'lucide-react';
import { formatDateTime } from '../../lib/dateFormatter';
import { calculateQueryAge } from '../../lib/queryAge';

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
  const { user, profile } = useAuth();
  const [query, setQuery] = useState<DetailedQuery | null>(null);
  const [responses, setResponses] = useState<ResponseWithAuthor[]>([]);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState(true);

  const isTeamMember = profile?.role === 'team_member';
  const hasUserResponded = responses.some(r => r.responded_by === user?.id);
  const canSubmitResponse = isTeamMember && query?.status === 'pending';
  const canComment = isTeamMember && query?.status === 'answered';

  const fetchQueryDetails = async () => {
    try {
      const { data: queryData } = await supabase
        .from('queries')
        .select('*')
        .eq('id', queryId)
        .maybeSingle();

      if (queryData) {
        setQuery(queryData);

        const { data: responseData } = await supabase
          .from('query_responses')
          .select('*')
          .eq('query_id', queryId)
          .order('created_at', { ascending: false });

        setResponses(responseData || []);

        const { data: commentData } = await supabase
          .from('query_comments')
          .select('*')
          .eq('query_id', queryId)
          .order('created_at', { ascending: false });

        setComments(commentData || []);

        const responsesWithType: Activity[] = (responseData || []).map((r) => ({ ...r, type: 'response' as const }));
        const commentsWithType: Activity[] = (commentData || []).map((c) => ({ ...c, type: 'comment' as const }));

        const allActivities = [...responsesWithType, ...commentsWithType].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setActivities(allActivities);

        const userIds = new Set<string>();
        responseData?.forEach((r) => userIds.add(r.responded_by));
        commentData?.forEach((c) => userIds.add(c.created_by));
        userIds.add(queryData.created_by);

        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', Array.from(userIds));

          const map: Record<string, UserProfile> = {};
          profiles?.forEach((p) => {
            map[p.id] = p;
          });
          setProfilesMap(map);
        }
      }
    } catch (error) {
      console.error('Error fetching query details:', error);
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

      const { error: insertError } = await supabase.from('query_responses').insert({
        query_id: queryId,
        assignment_id: assignment.id,
        responded_by: user.id,
        content: commentContent,
      });

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('queries')
        .update({ status: 'answered' })
        .eq('id', queryId);

      if (updateError) throw updateError;

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
      setSendEmail(true);
      setQuery(prev => prev ? { ...prev, status: 'answered' } : prev);
      await fetchQueryDetails();
      if (onClose) {
        setTimeout(() => onClose('answered'), 500);
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
      await supabase.from('query_comments').insert({
        query_id: queryId,
        created_by: user.id,
        content: commentContent,
      });

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
      setSendEmail(true);
      await fetchQueryDetails();
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
          {query.show_priority && (
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ${
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-slate-700 text-sm">Send email notification to admin</span>
            </label>
            <button
              type="submit"
              disabled={submitting || !commentContent.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Submit Response'}
            </button>
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-slate-700 text-sm">Send email notification to admin</span>
            </label>
            <div className="flex justify-end">
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
      </div>
    </div>
  );
}
