import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Mail, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

type VerificationState = 'loading' | 'success' | 'expired' | 'error';

export default function EmailVerificationPage() {
  const [state, setState] = useState<VerificationState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');
    const errorCode = params.get('error_code');
    const errorDesc = params.get('error_description');

    // Supabase redirects with error in hash when link is expired
    if (errorCode || errorDesc) {
      const isExpired =
        errorCode === 'otp_expired' ||
        (errorDesc ?? '').toLowerCase().includes('expired') ||
        (errorDesc ?? '').toLowerCase().includes('invalid');
      setState(isExpired ? 'expired' : 'error');
      setErrorMessage(errorDesc ?? errorCode ?? 'Unknown error');
      return;
    }

    if (!accessToken || !refreshToken) {
      // No tokens — could be a direct visit with no hash
      setState('error');
      setErrorMessage('No verification token found in this link.');
      return;
    }

    // Exchange tokens to confirm the session (this marks email as confirmed)
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          const msg = error.message.toLowerCase();
          const isExpired = msg.includes('expired') || msg.includes('invalid') || msg.includes('otp');
          setState(isExpired ? 'expired' : 'error');
          setErrorMessage(error.message);
        } else {
          setState('success');
          // Sign out so the user goes to login — we don't want them auto-logged in here
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
      });
  }, []);

  const goToSignIn = () => {
    window.location.href = 'https://queryping.org/';
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Verifying your account...</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 px-8 py-7 text-center">
              <p className="text-2xl font-bold text-white tracking-tight">QueryPing</p>
              <p className="text-slate-400 text-xs mt-1 tracking-wide">Never miss a pending query</p>
            </div>

            <div className="px-8 py-10 text-center">
              {/* Success icon */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <span className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </span>
              </div>

              <h1 className="text-2xl font-bold text-slate-900 mb-2">Email Verified!</h1>
              <p className="text-slate-500 text-sm leading-relaxed mb-2">
                Thank you for verifying your email address.
              </p>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Your <span className="font-semibold text-slate-700">QueryPing</span> account is now fully active. Sign in below and start managing your queries — we're glad you're here.
              </p>

              {/* Feature highlights */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                {[
                  { label: 'Query Management', icon: '📋' },
                  { label: 'Team Collaboration', icon: '👥' },
                  { label: 'Smart Digests', icon: '📬' },
                ].map(({ label, icon }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-2xl mb-1.5">{icon}</div>
                    <p className="text-slate-600 text-xs font-medium leading-tight">{label}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={goToSignIn}
                className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors"
              >
                Sign In to Your Account
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-slate-400 text-xs mt-5 leading-relaxed">
                Need help? Contact us at{' '}
                <a href="mailto:support.queryping@gmail.com" className="text-slate-600 underline underline-offset-2 hover:text-slate-800">
                  support.queryping@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-8 py-7 text-center">
              <p className="text-2xl font-bold text-white tracking-tight">QueryPing</p>
              <p className="text-slate-400 text-xs mt-1 tracking-wide">Never miss a pending query</p>
            </div>

            <div className="px-8 py-10 text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>

              <h1 className="text-2xl font-bold text-slate-900 mb-2">Link Expired</h1>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Sorry, this verification link has expired. Verification links are only valid for <span className="font-semibold text-slate-700">24 hours</span> after signup.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-left">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-amber-800 text-sm font-semibold mb-1">What should I do?</p>
                    <p className="text-amber-700 text-sm leading-relaxed">
                      Please create a new account at{' '}
                      <a href="https://queryping.org/" className="underline font-medium hover:text-amber-900">
                        queryping.org
                      </a>
                      . Your previous account may not be fully set up — starting fresh ensures everything works correctly.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={goToSignIn}
                className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors mb-3"
              >
                Go to QueryPing
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-slate-400 text-xs mt-4 leading-relaxed">
                Need help? Contact{' '}
                <a href="mailto:support.queryping@gmail.com" className="text-slate-600 underline underline-offset-2 hover:text-slate-800">
                  support.queryping@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generic error fallback
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-8 py-7 text-center">
          <p className="text-2xl font-bold text-white tracking-tight">QueryPing</p>
          <p className="text-slate-400 text-xs mt-1 tracking-wide">Never miss a pending query</p>
        </div>
        <div className="px-8 py-10 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Verification Failed</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            We couldn't verify your account. The link may be invalid or already used.
          </p>
          {errorMessage && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-4 py-2 mb-6 font-mono">{errorMessage}</p>
          )}
          <button
            type="button"
            onClick={goToSignIn}
            className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors"
          >
            Go to QueryPing
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
