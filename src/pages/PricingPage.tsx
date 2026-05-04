import { useState, useEffect } from 'react';
import { Check, X, Zap, Star, Rocket, Gift, ArrowLeft, MessageSquare } from 'lucide-react';

interface PricingPageProps {
  onBack?: () => void;
  onSelectPlan?: (planId: string, planName: string, planPrice: number) => void;
}

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: number | null;
  priceSuffix?: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  borderColor: string;
  headerBg: string;
  ctaLabel: string;
  ctaStyle: string;
  features: PlanFeature[];
  highlight?: boolean;
  trialDays?: number;
}

const plans: Plan[] = [
  {
    id: 'free_trial',
    name: 'Free Trial',
    price: 0,
    priceSuffix: '15 days',
    description: 'Try QueryPing free for 15 days. No credit card required.',
    icon: <Gift className="w-6 h-6" />,
    iconBg: 'bg-emerald-100 text-emerald-700',
    borderColor: 'border-slate-200',
    headerBg: 'bg-slate-50',
    ctaLabel: 'Start Free Trial',
    ctaStyle: 'bg-slate-800 hover:bg-slate-900 text-white',
    trialDays: 15,
    features: [
      { text: '1 Supervisor account', included: true },
      { text: 'Up to 5 team members', included: true },
      { text: 'Up to 100 total queries', included: true },
      { text: 'Email notifications', included: true },
      { text: 'Basic query management', included: true },
      { text: 'WhatsApp notifications', included: false },
      { text: 'Reports & analytics', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 149,
    description: 'Perfect for small teams getting started with query management.',
    icon: <Zap className="w-6 h-6" />,
    iconBg: 'bg-blue-100 text-blue-700',
    borderColor: 'border-blue-200',
    headerBg: 'bg-blue-50',
    ctaLabel: 'Get Basic',
    ctaStyle: 'bg-blue-600 hover:bg-blue-700 text-white',
    features: [
      { text: '200 new queries / month', included: true },
      { text: 'Unlimited supervisors', included: true },
      { text: 'Unlimited team members', included: true },
      { text: 'Email notifications', included: true },
      { text: 'WhatsApp notifications', included: true },
      { text: 'Query reports', included: true },
      { text: 'Email support', included: true },
      { text: 'Advanced analytics', included: false },
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 499,
    badge: 'Most Popular',
    badgeColor: 'bg-amber-500 text-white',
    description: 'The ideal plan for growing businesses with high query volumes.',
    icon: <Rocket className="w-6 h-6" />,
    iconBg: 'bg-amber-100 text-amber-700',
    borderColor: 'border-amber-400',
    headerBg: 'bg-gradient-to-br from-amber-50 to-orange-50',
    ctaLabel: 'Get Standard',
    ctaStyle: 'bg-amber-500 hover:bg-amber-600 text-white',
    highlight: true,
    features: [
      { text: '600 new queries / month', included: true },
      { text: 'Unlimited supervisors', included: true },
      { text: 'Unlimited team members', included: true },
      { text: 'Email notifications', included: true },
      { text: 'WhatsApp notifications', included: true },
      { text: 'Reports & analytics', included: true },
      { text: 'Email support', included: true },
      { text: 'Advanced analytics', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 999,
    badge: 'Best Value',
    badgeColor: 'bg-slate-800 text-white',
    description: 'Unlimited power for enterprises with maximum throughput needs.',
    icon: <Star className="w-6 h-6" />,
    iconBg: 'bg-slate-100 text-slate-800',
    borderColor: 'border-slate-800',
    headerBg: 'bg-gradient-to-br from-slate-800 to-slate-700',
    ctaLabel: 'Get Premium',
    ctaStyle: 'bg-slate-800 hover:bg-slate-900 text-white',
    features: [
      { text: 'Unlimited queries (fair use)', included: true },
      { text: 'Unlimited supervisors', included: true },
      { text: 'Unlimited team members', included: true },
      { text: 'Email notifications', included: true },
      { text: 'WhatsApp notifications', included: true },
      { text: 'Advanced reports & analytics', included: true },
      { text: 'Priority support', included: true },
      { text: 'Early access to new features', included: true },
    ],
  },
];

function PlanCard({ plan, onSelectPlan }: { plan: Plan; onSelectPlan?: (planId: string, planName: string, planPrice: number) => void }) {
  const isPremiumHeader = plan.id === 'premium';

  return (
    <div
      className={`relative rounded-2xl border-2 ${plan.borderColor} flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl ${
        plan.highlight ? 'shadow-lg scale-[1.02]' : 'shadow-sm'
      }`}
    >
      {plan.badge && (
        <div className="absolute top-4 right-4 z-10">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${plan.badgeColor}`}>
            {plan.badge}
          </span>
        </div>
      )}

      <div className={`${plan.headerBg} px-6 pt-6 pb-8`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${plan.iconBg}`}>
          {plan.icon}
        </div>
        <h3 className={`text-xl font-bold mb-1 ${isPremiumHeader ? 'text-white' : 'text-slate-900'}`}>
          {plan.name}
        </h3>
        <p className={`text-sm mb-4 ${isPremiumHeader ? 'text-slate-300' : 'text-slate-500'}`}>
          {plan.description}
        </p>
        <div className="flex items-end gap-1">
          {plan.price === 0 ? (
            <span className={`text-4xl font-extrabold ${isPremiumHeader ? 'text-white' : 'text-slate-900'}`}>
              Free
            </span>
          ) : (
            <>
              <span className={`text-sm font-medium mt-1 ${isPremiumHeader ? 'text-slate-300' : 'text-slate-500'}`}>
                ৳
              </span>
              <span className={`text-4xl font-extrabold leading-none ${isPremiumHeader ? 'text-white' : 'text-slate-900'}`}>
                {plan.price?.toLocaleString()}
              </span>
              <span className={`text-sm mb-1 ${isPremiumHeader ? 'text-slate-300' : 'text-slate-500'}`}>
                /month
              </span>
            </>
          )}
        </div>
        {plan.priceSuffix && (
          <p className={`text-xs mt-1 ${isPremiumHeader ? 'text-slate-400' : 'text-slate-400'}`}>
            {plan.priceSuffix}
          </p>
        )}
      </div>

      <div className="bg-white px-6 py-6 flex flex-col flex-1">
        <ul className="space-y-3 flex-1 mb-6">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3">
              {feature.included ? (
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
              )}
              <span className={`text-sm ${feature.included ? 'text-slate-700' : 'text-slate-400'}`}>
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => {
            if (plan.price && plan.price > 0 && onSelectPlan) {
              onSelectPlan(plan.id, plan.name, plan.price);
            }
          }}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${plan.ctaStyle}`}
        >
          {plan.ctaLabel}
        </button>
      </div>
    </div>
  );
}

export default function PricingPage({ onBack, onSelectPlan }: PricingPageProps) {
  const [billingFAQ, setBillingFAQ] = useState<number | null>(null);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const faqs = [
    {
      q: 'What happens after the free trial ends?',
      a: 'Your account will be paused and you will need to choose a paid plan to continue using QueryPing. All your data will be preserved for 30 days before permanent deletion.',
    },
    {
      q: 'Can I upgrade or downgrade my plan?',
      a: 'Yes, you can change your plan at any time. Upgrades take effect immediately and you will be charged the prorated difference. Downgrades take effect at the start of the next billing cycle.',
    },
    {
      q: 'What does "Unlimited supervisors & members" mean?',
      a: 'On paid plans, there are no hard limits on the number of users. However, the super admin can configure user limits from the account settings panel.',
    },
    {
      q: 'What is "fair use" on the Premium plan?',
      a: 'Premium is designed for high-volume businesses. Fair use means the plan supports very high query volumes comfortably — well beyond what most businesses need.',
    },
    {
      q: 'Do unused queries roll over?',
      a: 'No. Query limits reset at the start of each billing month. Unused queries from the previous month do not carry over.',
    },
    {
      q: 'What payment methods are accepted?',
      a: 'We accept bank transfers, mobile banking (bKash, Nagad), and card payments. Contact us for enterprise payment arrangements.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors mr-1"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <MessageSquare className="w-7 h-7 text-slate-800" />
              <span className="text-xl font-bold text-slate-900">QueryPing</span>
            </div>
          </div>
          <a
            href="#pricing"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block"
          >
            View Plans
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 text-white pt-24 pb-32 px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/10 border border-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wider uppercase">
            Simple, Transparent Pricing
          </span>
          <h1 className="text-5xl sm:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
            The right plan for<br />
            <span className="text-amber-400">every team</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Start free, scale as you grow. No hidden fees, no surprises. Cancel anytime.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 15-day free trial</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> No credit card required</span>
            <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      <section id="pricing" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onSelectPlan={onSelectPlan} />
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          All prices are in Bangladeshi Taka (৳) and billed monthly. Member limits are configurable from admin settings.
        </p>
      </section>

      <section className="bg-slate-50 py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Compare Plans</h2>
            <p className="text-slate-500">A detailed look at what each plan includes</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-5 px-6 text-slate-700 font-semibold bg-slate-50 w-1/3">Feature</th>
                  {plans.map((p) => (
                    <th key={p.id} className={`py-5 px-4 text-center font-semibold ${p.highlight ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-700'}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Price (৳/month)', values: ['Free', '৳149', '৳499', '৳999'] },
                  { label: 'Query limit', values: ['100 total', '200/mo', '600/mo', 'Unlimited'] },
                  { label: 'Supervisors', values: ['1', 'Unlimited', 'Unlimited', 'Unlimited'] },
                  { label: 'Team members', values: ['Up to 5', 'Unlimited', 'Unlimited', 'Unlimited'] },
                  { label: 'Email notifications', values: [true, true, true, true] },
                  { label: 'WhatsApp notifications', values: [false, true, true, true] },
                  { label: 'Reports', values: [false, true, true, true] },
                  { label: 'Analytics', values: [false, false, true, true] },
                  { label: 'Advanced analytics', values: [false, false, false, true] },
                  { label: 'Email support', values: [false, true, true, true] },
                  { label: 'Priority support', values: [false, false, false, true] },
                  { label: 'Early feature access', values: [false, false, false, true] },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="py-4 px-6 text-slate-700 font-medium">{row.label}</td>
                    {row.values.map((val, j) => (
                      <td key={j} className={`py-4 px-4 text-center ${plans[j].highlight ? 'bg-amber-50/30' : ''}`}>
                        {typeof val === 'boolean' ? (
                          val ? (
                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-slate-700 font-medium">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Frequently Asked Questions</h2>
            <p className="text-slate-500">Everything you need to know about our plans</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="border border-slate-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setBillingFAQ(billingFAQ === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-medium text-slate-800 text-sm">{faq.q}</span>
                  <span className={`text-slate-400 text-lg font-light transition-transform duration-200 flex-shrink-0 ml-4 ${billingFAQ === i ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </button>
                {billingFAQ === i && (
                  <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-slate-800 to-slate-900 py-24 px-4 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-4">Ready to get started?</h2>
          <p className="text-slate-300 text-lg mb-10">
            Join teams that trust QueryPing to stay on top of every customer query.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onBack}
              className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/25"
            >
              Start Free Trial
            </button>
            <button className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all duration-200">
              Contact Sales
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-6">No credit card required. 15-day free trial.</p>
        </div>
      </section>

      <footer className="bg-slate-900 border-t border-slate-800 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-slate-400" />
            <span className="text-slate-400 text-sm font-medium">QueryPing</span>
          </div>
          <p className="text-slate-600 text-xs">
            &copy; {new Date().getFullYear()} QueryPing. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
