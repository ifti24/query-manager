import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

export interface AccountSummary {
  id: string;
  name: string;
  owner_id: string;
  owner_name: string | null;
  owner_email: string;
  plan_id: string | null;
  plan_name: string | null;
  plan_display: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  member_count: number;
  supervisor_count: number;
  distinct_user_count: number;
  total_queries: number;
  open_queries: number;
  resolved_queries: number;
  archived_queries: number;
  queries_used: number;
  queries_limit: number;
  created_at: string;
}

export interface PlatformOverview {
  totalAccounts: number;
  activeAccounts: number;
  totalOwners: number;
  totalSupervisors: number;
  totalMembers: number;
  totalUsers: number;
  totalQueries: number;
  openQueries: number;
  resolvedQueries: number;
  archivedQueries: number;
  planBreakdown: { plan: string; display: string; count: number; percent: number }[];
  expiredUnrenewed: number;
  trialActive: number;
  trialExpired: number;
  accounts: AccountSummary[];
}

export function usePlatformStats() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: accounts },
        { data: subscriptions },
        { data: plans },
        { data: userRoles },
        { data: queries },
      ] = await Promise.all([
        supabase.from('accounts').select('id, name, owner_id, is_active, created_at').eq('is_active', true),
        supabase
          .from('subscriptions')
          .select('id, account_id, plan_id, status, queries_used, ends_at, trial_ends_at, started_at'),
        supabase.from('subscription_plans').select('id, name, display_name, queries_per_month'),
        supabase
          .from('user_roles')
          .select('user_id, account_id, role')
          .in('role', ['account_owner', 'supervisor', 'member']),
        supabase
          .from('queries')
          .select('id, created_by, status, archived')
          .is('archived', false),
      ]);

      const accountList = accounts ?? [];
      const subList = subscriptions ?? [];
      const planList = plans ?? [];
      const roleList = userRoles ?? [];
      const queryList = queries ?? [];

      const planMap = new Map(planList.map((p) => [p.id, p]));
      const subByAccount = new Map(subList.map((s) => [s.account_id, s]));

      const ownerEmailMap = new Map<string, { email: string; full_name: string | null }>();
      if (accountList.length > 0) {
        const ownerIds = [...new Set(accountList.map((a) => a.owner_id))];
        const { data: ownerProfiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', ownerIds);
        (ownerProfiles ?? []).forEach((p) => ownerEmailMap.set(p.id, p));
      }

      const membersByAccount = new Map<string, { supervisors: number; members: number; distinctIds: Set<string> }>();
      roleList.forEach((r) => {
        if (!r.account_id) return;
        if (!membersByAccount.has(r.account_id)) {
          membersByAccount.set(r.account_id, { supervisors: 0, members: 0, distinctIds: new Set() });
        }
        const entry = membersByAccount.get(r.account_id)!;
        entry.distinctIds.add(r.user_id);
        if (r.role === 'supervisor') entry.supervisors++;
        if (r.role === 'member') entry.members++;
      });

      const queriesByOwner = new Map<string, { total: number; open: number; resolved: number; archived: number }>();
      queryList.forEach((q) => {
        const key = q.created_by;
        if (!queriesByOwner.has(key)) queriesByOwner.set(key, { total: 0, open: 0, resolved: 0, archived: 0 });
        const entry = queriesByOwner.get(key)!;
        entry.total++;
        if (q.status === 'done' || q.status === 'completed') entry.resolved++;
        else if (q.archived) entry.archived++;
        else entry.open++;
      });

      const now = new Date();

      const accountSummaries: AccountSummary[] = accountList.map((acc) => {
        const sub = subByAccount.get(acc.id);
        const plan = sub ? planMap.get(sub.plan_id) : null;
        const owner = ownerEmailMap.get(acc.owner_id);
        const members = membersByAccount.get(acc.id) ?? { supervisors: 0, members: 0, distinctIds: new Set<string>() };
        const qStats = queriesByOwner.get(acc.owner_id) ?? { total: 0, open: 0, resolved: 0, archived: 0 };

        const allDistinctIds = new Set(members.distinctIds);
        allDistinctIds.add(acc.owner_id);

        return {
          id: acc.id,
          name: acc.name,
          owner_id: acc.owner_id,
          owner_name: owner?.full_name ?? null,
          owner_email: owner?.email ?? '',
          plan_id: plan?.id ?? null,
          plan_name: plan?.name ?? null,
          plan_display: plan?.display_name ?? null,
          subscription_status: sub?.status ?? null,
          trial_ends_at: sub?.trial_ends_at ?? null,
          ends_at: sub?.ends_at ?? null,
          is_active: acc.is_active,
          member_count: members.members,
          supervisor_count: members.supervisors,
          distinct_user_count: allDistinctIds.size,
          total_queries: qStats.total,
          open_queries: qStats.open,
          resolved_queries: qStats.resolved,
          archived_queries: qStats.archived,
          queries_used: sub?.queries_used ?? 0,
          queries_limit: plan?.queries_per_month ?? 0,
          created_at: acc.created_at,
        };
      });

      const totalOwners = new Set(roleList.filter((r) => r.role === 'account_owner').map((r) => r.user_id)).size;
      const totalSupervisors = new Set(roleList.filter((r) => r.role === 'supervisor').map((r) => r.user_id)).size;
      const totalMembers = new Set(roleList.filter((r) => r.role === 'member').map((r) => r.user_id)).size;

      const planBreakdownMap = new Map<string, { display: string; count: number }>();
      accountSummaries.forEach((a) => {
        const key = a.plan_name ?? 'no_plan';
        const display = a.plan_display ?? 'No Plan';
        if (!planBreakdownMap.has(key)) planBreakdownMap.set(key, { display, count: 0 });
        planBreakdownMap.get(key)!.count++;
      });
      const total = accountSummaries.length || 1;
      const planBreakdown = Array.from(planBreakdownMap.entries()).map(([plan, v]) => ({
        plan,
        display: v.display,
        count: v.count,
        percent: Math.round((v.count / total) * 100),
      })).sort((a, b) => b.count - a.count);

      const expiredUnrenewed = accountSummaries.filter(
        (a) => a.subscription_status === 'expired'
      ).length;

      const trialActive = accountSummaries.filter(
        (a) =>
          a.subscription_status === 'trial' &&
          a.trial_ends_at &&
          new Date(a.trial_ends_at) > now
      ).length;

      const trialExpired = accountSummaries.filter(
        (a) =>
          a.subscription_status === 'trial' &&
          a.trial_ends_at &&
          new Date(a.trial_ends_at) <= now
      ).length;

      const totalQ = queryList.length;
      const openQ = queryList.filter((q) => !q.archived && q.status !== 'done' && q.status !== 'completed').length;
      const resolvedQ = queryList.filter((q) => q.status === 'done' || q.status === 'completed').length;
      const archivedQ = queryList.filter((q) => q.archived).length;

      setOverview({
        totalAccounts: accountSummaries.length,
        activeAccounts: accountSummaries.filter((a) => a.is_active).length,
        totalOwners,
        totalSupervisors,
        totalMembers,
        totalUsers: totalOwners + totalSupervisors + totalMembers,
        totalQueries: totalQ,
        openQueries: openQ,
        resolvedQueries: resolvedQ,
        archivedQueries: archivedQ,
        planBreakdown,
        expiredUnrenewed,
        trialActive,
        trialExpired,
        accounts: accountSummaries.sort((a, b) => b.total_queries - a.total_queries),
      });
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Failed to load platform stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { overview, loading, error, refresh: load };
}
