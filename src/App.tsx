import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import TeamMemberPortal from './pages/TeamMemberPortal';
import PricingPage from './pages/PricingPage';
import BkashPaymentPage from './pages/BkashPaymentPage';
import LandingPage from './pages/LandingPage';
import AccountActivationPage from './pages/AccountActivationPage';
import LoadingScreen from './components/LoadingScreen';
import { SessionTimeoutModal } from './components/common/SessionTimeoutModal';
import { RoleSwitcherModal } from './components/common/RoleSwitcher';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { supabase } from './lib/supabase';
import { Clock, LogOut } from 'lucide-react';

const LANDING_PATH = '/team-pulse';

interface SelectedPlan {
  id: string;
  name: string;
  price: number;
}

function App() {
  const { user, loading, roleLoading, activeRole, allRoles, setActiveRole, sessionConfig } = useAuth();
  const [showPricing, setShowPricing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);

  const handleSelectPlan = (planId: string, planName: string, planPrice: number) => {
    setSelectedPlan({ id: planId, name: planName, price: planPrice });
    setShowPricing(false);
  };

  const handleTimeout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
  };

  const { showWarning, secondsRemaining, keepAlive } = useSessionTimeout(
    sessionConfig || { idleTimeoutMinutes: 5, warningSeconds: 60 },
    handleTimeout
  );

  const pathname = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);

  const isActivationRoute = pathname === '/activate' || searchParams.has('token');
  const isLandingRoute = pathname === LANDING_PATH;

  if (isActivationRoute && searchParams.has('token')) {
    return <AccountActivationPage />;
  }

  if (isLandingRoute) {
    return (
      <LandingPage
        onShowPricing={() => setShowPricing(true)}
        onStartTrial={() => { window.history.pushState({}, '', '/'); window.location.reload(); }}
      />
    );
  }

  if (loading || (user && roleLoading)) {
    return <LoadingScreen />;
  }

  if (selectedPlan) {
    return (
      <BkashPaymentPage
        planName={selectedPlan.name}
        planPrice={selectedPlan.price}
        planId={selectedPlan.id}
        onBack={() => { setSelectedPlan(null); setShowPricing(true); }}
      />
    );
  }

  if (showPricing) {
    return <PricingPage onBack={() => setShowPricing(false)} onSelectPlan={handleSelectPlan} />;
  }

  if (!user) {
    return <LoginPage onShowPricing={() => setShowPricing(true)} />;
  }

  if (!activeRole && allRoles.length > 1) {
    return <RoleSwitcherModal onSelect={setActiveRole} />;
  }

  if (!activeRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200">
          <div className="text-center px-8 pt-8 pb-6 border-b border-slate-100">
            <h1 className="text-3xl font-bold text-slate-900 mb-1">QueryPing</h1>
            <p className="text-xs text-slate-400 tracking-wide">Never miss a pending query</p>
          </div>
          <div className="px-8 py-10 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Account Setup in Progress</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-2">
              Your account has been created and is being set up. This usually takes just a moment.
            </p>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              Please sign out and sign back in to continue. If the issue persists, contact support.
            </p>
            <button
              type="button"
              onClick={async () => { await supabase.auth.signOut({ scope: 'local' }); window.location.href = '/'; }}
              className="flex items-center justify-center gap-2 w-full border border-slate-300 text-slate-600 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {activeRole.type === 'platform' || activeRole.role === 'account_owner' || activeRole.role === 'supervisor' ? (
        <AdminDashboard onShowPricing={() => setShowPricing(true)} />
      ) : (
        <TeamMemberPortal />
      )}

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
