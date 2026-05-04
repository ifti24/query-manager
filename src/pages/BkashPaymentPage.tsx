import { ArrowLeft, MessageSquare, Copy, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Phone, Mail, Clock, Shield, Smartphone, CreditCard, Send } from 'lucide-react';
import { useState } from 'react';

interface BkashPaymentPageProps {
  planName: string;
  planPrice: number;
  planId: string;
  onBack: () => void;
}

const BKASH_NUMBER = '01737434318';
const SUPPORT_EMAIL = 'billing.qp@gmail.com';

const STEPS = [
  {
    step: 1,
    title: 'Open bKash App',
    description: 'Open the bKash app on your smartphone. Make sure you are logged in to your bKash account.',
    icon: <Smartphone className="w-6 h-6" />,
    detail: 'If you don\'t have the bKash app, download it from Google Play Store or Apple App Store.',
    color: 'bg-pink-50 border-pink-200 text-pink-700',
    iconBg: 'bg-pink-500',
  },
  {
    step: 2,
    title: 'Tap "Send Money"',
    description: 'From the bKash home screen, tap the "Send Money" option.',
    icon: <Send className="w-6 h-6" />,
    detail: 'The "Send Money" button is prominently displayed on the bKash app home screen.',
    color: 'bg-rose-50 border-rose-200 text-rose-700',
    iconBg: 'bg-rose-500',
  },
  {
    step: 3,
    title: 'Enter QueryPing bKash Number',
    description: `Enter the QueryPing bKash number: ${BKASH_NUMBER}`,
    icon: <Phone className="w-6 h-6" />,
    detail: 'Double-check the number before proceeding. You can copy it from the box below.',
    color: 'bg-orange-50 border-orange-200 text-orange-700',
    iconBg: 'bg-orange-500',
    copyable: BKASH_NUMBER,
  },
  {
    step: 4,
    title: 'Enter Exact Amount',
    description: 'Enter the exact subscription amount for your chosen plan.',
    icon: <CreditCard className="w-6 h-6" />,
    detail: 'Make sure the amount matches your plan price exactly to avoid delays in processing.',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    iconBg: 'bg-amber-500',
  },
  {
    step: 5,
    title: 'Add Your Reference',
    description: 'In the reference/note field, write your registered email address.',
    icon: <Mail className="w-6 h-6" />,
    detail: 'This helps us identify your payment quickly. Example: john@company.com',
    color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    iconBg: 'bg-yellow-500',
  },
  {
    step: 6,
    title: 'Confirm & Complete Payment',
    description: 'Review all details and tap "Send Money" to complete the transaction.',
    icon: <CheckCircle className="w-6 h-6" />,
    detail: 'You will receive a bKash confirmation SMS with a Transaction ID. Save this for reference.',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    iconBg: 'bg-emerald-500',
  },
  {
    step: 7,
    title: 'Send Payment Proof to Us',
    description: `Email your payment screenshot + Transaction ID to ${SUPPORT_EMAIL}`,
    icon: <Mail className="w-6 h-6" />,
    detail: `Send an email to ${SUPPORT_EMAIL} with: (1) Screenshot of the bKash confirmation, (2) Transaction ID, (3) Your registered email, (4) Plan you selected.`,
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    iconBg: 'bg-blue-500',
    copyable: SUPPORT_EMAIL,
  },
];

const PLAN_COLORS: Record<string, { gradient: string; badge: string; border: string }> = {
  basic: { gradient: 'from-blue-600 to-blue-700', badge: 'bg-blue-100 text-blue-700', border: 'border-blue-300' },
  standard: { gradient: 'from-amber-500 to-orange-600', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-300' },
  premium: { gradient: 'from-slate-800 to-slate-900', badge: 'bg-slate-100 text-slate-700', border: 'border-slate-400' },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
        copied
          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
      }`}
    >
      {copied ? (
        <>
          <CheckCircle className="w-3.5 h-3.5" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          Copy
        </>
      )}
    </button>
  );
}

export default function BkashPaymentPage({ planName, planPrice, planId, onBack }: BkashPaymentPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const colors = PLAN_COLORS[planId] || PLAN_COLORS.basic;

  const faqs = [
    {
      q: 'When will my subscription be activated?',
      a: 'Within 24 hours of receiving your payment confirmation email. We verify payments manually and activate your account as quickly as possible.',
    },
    {
      q: 'What if I sent the wrong amount?',
      a: `Contact us immediately at ${SUPPORT_EMAIL} with your transaction ID. We will resolve it promptly.`,
    },
    {
      q: 'Is my payment secure?',
      a: 'Yes. bKash is a regulated mobile financial service in Bangladesh. Your payment is protected by bKash\'s security infrastructure.',
    },
    {
      q: 'What if I don\'t receive confirmation within 24 hours?',
      a: `Email us at ${SUPPORT_EMAIL} with your transaction ID and payment screenshot. Our team will investigate and activate your account manually.`,
    },
    {
      q: 'Can I get a refund?',
      a: 'Refunds are evaluated on a case-by-case basis. Contact our support team within 7 days of payment for refund requests.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-pink-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-slate-800" />
              <span className="text-lg font-bold text-slate-900">QueryPing</span>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${colors.badge} ${colors.border}`}>
            {planName} Plan
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

        {/* Manual payment notice banner */}
        <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 p-6">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-base mb-1">Payment & Subscription Notice</h3>
              <p className="text-amber-800 text-sm leading-relaxed mb-2">
                Right now, payment and subscription activation is <strong>not automatic</strong>. We are actively working on it — auto-renewal after payment will be available very soon.
              </p>
              <p className="text-amber-700 text-sm leading-relaxed">
                For now, please follow the manual payment steps below. After payment, email us your proof and we will activate your subscription within <strong>24 hours</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Steps */}
          <div className="lg:col-span-2 space-y-4">
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Pay with bKash</h1>
              <p className="text-slate-500 text-sm">Follow these steps to complete your payment securely via bKash Send Money.</p>
            </div>

            {STEPS.map((step, idx) => (
              <div
                key={idx}
                className="relative bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm ${step.iconBg}`}>
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step {step.step}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base mb-1">{step.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>

                    {step.copyable && (
                      <div className="mt-3 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <code className="text-sm font-bold text-slate-800 flex-1 break-all">{step.copyable}</code>
                        <CopyButton text={step.copyable} />
                      </div>
                    )}

                    {step.step === 4 && (
                      <div className="mt-3 flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                        <span className="text-xs text-emerald-600 font-medium">Amount to send:</span>
                        <span className="text-lg font-extrabold text-emerald-800">৳{planPrice.toLocaleString()}</span>
                        <CopyButton text={planPrice.toString()} />
                      </div>
                    )}

                    <p className="mt-2 text-xs text-slate-400 italic leading-relaxed">{step.detail}</p>
                  </div>
                </div>

                {idx < STEPS.length - 1 && (
                  <div className="absolute -bottom-4 left-[2.125rem] w-0.5 h-4 bg-slate-200 z-10" />
                )}
              </div>
            ))}
          </div>

          {/* Right: Summary card + contact */}
          <div className="space-y-5">

            {/* Plan summary */}
            <div className={`rounded-2xl bg-gradient-to-br ${colors.gradient} text-white p-6 shadow-lg`}>
              <div className="mb-4">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">You are subscribing to</p>
                <h2 className="text-2xl font-extrabold">{planName} Plan</h2>
              </div>
              <div className="bg-white/10 rounded-xl p-4 mb-4">
                <div className="flex items-end gap-1">
                  <span className="text-white/80 text-sm font-medium">৳</span>
                  <span className="text-4xl font-extrabold leading-none">{planPrice.toLocaleString()}</span>
                  <span className="text-white/80 text-sm mb-1">/month</span>
                </div>
                <p className="text-white/60 text-xs mt-1">Billed manually · Renews with payment</p>
              </div>
              <div className="space-y-2 text-sm text-white/80">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-white/60 flex-shrink-0" />
                  <span>Secure bKash payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-white/60 flex-shrink-0" />
                  <span>Activated within 24 hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-white/60 flex-shrink-0" />
                  <span>Confirmation sent by email</span>
                </div>
              </div>
            </div>

            {/* bKash number quick access */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">bKash Account (QueryPing)</p>
              <div className="flex items-center justify-between gap-3 p-3.5 bg-pink-50 rounded-xl border border-pink-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base font-extrabold text-slate-900 tracking-wide">{BKASH_NUMBER}</span>
                </div>
                <CopyButton text={BKASH_NUMBER} />
              </div>
            </div>

            {/* After payment instructions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h4 className="font-bold text-slate-800 text-sm mb-3">After Payment</h4>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">1</div>
                  <span>Take a screenshot of your bKash confirmation</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">2</div>
                  <span>Note down your Transaction ID (TrxID)</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">3</div>
                  <span>Email both to us at:</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <code className="text-sm font-bold text-slate-800 flex-1 break-all">{SUPPORT_EMAIL}</code>
                <CopyButton text={SUPPORT_EMAIL} />
              </div>
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">Subscription activated within <strong>24 hours</strong></p>
              </div>
            </div>

            {/* Contact support */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
              <h4 className="font-bold text-sm mb-2">Need Help?</h4>
              <p className="text-slate-400 text-xs mb-3 leading-relaxed">
                Having trouble completing the payment? Our support team is ready to help.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-2 text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Mail className="w-4 h-4" />
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Frequently Asked Questions</h2>
            <p className="text-slate-500 text-sm">Common questions about our payment process</p>
          </div>
          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-medium text-slate-800 text-sm">{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 ml-4" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-4" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 pt-2 text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pricing Plans
          </button>
        </div>
      </div>

      <footer className="border-t border-slate-200 mt-16 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-slate-400" />
            <span className="text-slate-400 text-sm font-medium">QueryPing</span>
          </div>
          <p className="text-slate-400 text-xs">
            &copy; {new Date().getFullYear()} QueryPing. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
