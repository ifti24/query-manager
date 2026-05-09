import { useState, useEffect } from 'react';
import { Mail, Lock, User, Building2, CircleUser as UserCircle, Users, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { signIn, signUp } from '../lib/auth';
import { PasswordStrengthIndicator } from '../components/auth/PasswordStrengthIndicator';
import { supabase } from '../lib/supabase';
import { getPasswordPolicy, validatePassword, PasswordPolicy } from '../lib/passwordPolicy';
import PhoneInput from '../components/common/PhoneInput';

interface LoginPageProps {
  onShowPricing?: () => void;
}

type AccountType = 'business' | 'individual';

interface SignUpFormData {
  accountType: AccountType;
  accountDisplayName: string;
  email: string;
  mobileNumber: string;
  password: string;
  confirmPassword: string;
  expectedSupervisorCount: string;
  expectedMemberCount: string;
}

const STEPS = ['Account Type', 'Account Details', 'Access & Security'];

export default function LoginPage({ onShowPricing }: LoginPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [signUpRequiredVerification, setSignUpRequiredVerification] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy | null>(null);

  const [formData, setFormData] = useState<SignUpFormData>({
    accountType: 'individual',
    accountDisplayName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
    expectedSupervisorCount: '',
    expectedMemberCount: '',
  });

  useEffect(() => {
    const fetchPolicy = async () => {
      const policy = await getPasswordPolicy();
      if (policy) setPasswordPolicy(policy);
    };
    fetchPolicy();
  }, []);

  const updateField = (field: keyof SignUpFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (): string => {
    if (currentStep === 0) {
      if (!formData.accountType) return 'Please select an account type.';
    }
    if (currentStep === 1) {
      if (!formData.accountDisplayName.trim()) {
        return formData.accountType === 'business'
          ? 'Company name is required.'
          : 'Your full name is required.';
      }
      if (formData.accountType === 'business' && (!formData.expectedSupervisorCount || parseInt(formData.expectedSupervisorCount) < 1)) {
        return 'Expected supervisor count must be at least 1.';
      }
      if (!formData.expectedMemberCount || parseInt(formData.expectedMemberCount) < 1) {
        return 'Expected member count must be at least 1.';
      }
    }
    if (currentStep === 2) {
      if (!formData.email.trim()) return 'Email address is required.';
      if (!formData.mobileNumber.trim()) return 'Mobile number is required.';
      if (!formData.password) return 'Password is required.';
      if (passwordPolicy) {
        const validation = validatePassword(formData.password, passwordPolicy);
        if (!validation.valid) return validation.errors.join('. ');
      }
      if (!formData.confirmPassword) return 'Please confirm your password.';
      if (formData.password !== formData.confirmPassword) return 'Passwords do not match.';
    }
    return '';
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setCurrentStep(s => s + 1);
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(s => s - 1);
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      // Fetch platform verification setting before signing up
      const { data: settingsData } = await supabase
        .from('admin_settings')
        .select('require_email_verification')
        .maybeSingle();
      const requireVerification = settingsData?.require_email_verification ?? false;

      const data = await signUp({
        email: formData.email,
        password: formData.password,
        fullName: formData.accountDisplayName,
        mobileNumber: formData.mobileNumber,
        accountType: formData.accountType,
        accountDisplayName: formData.accountDisplayName,
        expectedSupervisorCount: parseInt(formData.expectedSupervisorCount) || 0,
        expectedMemberCount: parseInt(formData.expectedMemberCount) || 0,
        emailRedirectTo: requireVerification ? window.location.origin : undefined,
      });

      if (data.user) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        await fetch(`${supabaseUrl}/functions/v1/signup-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            email: formData.email,
            fullName: formData.accountDisplayName,
            mobileNumber: formData.mobileNumber,
            accountType: formData.accountType,
            accountDisplayName: formData.accountDisplayName,
            expectedSupervisorCount: parseInt(formData.expectedSupervisorCount) || 0,
            expectedMemberCount: parseInt(formData.expectedMemberCount) || 0,
            appUrl: window.location.origin,
          }),
        });
      }

      setSignUpRequiredVerification(requireVerification);
      setSignUpSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetSignUp = () => {
    setCurrentStep(0);
    setFormData({
      accountType: 'individual',
      accountDisplayName: '',
      email: '',
      mobileNumber: '',
      password: '',
      confirmPassword: '',
      expectedSupervisorCount: '',
      expectedMemberCount: '',
    });
    setError('');
  };

  if (signUpSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="text-center px-8 pt-8 pb-6 border-b border-slate-100">
            <h1 className="text-3xl font-bold text-slate-900 mb-1">QueryPing</h1>
            <p className="text-xs text-slate-400 tracking-wide">Never miss a pending query</p>
          </div>

          {signUpRequiredVerification ? (
            /* Verification required — user must verify before logging in */
            <div className="px-8 py-8">
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-full flex items-center justify-center">
                  <Mail className="w-8 h-8 text-amber-500" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-slate-900 text-center mb-1">Verify Your Email to Continue</h2>
              <p className="text-slate-500 text-sm text-center mb-6">
                Account created for <span className="font-semibold text-slate-700">{formData.accountDisplayName}</span>
              </p>

              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">Email verification is required</p>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    You <strong>cannot log in</strong> until you verify your email address. We sent a verification link to{' '}
                    <span className="font-semibold">{formData.email}</span>.
                  </p>
                </div>
              </div>

              <ol className="space-y-3 mb-7">
                {[
                  { step: '1', text: 'Open your email inbox' },
                  { step: '2', text: 'Find the email from QueryPing Notifications' },
                  { step: '3', text: 'Click "Verify My Account" — the link expires in 24 hours' },
                  { step: '4', text: 'You will be redirected back here to sign in' },
                ].map(({ step, text }) => (
                  <li key={step} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{step}</span>
                    <span className="text-sm text-slate-600">{text}</span>
                  </li>
                ))}
              </ol>

              <p className="text-xs text-slate-400 text-center leading-relaxed">
                Didn't receive an email? Check your spam folder or contact{' '}
                <a href="mailto:support.queryping@gmail.com" className="text-slate-500 hover:text-slate-700 underline underline-offset-2">
                  support.queryping@gmail.com
                </a>
              </p>
            </div>
          ) : (
            /* No verification required — user can log in immediately */
            <div className="px-8 py-8">
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-500" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-slate-900 text-center mb-1">Account Created!</h2>
              <p className="text-slate-500 text-sm text-center mb-6">
                Your account for <span className="font-semibold text-slate-700">{formData.accountDisplayName}</span> is ready.
              </p>

              <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6">
                <Mail className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-600 leading-relaxed">
                  A welcome email has been sent to <span className="font-semibold text-slate-700">{formData.email}</span> with your account details.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSignUpSuccess(false);
                  setIsSignUp(false);
                  setEmail(formData.email);
                  resetSignUp();
                }}
                className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium hover:bg-slate-900 transition-colors text-sm"
              >
                Sign In Now
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <ForgotPasswordContent onBack={() => setShowForgotPassword(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className={`w-full bg-white rounded-2xl shadow-xl border border-slate-200 transition-all duration-300 ${isSignUp ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="text-center px-8 pt-8 pb-6 border-b border-slate-100">
          <h1 className="text-3xl font-bold text-slate-900 mb-1">QueryPing</h1>
          <p className="text-xs text-slate-400 tracking-wide">Never miss a pending query</p>
        </div>

        <div className="px-8 py-7">
          {isSignUp ? (
            <SignUpForm
              currentStep={currentStep}
              formData={formData}
              error={error}
              loading={loading}
              passwordPolicy={passwordPolicy}
              updateField={updateField}
              onNext={handleNext}
              onBack={handleBack}
              onSubmit={handleSignUpSubmit}
            />
          ) : (
            <SignInForm
              email={email}
              password={password}
              error={error}
              loading={loading}
              setEmail={setEmail}
              setPassword={setPassword}
              onSubmit={handleSignInSubmit}
              onForgotPassword={() => setShowForgotPassword(true)}
            />
          )}

          <div className="mt-5 pt-5 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                if (isSignUp) resetSignUp();
              }}
              className="text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"}
            </button>

            {onShowPricing && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={onShowPricing}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  View pricing plans
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SignInFormProps {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
}

function SignInForm({ email, password, error, loading, setEmail, setPassword, onSubmit, onForgotPassword }: SignInFormProps) {
  return (
    <>
      <p className="text-slate-700 font-bold mb-6 text-lg">Sign in to your account</p>

      {error && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-2">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 text-sm"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-700 text-sm font-medium mb-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 text-sm"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs text-slate-500 hover:text-slate-800 mt-1.5 transition-colors"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium hover:bg-slate-900 transition-colors disabled:bg-slate-400 text-sm mt-2"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </>
  );
}

interface SignUpFormProps {
  currentStep: number;
  formData: SignUpFormData;
  error: string;
  loading: boolean;
  passwordPolicy: PasswordPolicy | null;
  updateField: (field: keyof SignUpFormData, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function SignUpForm({ currentStep, formData, error, loading, passwordPolicy, updateField, onNext, onBack, onSubmit }: SignUpFormProps) {
  return (
    <>
      <div className="mb-6">
        <p className="text-slate-700 font-bold text-lg mb-4">Create your account</p>

        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                    i < currentStep
                      ? 'bg-emerald-500 text-white'
                      : i === currentStep
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {i < currentStep ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs mt-1 whitespace-nowrap font-medium ${i === currentStep ? 'text-slate-700' : i < currentStep ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {step}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 mb-4 transition-colors duration-200 ${i < currentStep ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {currentStep === 0 && <StepAccountType formData={formData} updateField={updateField} />}
      {currentStep === 1 && <StepAccountDetails formData={formData} updateField={updateField} />}
      {currentStep === 2 && (
        <form onSubmit={onSubmit}>
          <StepAccessSecurity formData={formData} updateField={updateField} passwordPolicy={passwordPolicy} />
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors text-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-slate-800 text-white py-2.5 rounded-lg font-medium hover:bg-slate-900 transition-colors disabled:bg-slate-400 text-sm"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        </form>
      )}

      {currentStep < 2 && (
        <div className="flex gap-3 mt-6">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors text-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 text-white py-2.5 rounded-lg font-medium hover:bg-slate-900 transition-colors text-sm"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}

function StepAccountType({ formData, updateField }: { formData: SignUpFormData; updateField: (f: keyof SignUpFormData, v: string) => void }) {
  return (
    <div>
      <p className="text-slate-600 text-sm mb-4">How will you be using QueryPing?</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => updateField('accountType', 'individual')}
          className={`relative p-5 rounded-xl border-2 text-left transition-all duration-150 ${
            formData.accountType === 'individual'
              ? 'border-slate-800 bg-slate-50'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          {formData.accountType === 'individual' && (
            <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </span>
          )}
          <UserCircle className={`w-7 h-7 mb-3 ${formData.accountType === 'individual' ? 'text-slate-800' : 'text-slate-400'}`} />
          <p className={`font-semibold text-sm ${formData.accountType === 'individual' ? 'text-slate-800' : 'text-slate-600'}`}>Individual</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">For solo professionals</p>
        </button>

        <button
          type="button"
          onClick={() => updateField('accountType', 'business')}
          className={`relative p-5 rounded-xl border-2 text-left transition-all duration-150 ${
            formData.accountType === 'business'
              ? 'border-slate-800 bg-slate-50'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          {formData.accountType === 'business' && (
            <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </span>
          )}
          <Building2 className={`w-7 h-7 mb-3 ${formData.accountType === 'business' ? 'text-slate-800' : 'text-slate-400'}`} />
          <p className={`font-semibold text-sm ${formData.accountType === 'business' ? 'text-slate-800' : 'text-slate-600'}`}>Business</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">For companies and organisations</p>
        </button>
      </div>
    </div>
  );
}

function StepAccountDetails({ formData, updateField }: { formData: SignUpFormData; updateField: (f: keyof SignUpFormData, v: string) => void }) {
  const isBusiness = formData.accountType === 'business';
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-slate-700 text-sm font-medium mb-2">
          {isBusiness ? 'Company Name' : 'Your Full Name'}
        </label>
        <div className="relative">
          {isBusiness
            ? <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            : <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          }
          <input
            type="text"
            value={formData.accountDisplayName}
            onChange={(e) => updateField('accountDisplayName', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 text-sm"
            placeholder={isBusiness ? 'Acme Corp' : 'John Doe'}
          />
        </div>
      </div>

      <div className={isBusiness ? 'grid grid-cols-2 gap-3' : ''}>
        {isBusiness && (
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-2">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Expected Supervisors
              </span>
            </label>
            <input
              type="number"
              min="1"
              value={formData.expectedSupervisorCount}
              onChange={(e) => updateField('expectedSupervisorCount', e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 text-sm"
              placeholder="e.g. 5"
            />
            <p className="text-xs text-slate-400 mt-1">Users who manage queries</p>
          </div>
        )}

        <div>
          <label className="block text-slate-700 text-sm font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Expected Members
            </span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.expectedMemberCount}
            onChange={(e) => updateField('expectedMemberCount', e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 text-sm"
            placeholder="e.g. 20"
          />
          <p className="text-xs text-slate-400 mt-1">Users who submit queries</p>
        </div>
      </div>
    </div>
  );
}

interface StepAccessSecurityProps {
  formData: SignUpFormData;
  updateField: (f: keyof SignUpFormData, v: string) => void;
  passwordPolicy: PasswordPolicy | null;
}

function StepAccessSecurity({ formData, updateField, passwordPolicy }: StepAccessSecurityProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-slate-700 text-sm font-medium mb-2">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 text-sm"
            placeholder="you@example.com"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-slate-700 text-sm font-medium mb-2">Mobile Number</label>
        <PhoneInput
          value={formData.mobileNumber}
          onChange={(v) => updateField('mobileNumber', v)}
          required
        />
        <p className="text-xs text-slate-400 mt-1">Used for WhatsApp notifications and two-factor authentication</p>
      </div>

      <div>
        <label className="block text-slate-700 text-sm font-medium mb-2">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="password"
            value={formData.password}
            onChange={(e) => updateField('password', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 text-sm"
            placeholder="••••••••"
            required
          />
        </div>
        {passwordPolicy && (
          <PasswordStrengthIndicator password={formData.password} policy={passwordPolicy} />
        )}
      </div>

      <div>
        <label className="block text-slate-700 text-sm font-medium mb-2">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => updateField('confirmPassword', e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-100 text-sm ${
              formData.confirmPassword && formData.password !== formData.confirmPassword
                ? 'border-red-300 focus:border-red-400'
                : formData.confirmPassword && formData.password === formData.confirmPassword
                ? 'border-emerald-300 focus:border-emerald-400'
                : 'border-slate-300 focus:border-slate-600'
            }`}
            placeholder="••••••••"
            required
          />
          {formData.confirmPassword && formData.password === formData.confirmPassword && (
            <Check className="absolute right-3 top-3 w-4 h-4 text-emerald-500" />
          )}
        </div>
        {formData.confirmPassword && formData.password !== formData.confirmPassword && (
          <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
        )}
      </div>
    </div>
  );
}

function ForgotPasswordContent({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccess('Password reset link has been sent to your email. Please check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200">
      <div className="p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-500 text-sm hover:text-slate-700 mb-5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to login
        </button>

        <h1 className="text-2xl font-bold text-slate-900 mb-1.5">Forgot Password</h1>
        <p className="text-slate-500 text-sm mb-7">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-emerald-700 text-sm">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100 text-sm"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium hover:bg-slate-900 transition-colors disabled:bg-slate-400 text-sm"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      </div>
    </div>
  );
}
