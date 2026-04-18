import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPasswordPolicy, validatePassword, PasswordPolicy } from '../lib/passwordPolicy';
import { PasswordStrengthIndicator } from '../components/auth/PasswordStrengthIndicator';

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'used' | 'success' | 'error';

interface InviteData {
  fullName: string;
  email: string;
  role: string;
  supervisorName: string | null;
  accountName: string;
  tempPassword: string;
}

export default function AccountActivationPage() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [token, setToken] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showTemp, setShowTemp] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setPageState('invalid');
      return;
    }
    setToken(t);
    validateToken(t);
    getPasswordPolicy().then(p => { if (p) setPasswordPolicy(p); });
  }, []);

  const validateToken = async (t: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: 'validate', token: t }),
        }
      );

      const data = await response.json();

      if (response.status === 410) {
        if (data.error?.includes('already been used')) {
          setPageState('used');
        } else {
          setPageState('expired');
        }
        return;
      }

      if (!response.ok) {
        setPageState('invalid');
        return;
      }

      setInviteData({
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        supervisorName: data.supervisorName || null,
        accountName: data.accountName,
        tempPassword: data.tempPassword,
      });
      setPageState('valid');
    } catch {
      setPageState('error');
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!tempPassword) {
      setError('Please enter the temporary password from your email.');
      return;
    }

    if (inviteData && tempPassword !== inviteData.tempPassword) {
      setError('The temporary password you entered is incorrect.');
      return;
    }

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (passwordPolicy) {
      const result = validatePassword(newPassword, passwordPolicy, 'team_member');
      if (!result.valid) {
        setError(result.errors[0]);
        return;
      }
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: 'activate', token, newPassword }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Activation failed');

      // Sign in with the new password
      await supabase.auth.signInWithPassword({
        email: inviteData!.email,
        password: newPassword,
      });

      setPageState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = inviteData?.role === 'supervisor' ? 'Supervisor' : 'Member';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Brand Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">QueryPing</h1>
          <p className="text-xs text-slate-400 tracking-wide mt-1">Never miss a pending query</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

          {/* Loading */}
          {pageState === 'loading' && (
            <div className="px-8 py-16 text-center">
              <Loader className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-500 text-sm">Verifying your activation link...</p>
            </div>
          )}

          {/* Invalid token */}
          {(pageState === 'invalid' || pageState === 'error') && (
            <div className="px-8 py-12 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Invalid Link</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                This activation link is not valid. Please contact your administrator for a new invitation.
              </p>
            </div>
          )}

          {/* Expired token */}
          {pageState === 'expired' && (
            <div className="px-8 py-12 text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Link Expired</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                This activation link has expired. Please contact your administrator to send a new invitation.
              </p>
            </div>
          )}

          {/* Already used */}
          {pageState === 'used' && (
            <div className="px-8 py-12 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-slate-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Already Activated</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                This account has already been activated. You can sign in with your password.
              </p>
              <a
                href="/"
                className="inline-block w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium hover:bg-slate-900 transition-colors text-sm text-center"
              >
                Go to Sign In
              </a>
            </div>
          )}

          {/* Success */}
          {pageState === 'success' && (
            <div className="px-8 py-12 text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Account Activated!</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Your account has been activated and you are now signed in. Welcome to{' '}
                <span className="font-semibold text-slate-700">{inviteData?.accountName}</span>!
              </p>
              <a
                href="/"
                className="inline-block w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium hover:bg-slate-900 transition-colors text-sm text-center"
              >
                Go to Dashboard
              </a>
            </div>
          )}

          {/* Valid — activation form */}
          {pageState === 'valid' && inviteData && (
            <>
              <div className="bg-slate-800 px-6 py-5">
                <p className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-1">You've been invited to</p>
                <h2 className="text-white text-xl font-bold">{inviteData.accountName}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                    {roleLabel}
                  </span>
                  {inviteData.supervisorName && (
                    <span className="text-slate-400 text-xs">
                      reporting to <span className="text-slate-300 font-medium">{inviteData.supervisorName}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="px-6 py-6">
                <p className="text-slate-600 text-sm mb-5 leading-relaxed">
                  Hi <strong className="text-slate-800">{inviteData.fullName}</strong>, please enter the temporary password from your email and set a new permanent password to activate your account.
                </p>

                {error && (
                  <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <form onSubmit={handleActivate} className="space-y-4">
                  {/* Temporary password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Temporary Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type={showTemp ? 'text' : 'password'}
                        value={tempPassword}
                        onChange={e => setTempPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                        placeholder="Enter temp password from email"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowTemp(v => !v)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showTemp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                        placeholder="Choose a strong password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(v => !v)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordPolicy && (
                      <PasswordStrengthIndicator
                        password={newPassword}
                        policy={passwordPolicy}
                        userRole="team_member"
                      />
                    )}
                  </div>

                  {/* Confirm new password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={`w-full pl-9 pr-10 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-100 ${
                          confirmPassword && newPassword !== confirmPassword
                            ? 'border-red-300 focus:border-red-400'
                            : confirmPassword && newPassword === confirmPassword
                            ? 'border-emerald-300 focus:border-emerald-400'
                            : 'border-slate-300 focus:border-slate-600'
                        }`}
                        placeholder="Re-enter your new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium hover:bg-slate-900 transition-colors disabled:bg-slate-400 text-sm mt-2"
                  >
                    {loading ? 'Activating...' : 'Activate Account'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
