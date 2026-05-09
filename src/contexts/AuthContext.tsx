import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import {
  supabase,
  UserProfile,
  UserRoleRecord,
  Subscription,
  SubscriptionPlan,
  ActiveRoleType,
  buildActiveRole,
} from '../lib/supabase';
import { getUserProfile, getUserRoles } from '../lib/auth';
import { PlanFeatures, useSubscription } from '../hooks/useSubscription';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  roleLoading: boolean;

  allRoles: UserRoleRecord[];
  activeRole: ActiveRoleType | null;
  setActiveRole: (role: ActiveRoleType) => void;

  isPlatformAdmin: boolean;
  isAccountOwner: boolean;
  isSupervisor: boolean;
  isMember: boolean;
  isManagerRole: boolean;

  sessionConfig: {
    idleTimeoutMinutes: number;
    warningSeconds: number;
  } | null;
  subscription: Subscription | null;
  plan: SubscriptionPlan | null;
  features: PlanFeatures;
  refreshSubscription: () => void;
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

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  roleLoading: true,
  allRoles: [],
  activeRole: null,
  setActiveRole: () => {},
  isPlatformAdmin: false,
  isAccountOwner: false,
  isSupervisor: false,
  isMember: false,
  isManagerRole: false,
  sessionConfig: null,
  subscription: null,
  plan: null,
  features: DEFAULT_FEATURES,
  refreshSubscription: () => {},
});

function SubscriptionBridge({
  accountId,
  onLoaded,
}: {
  accountId: string | undefined;
  onLoaded: (data: {
    subscription: Subscription | null;
    plan: SubscriptionPlan | null;
    features: PlanFeatures;
    refresh: () => void;
  }) => void;
}) {
  const result = useSubscription(accountId);
  useEffect(() => {
    if (!result.loading) {
      onLoaded({
        subscription: result.subscription,
        plan: result.plan,
        features: result.features,
        refresh: result.refresh,
      });
    }
  }, [result.loading, result.subscription, result.plan, result.features]);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [allRoles, setAllRoles] = useState<UserRoleRecord[]>([]);
  const [activeRole, setActiveRoleState] = useState<ActiveRoleType | null>(null);
  const [sessionConfig, setSessionConfig] = useState<{
    idleTimeoutMinutes: number;
    warningSeconds: number;
  } | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [features, setFeatures] = useState<PlanFeatures>(DEFAULT_FEATURES);
  const [refreshFn, setRefreshFn] = useState<() => void>(() => {});

  const setActiveRole = useCallback((role: ActiveRoleType) => {
    setActiveRoleState(role);
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    console.log('[AuthContext:loadUserData] Loading user data for:', userId);
    let userProfile, roles;
    try {
      [userProfile, roles] = await Promise.all([
        getUserProfile(userId),
        getUserRoles(userId),
      ]);
    } catch (err) {
      console.error('[AuthContext:loadUserData] Failed to load user data:', err);
      setRoleLoading(false);
      throw err;
    }

    setProfile(userProfile);
    setAllRoles(roles);

    if (roles.length === 1) {
      const built = buildActiveRole(roles[0]);
      if (built) setActiveRoleState(built);
    } else if (roles.length > 1) {
      const preferredRoles = ['account_owner', 'supervisor', 'super_admin', 'support_admin', 'member'];
      const sorted = [...roles].sort(
        (a, b) => preferredRoles.indexOf(a.role) - preferredRoles.indexOf(b.role)
      );
      const built = buildActiveRole(sorted[0]);
      if (built) setActiveRoleState(built);
    }
    setRoleLoading(false);
  }, []);

  useEffect(() => {
    const loadSessionConfig = async () => {
      try {
        const { data } = await supabase
          .from('admin_settings')
          .select('session_idle_timeout_minutes, session_warning_seconds')
          .maybeSingle();

        if (data) {
          setSessionConfig({
            idleTimeoutMinutes: data.session_idle_timeout_minutes || 5,
            warningSeconds: data.session_warning_seconds || 60,
          });
        }
      } catch {
        setSessionConfig({ idleTimeoutMinutes: 5, warningSeconds: 60 });
      }
    };
    loadSessionConfig();
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('[AuthContext:initializeAuth] Starting auth initialization');
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[AuthContext:initializeAuth] getSession error:', {
            message: error.message,
            status: error.status,
            code: (error as { code?: string }).code,
          });
          throw error;
        }

        console.log('[AuthContext:initializeAuth] Session:', data.session ? `found (user: ${data.session.user?.id})` : 'none');

        if (data.session?.user) {
          setRoleLoading(true);
          setUser(data.session.user);
          await loadUserData(data.session.user.id);

          const auditResult = await supabase.from('login_audit').insert({
            user_id: data.session.user.id,
            email: data.session.user.email,
            login_at: new Date().toISOString(),
          });
          if (auditResult.error) {
            console.warn('[AuthContext:initializeAuth] login_audit insert failed:', auditResult.error);
          }

          const profileUpdate = await supabase
            .from('profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', data.session.user.id);
          if (profileUpdate.error) {
            console.warn('[AuthContext:initializeAuth] profiles last_login_at update failed:', profileUpdate.error);
          }
        } else {
          setRoleLoading(false);
        }
      } catch (error) {
        console.error('[AuthContext:initializeAuth] Fatal auth initialization error:', error);
        setRoleLoading(false);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext:onAuthStateChange] Event:', event, 'User:', session?.user?.id ?? 'none');
      // TOKEN_REFRESHED and INITIAL_SESSION both fire when a backgrounded/minimized tab
      // regains focus. Neither represents a real auth change — ignore them both entirely.
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;

      (async () => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null);
          setProfile(null);
          setAllRoles([]);
          setActiveRoleState(null);
          setRoleLoading(false);
          return;
        }
        if (event === 'SIGNED_IN' && session?.user) {
          // Only reload data if this is a genuinely different user signing in.
          // setUser is synchronous so we compare against the ref captured at listener setup.
          setUser((currentUser) => {
            if (currentUser?.id === session.user!.id) {
              // Same user — session was already loaded by initializeAuth, do nothing.
              return currentUser;
            }
            // Different user (e.g. someone else signed in) — trigger a reload.
            (async () => {
              setRoleLoading(true);
              try {
                await loadUserData(session.user!.id);
              } catch (err) {
                console.error('[AuthContext:onAuthStateChange] loadUserData failed:', err);
                setRoleLoading(false);
              }
            })();
            return session.user;
          });
        }
      })();
    });

    return () => authSub?.unsubscribe();
  }, [loadUserData]);

  const activeAccountId =
    activeRole?.type === 'account' ? activeRole.accountId : undefined;

  const isPlatformAdmin = activeRole?.type === 'platform';
  const isAccountOwner = activeRole?.type === 'account' && activeRole.role === 'account_owner';
  const isSupervisor = activeRole?.type === 'account' && activeRole.role === 'supervisor';
  const isMember = activeRole?.type === 'account' && activeRole.role === 'member';
  const isManagerRole = isPlatformAdmin || isAccountOwner || isSupervisor;

  const value: AuthContextType = {
    user,
    profile,
    loading,
    roleLoading,
    allRoles,
    activeRole,
    setActiveRole,
    isPlatformAdmin,
    isAccountOwner,
    isSupervisor,
    isMember,
    isManagerRole,
    sessionConfig,
    subscription,
    plan,
    features,
    refreshSubscription: refreshFn,
  };

  return (
    <AuthContext.Provider value={value}>
      {activeAccountId && (
        <SubscriptionBridge
          accountId={activeAccountId}
          onLoaded={({ subscription: s, plan: p, features: f, refresh }) => {
            setSubscription(s);
            setPlan(p);
            setFeatures(f);
            setRefreshFn(() => refresh);
          }}
        />
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
