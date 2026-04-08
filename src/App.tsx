import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import TeamMemberPortal from './pages/TeamMemberPortal';
import LoadingScreen from './components/LoadingScreen';
import { SessionTimeoutModal } from './components/common/SessionTimeoutModal';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { supabase } from './lib/supabase';

function App() {
  const { user, profile, loading, sessionConfig } = useAuth();

  const handleTimeout = async () => {
    await supabase.auth.signOut();
  };

  const { showWarning, secondsRemaining, keepAlive } = useSessionTimeout(
    sessionConfig || { idleTimeoutMinutes: 5, warningSeconds: 60 },
    handleTimeout
  );

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  return (
    <>
      {profile.role === 'admin' ? <AdminDashboard /> : <TeamMemberPortal />}

      {user && (
        <SessionTimeoutModal
          isOpen={showWarning}
          secondsRemaining={secondsRemaining}
          onKeepAlive={keepAlive}
          onLogout={handleTimeout}
        />
      )}
    </>
  );
}

export default App;
