import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';
import { getUserProfile } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  sessionConfig: {
    idleTimeoutMinutes: number;
    warningSeconds: number;
  } | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  sessionConfig: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionConfig, setSessionConfig] = useState<{
    idleTimeoutMinutes: number;
    warningSeconds: number;
  } | null>(null);

  useEffect(() => {
    const loadSessionConfig = async () => {
      try {
        const { data } = await supabase
          .from('admin_settings')
          .select('session_idle_timeout_minutes, session_warning_seconds')
          .single();

        if (data) {
          setSessionConfig({
            idleTimeoutMinutes: data.session_idle_timeout_minutes || 5,
            warningSeconds: data.session_warning_seconds || 60,
          });
        }
      } catch (error) {
        console.error('Failed to load session config:', error);
        setSessionConfig({ idleTimeoutMinutes: 5, warningSeconds: 60 });
      }
    };

    loadSessionConfig();
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session?.user) {
          setUser(data.session.user);
          const userProfile = await getUserProfile(data.session.user.id);
          setProfile(userProfile);

          await supabase.from('login_audit').insert({
            user_id: data.session.user.id,
            email: data.session.user.email,
            login_at: new Date().toISOString(),
          });

          await supabase
            .from('profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', data.session.user.id);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (session?.user) {
          setUser(session.user);
          const userProfile = await getUserProfile(session.user.id);
          setProfile(userProfile);
        } else {
          setUser(null);
          setProfile(null);
        }
      })();
    });

    return () => subscription?.unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    sessionConfig,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
