import { useEffect, useState, useCallback } from 'react';
import { supabase, Subscription, SubscriptionPlan } from '../lib/supabase';

export interface PlanFeatures {
  canCreateQuery: boolean;
  queriesUsed: number;
  queriesLimit: number | null;
  canInviteMembers: boolean;
  membersLimit: number | null;
  currentMemberCount: number;
  hasReports: boolean;
  hasAnalytics: boolean;
  hasAdvancedAnalytics: boolean;
  hasWhatsApp: boolean;
  hasPrioritySupport: boolean;
  hasEarlyAccess: boolean;
  isTrial: boolean;
  isExpired: boolean;
  planId: string | null;
  planName: string | null;
  trialDaysLeft: number | null;
}

const DEFAULT_FEATURES: PlanFeatures = {
  canCreateQuery: false,
  queriesUsed: 0,
  queriesLimit: 0,
  canInviteMembers: false,
  membersLimit: null,
  currentMemberCount: 0,
  hasReports: false,
  hasAnalytics: false,
  hasAdvancedAnalytics: false,
  hasWhatsApp: false,
  hasPrioritySupport: false,
  hasEarlyAccess: false,
  isTrial: false,
  isExpired: true,
  planId: null,
  planName: null,
  trialDaysLeft: null,
};

function computeFeatures(
  sub: Subscription | null,
  plan: SubscriptionPlan | null,
  memberCount: number
): PlanFeatures {
  if (!sub || !plan || (sub.status !== 'active' && sub.status !== 'trial')) {
    return { ...DEFAULT_FEATURES, currentMemberCount: memberCount };
  }

  const isPremium = plan.id === 'premium';
  const isStandard = plan.id === 'standard';
  const isBasic = plan.id === 'basic';
  const isTrial = plan.is_trial || sub.status === 'trial';

  const queriesLimit = isPremium ? null : plan.queries_per_month;
  const queriesUsed = sub.queries_used;
  const canCreateQuery = isPremium ? true : queriesUsed < (queriesLimit ?? Infinity);

  const membersLimit = isTrial ? (plan.max_members ?? 5) : null;
  const canInviteMembers = isTrial ? memberCount < (membersLimit ?? 5) : true;

  const trialDaysLeft = sub.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null;

  return {
    canCreateQuery,
    queriesUsed,
    queriesLimit,
    canInviteMembers,
    membersLimit,
    currentMemberCount: memberCount,
    hasReports: isBasic || isStandard || isPremium,
    hasAnalytics: isStandard || isPremium,
    hasAdvancedAnalytics: isPremium,
    hasWhatsApp: isBasic || isStandard || isPremium,
    hasPrioritySupport: isPremium,
    hasEarlyAccess: isPremium,
    isTrial,
    isExpired: false,
    planId: plan.id,
    planName: plan.display_name,
    trialDaysLeft,
  };
}

export function useSubscription(accountId: string | undefined) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [features, setFeatures] = useState<PlanFeatures>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    try {
      const [{ data: subData }, { data: membersData }] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*, plan:subscription_plans(*)')
          .eq('account_id', accountId)
          .in('status', ['active', 'trial'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('id', { count: 'exact' })
          .eq('account_id', accountId)
          .eq('role', 'member'),
      ]);

      const activeSub = subData as (Subscription & { plan: SubscriptionPlan }) | null;
      const activePlan = activeSub?.plan ?? null;
      const memberCount = (membersData?.length) ?? 0;

      setSubscription(activeSub);
      setPlan(activePlan);
      setFeatures(computeFeatures(activeSub, activePlan, memberCount));
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { subscription, plan, features, loading, refresh };
}
