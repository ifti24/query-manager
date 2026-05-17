import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, CheckCircle, Bell, Users, BarChart2, ArrowRight,
  ChevronDown, Star, Clock, Shield, Mail,
  AlertTriangle, Target, FileText, X, Send, Eye, RefreshCw,
  TrendingUp, Inbox, AtSign, Layers
} from 'lucide-react';

interface LandingPageProps {
  onShowPricing: () => void;
  onStartTrial: () => void;
}

const BILLING_EMAIL = 'billing.queryping@gmail.com';
const SUPPORT_EMAIL = 'support.queryping@gmail.com';

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView();
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(target / (1800 / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const PROBLEMS = [
  { icon: <AlertTriangle className="w-5 h-5" />, text: 'You raise a query to your team and forget about it — follow-up falls on you every time' },
  { icon: <Clock className="w-5 h-5" />, text: 'No way to know if your team actually read, acknowledged, or responded to your query' },
  { icon: <MessageSquare className="w-5 h-5" />, text: 'Queries disappear in WhatsApp, email threads, or verbal conversations with no record' },
  { icon: <Users className="w-5 h-5" />, text: 'Team members give partial, off-the-cuff answers with no structure or accountability' },
];

const FEATURES = [
  {
    icon: <Send className="w-6 h-6" />,
    title: 'Raise a Query in Seconds',
    description: 'Type your question or task, assign it to the right person, and hit send. It\'s on record, timestamped, and tracked from that moment.',
    color: 'bg-blue-500',
  },
  {
    icon: <Bell className="w-6 h-6" />,
    title: 'Team Gets Notified Instantly',
    description: 'Assigned members receive an immediate notification — email or in-app. No excuses of "I didn\'t see it".',
    color: 'bg-amber-500',
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: 'Structured, On-Record Responses',
    description: 'Team members reply directly inside the query thread. Comments are organised, dated, and permanently attached to the original question.',
    color: 'bg-emerald-500',
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Real-Time Status Visibility',
    description: 'Every query shows its current state — open, in progress, responded, or closed. You see everything at a glance from your dashboard.',
    color: 'bg-cyan-500',
  },
  {
    icon: <RefreshCw className="w-6 h-6" />,
    title: 'Follow-Up Without the Chase',
    description: 'Set a deadline on any query. Automatic reminders go out to the assignee. You follow up once — the system does the rest.',
    color: 'bg-rose-500',
  },
  {
    icon: <BarChart2 className="w-6 h-6" />,
    title: 'Manager\'s Intelligence Panel',
    description: 'See who responds fast, who is slow, which queries are overdue, and your team\'s overall accountability score — all in one view.',
    color: 'bg-slate-600',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'You raise a query',
    description: 'Write your question, assign it to a team member or supervisor, and optionally set a response deadline.',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  {
    step: '02',
    title: 'Team member is notified',
    description: 'The assignee receives an instant notification. They can read the full query context before responding.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  {
    step: '03',
    title: 'Structured response is submitted',
    description: 'The team member types their response inside the thread — no scattered chats, no off-the-cuff answers.',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
  },
  {
    step: '04',
    title: 'You review and close',
    description: 'You get notified of the response, review it, add follow-up comments if needed, and close the query when satisfied.',
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-200',
  },
];

const TESTIMONIALS = [
  {
    quote: 'I used to spend 30 minutes every morning chasing my team for updates. Now I raise a query and by the time I check back, it\'s already answered with context.',
    name: 'Rafiq Ahmed',
    role: 'Operations Manager',
    company: 'Logistics Company, Dhaka',
    initials: 'RA',
    color: 'bg-blue-600',
  },
  {
    quote: 'My team used to give vague verbal answers. QueryPing forces them to write a proper response inside the thread — it\'s made everyone more accountable.',
    name: 'Nadia Islam',
    role: 'Department Head',
    company: 'Financial Services, Chittagong',
    initials: 'NI',
    color: 'bg-emerald-600',
  },
  {
    quote: 'The overdue alerts are a game changer. I don\'t have to follow up manually — the system pings them and they know I\'ll see if they\'re late.',
    name: 'Mahbub Hossain',
    role: 'Team Lead',
    company: 'E-commerce Operations, Bangladesh',
    initials: 'MH',
    color: 'bg-amber-600',
  },
];

const PLANS = [
  { name: 'Basic', price: 149, queries: '200 queries/month', highlight: false, color: 'border-blue-200 bg-blue-50', btn: 'bg-blue-600 hover:bg-blue-700', textDark: false },
  { name: 'Standard', price: 499, queries: '600 queries/month', highlight: true, color: 'border-amber-400 bg-amber-50', btn: 'bg-amber-500 hover:bg-amber-600', textDark: false },
  { name: 'Premium', price: 999, queries: 'Unlimited queries', highlight: false, color: 'border-slate-700 bg-slate-800', btn: 'bg-slate-900 hover:bg-black', textDark: true },
];

function NavBar({ onShowPricing, onStartTrial }: { onShowPricing: () => void; onStartTrial: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/98 shadow-md backdrop-blur-md' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className={`text-xl font-extrabold tracking-tight transition-colors ${scrolled ? 'text-slate-900' : 'text-white'}`}>
              QueryPing
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {['How it Works', 'Features', 'Pricing', 'Testimonials'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className={`text-sm font-medium transition-colors hover:text-amber-500 ${scrolled ? 'text-slate-600' : 'text-white/80'}`}>
                {item}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={onStartTrial}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${scrolled ? 'text-slate-700 hover:text-slate-900' : 'text-white/80 hover:text-white'}`}>
              Sign In
            </button>
            <button onClick={onStartTrial}
              className="text-sm font-bold px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
              Try Free — 15 Days
            </button>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)}
            className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? 'text-slate-700' : 'text-white'}`}>
            {menuOpen ? <X className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 py-4 space-y-2 px-2">
            {['How it Works', 'Features', 'Pricing', 'Testimonials'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-slate-700 hover:text-amber-600 rounded-lg hover:bg-slate-50 transition-colors">
                {item}
              </a>
            ))}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button onClick={onStartTrial} className="w-full text-sm font-semibold px-4 py-2.5 text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                Sign In
              </button>
              <button onClick={onStartTrial} className="w-full text-sm font-bold px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-400 transition-colors">
                Try Free — 15 Days
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default function LandingPage({ onShowPricing, onStartTrial }: LandingPageProps) {
  const featuresRef = useInView();
  const howItWorksRef = useInView();
  const testimonialsRef = useInView();
  const statsRef = useInView();
  const plansRef = useInView();

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <NavBar onShowPricing={onShowPricing} onStartTrial={onStartTrial} />

      {/* HERO */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-slate-950">
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px] opacity-15 pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500 rounded-full blur-[100px] opacity-10 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 lg:pt-32 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-2 mb-8">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-white/80 text-xs font-semibold tracking-wider uppercase">For managers who need answers</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
                From Query to Resolution,
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  Fully Tracked.
                </span>
              </h1>

              <p className="text-xl text-slate-300 leading-relaxed mb-10 max-w-lg">
                QueryPing lets managers raise questions directly to their team, track whether they've been read and answered, and follow up automatically — all in one structured thread.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <button onClick={onStartTrial}
                  className="group flex items-center justify-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-white font-bold text-lg rounded-2xl transition-all duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={onShowPricing}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-lg rounded-2xl transition-all duration-200">
                  View Pricing
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-5 text-sm text-slate-400">
                {['15-day free trial', 'No credit card needed', 'Setup in 2 minutes'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Hero visual: mock query thread */}
            <div className="hidden lg:block relative">
              <div className="relative bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
                {/* Browser bar */}
                <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-800 border-b border-slate-700">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  <div className="ml-3 flex-1 bg-slate-700 rounded-md h-5 text-xs text-slate-400 flex items-center px-3">
                    queryping.org/dashboard
                  </div>
                </div>
                <div className="p-5">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Open Queries', value: '9', color: 'text-amber-400' },
                      { label: 'Answered', value: '31', color: 'text-emerald-400' },
                      { label: 'Overdue', value: '2', color: 'text-red-400' },
                    ].map((s) => (
                      <div key={s.label} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                        <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Query rows */}
                  <div className="space-y-2 mb-4">
                    {[
                      { id: '#Q-22', subject: 'Why did shipment delay happen on April 28?', to: 'Rafiq A.', status: 'Answered', sc: 'text-emerald-400 bg-emerald-900/40', age: '1h ago' },
                      { id: '#Q-21', subject: 'Update on vendor payment reconciliation', to: 'Nadia I.', status: 'Pending', sc: 'text-amber-400 bg-amber-900/40', age: '4h ago' },
                      { id: '#Q-20', subject: 'March stock count discrepancy — explain', to: 'Mahbub H.', status: 'Overdue', sc: 'text-red-400 bg-red-900/40', age: '2d ago' },
                    ].map((q) => (
                      <div key={q.id} className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-3 py-2.5 border border-slate-700/50">
                        <span className="text-slate-500 text-xs font-mono w-12 flex-shrink-0">{q.id}</span>
                        <span className="text-slate-300 text-xs flex-1 truncate">{q.subject}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${q.sc}`}>{q.status}</span>
                      </div>
                    ))}
                  </div>

                  {/* Open thread preview */}
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                    <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Query Thread — #Q-22</p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-bold flex-shrink-0 mt-0.5">M</div>
                        <div className="bg-slate-700 rounded-xl rounded-tl-none px-3 py-2 flex-1">
                          <p className="text-xs text-slate-400 mb-0.5">You (Manager) · 9:14am</p>
                          <p className="text-slate-200 text-xs">What caused the shipment delay on April 28? I need a full explanation with root cause.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 justify-end">
                        <div className="bg-emerald-900/40 border border-emerald-800/50 rounded-xl rounded-tr-none px-3 py-2 flex-1 max-w-xs">
                          <p className="text-xs text-emerald-400/70 mb-0.5">Rafiq A. · 10:02am</p>
                          <p className="text-emerald-200 text-xs">Delay was due to a missed pickup by the courier. Re-scheduled for April 29 — confirmed delivered. Added a process note to prevent recurrence.</p>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-xs text-white font-bold flex-shrink-0 mt-0.5">R</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating notification */}
              <div className="absolute -right-6 -bottom-6 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-64" style={{ animation: 'bounceSlow 3s ease-in-out infinite' }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Query Answered</p>
                    <p className="text-xs text-slate-500 mt-0.5">Rafiq responded to #Q-22 in 48 min</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
          <ChevronDown className="w-6 h-6" />
        </div>
      </section>

      {/* PROBLEM STRIP */}
      <section className="bg-slate-50 border-y border-slate-200 py-14 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm font-bold text-slate-400 uppercase tracking-widest mb-10">
            Every manager knows this pain
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROBLEMS.map((p, i) => (
              <div key={i} className="flex items-start gap-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {p.icon}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-slate-500 text-sm">
            QueryPing was built to solve exactly this — for <span className="font-semibold text-slate-700">managers who need structured, accountable answers from their team</span>.
          </p>
        </div>
      </section>

      {/* STATS */}
      <section className="py-20 px-4 bg-white">
        <div ref={statsRef.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${statsRef.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { value: 89, suffix: '%', label: 'Fewer unanswered queries', color: 'text-blue-600' },
              { value: 4, suffix: 'x', label: 'Faster team response times', color: 'text-emerald-600' },
              { value: 15, suffix: ' min', label: 'To onboard your entire team', color: 'text-amber-600' },
              { value: 100, suffix: '+', label: 'Managers rely on QueryPing', color: 'text-rose-600' },
            ].map((stat, i) => (
              <div key={i}>
                <div className={`text-5xl font-extrabold ${stat.color} mb-2`}>
                  <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-4 bg-slate-950">
        <div ref={howItWorksRef.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${howItWorksRef.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <span className="inline-block text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">Simple by design</span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">How QueryPing works</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">You ask. They answer. It's all on record. Nothing gets lost.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className={`rounded-2xl border-2 ${step.bg} p-6 relative overflow-hidden`}>
                <div className="absolute top-4 right-4 text-5xl font-extrabold text-black/5 leading-none select-none">{step.step}</div>
                <div className={`text-4xl font-extrabold ${step.color} mb-4 leading-none`}>{step.step}</div>
                <h3 className="text-base font-bold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-4 bg-white">
        <div ref={featuresRef.ref} className={`max-w-7xl mx-auto transition-all duration-700 ${featuresRef.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <span className="inline-block text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Built for accountability</span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 leading-tight">
              Everything you need<br />to manage with clarity
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              From the moment you raise a query to the moment it's answered and closed — you're in full control.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="group bg-white rounded-2xl border-2 border-slate-100 p-6 hover:border-slate-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className={`w-12 h-12 ${f.color} rounded-xl flex items-center justify-center text-white mb-5 shadow-lg`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MANAGER SPOTLIGHT — side by side */}
      <section className="py-24 px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <span className="inline-block text-amber-400 text-xs font-bold uppercase tracking-widest mb-4">The manager's advantage</span>
              <h2 className="text-4xl font-extrabold text-white mb-6 leading-tight">
                You ask the question once.<br />
                <span className="text-amber-400">QueryPing handles the rest.</span>
              </h2>
              <p className="text-slate-300 text-lg leading-relaxed mb-8">
                Stop manually following up. When you raise a query, your team is automatically notified, reminded if they don't respond, and held accountable — all without you lifting a finger again.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <Target className="w-5 h-5" />, text: 'Assign any query to a specific person or team' },
                  { icon: <Clock className="w-5 h-5" />, text: 'Set a response deadline — automatic reminders follow' },
                  { icon: <Layers className="w-5 h-5" />, text: 'Thread-based responses keep context in one place' },
                  { icon: <TrendingUp className="w-5 h-5" />, text: 'Response rate and speed tracked per team member' },
                  { icon: <Inbox className="w-5 h-5" />, text: 'Daily digest shows all open and overdue queries' },
                  { icon: <AtSign className="w-5 h-5" />, text: 'Tag members for follow-up comments within threads' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <span className="text-slate-300 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live query thread mockup */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h4 className="text-white font-bold text-sm">Query #Q-22</h4>
                  <p className="text-slate-500 text-xs mt-0.5">Raised by you · 9:14am · Assigned to Rafiq Ahmed</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-900/60 text-emerald-400 border border-emerald-800">Answered</span>
              </div>

              {/* Thread */}
              <div className="space-y-4 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">M</div>
                  <div className="flex-1">
                    <div className="bg-slate-700 rounded-2xl rounded-tl-none p-3.5">
                      <p className="text-xs text-slate-400 mb-1">You · 9:14am</p>
                      <p className="text-slate-200 text-sm leading-relaxed">What caused the shipment delay on April 28? I need a full explanation with root cause and what steps are being taken to prevent recurrence.</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 flex-row-reverse">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">R</div>
                  <div className="flex-1">
                    <div className="bg-emerald-900/40 border border-emerald-800/40 rounded-2xl rounded-tr-none p-3.5">
                      <p className="text-xs text-emerald-400/70 mb-1">Rafiq Ahmed · 10:02am</p>
                      <p className="text-emerald-100 text-sm leading-relaxed">The courier missed the scheduled pickup window at 6pm. Root cause: our team sent the dispatch note 2 hours late. Delivery was rescheduled and confirmed on April 29. I have added a new SOP to ensure dispatch notes go out before 2pm. Won't happen again.</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">M</div>
                  <div className="flex-1">
                    <div className="bg-slate-700 rounded-2xl rounded-tl-none p-3.5">
                      <p className="text-xs text-slate-400 mb-1">You · 10:15am</p>
                      <p className="text-slate-200 text-sm leading-relaxed">Good. Share the updated SOP with the full team. Query closed.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <p className="text-xs text-emerald-400 font-semibold">Query closed · Response time: 48 minutes</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="py-24 px-4 bg-slate-50">
        <div ref={testimonialsRef.ref} className={`max-w-6xl mx-auto transition-all duration-700 ${testimonialsRef.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <span className="inline-block text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">What managers say</span>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-3">Managers who stopped chasing answers</h2>
            <div className="flex justify-center gap-0.5 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-7 shadow-sm hover:shadow-lg transition-shadow duration-300">
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section id="pricing" className="py-24 px-4 bg-white">
        <div ref={plansRef.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${plansRef.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-12">
            <span className="inline-block text-amber-600 text-xs font-bold uppercase tracking-widest mb-3">Simple pricing</span>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-3">Start free. Scale when ready.</h2>
            <p className="text-slate-500">No contracts. No hidden fees. Cancel any time.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {PLANS.map((plan, i) => (
              <div key={i}
                className={`rounded-2xl border-2 ${plan.color} overflow-hidden ${plan.highlight ? 'shadow-2xl scale-105' : 'shadow-sm'} transition-transform duration-200 hover:-translate-y-1`}>
                {plan.highlight && (
                  <div className="bg-amber-500 text-white text-xs font-bold text-center py-2 tracking-wider uppercase">
                    Most Popular
                  </div>
                )}
                <div className="p-6">
                  <h3 className={`text-xl font-extrabold mb-1 ${plan.textDark ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                  <div className="flex items-end gap-1 mb-1">
                    <span className={`text-sm font-medium ${plan.textDark ? 'text-slate-300' : 'text-slate-500'}`}>৳</span>
                    <span className={`text-4xl font-extrabold leading-none ${plan.textDark ? 'text-white' : 'text-slate-900'}`}>{plan.price.toLocaleString()}</span>
                    <span className={`text-sm mb-1 ${plan.textDark ? 'text-slate-300' : 'text-slate-500'}`}>/mo</span>
                  </div>
                  <p className={`text-sm mb-6 ${plan.textDark ? 'text-slate-400' : 'text-slate-500'}`}>{plan.queries}</p>
                  <button onClick={onShowPricing}
                    className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 ${plan.btn}`}>
                    Get {plan.name}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-400 text-sm mb-8">
            Or start with our <strong className="text-slate-700">free 15-day trial</strong> — full access, no credit card.
          </p>
          <div className="text-center">
            <button onClick={onShowPricing}
              className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors underline underline-offset-4">
              View full plan comparison &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 py-28 px-4 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500 rounded-full blur-[160px] opacity-10 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-white/80 text-xs font-semibold tracking-wider uppercase">No more unanswered queries</span>
          </div>
          <h2 className="text-5xl sm:text-6xl font-extrabold text-white mb-6 leading-tight">
            Ask your team.<br />
            <span className="text-amber-400">Get answers that stick.</span>
          </h2>
          <p className="text-slate-300 text-xl mb-10 leading-relaxed">
            Start your free 15-day trial today. Raise your first query in under a minute. Your team will have no excuse not to answer.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onStartTrial}
              className="group flex items-center justify-center gap-2 px-10 py-4 bg-amber-500 hover:bg-amber-400 text-white font-bold text-lg rounded-2xl transition-all duration-200 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:-translate-y-0.5">
              Start Free Trial — 15 Days
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={onShowPricing}
              className="flex items-center justify-center px-10 py-4 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-lg rounded-2xl transition-all duration-200">
              View Pricing Plans
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-6">No credit card · Cancel anytime · Setup in 2 minutes</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-slate-300 font-bold">QueryPing</span>
              </div>
              <p className="text-slate-600 text-xs max-w-xs leading-relaxed">
                A structured query management tool for managers who need real answers from their teams — not excuses.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-3">Contact</p>
                <div className="space-y-2">
                  <a href={`mailto:${BILLING_EMAIL}`} className="flex items-center gap-2 text-slate-400 text-xs hover:text-slate-300 transition-colors">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    {BILLING_EMAIL}
                  </a>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-2 text-slate-400 text-xs hover:text-slate-300 transition-colors">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    {SUPPORT_EMAIL}
                  </a>
                </div>
                <div className="mt-3 space-y-0.5">
                  <p className="text-slate-600 text-xs">Billing: {BILLING_EMAIL}</p>
                  <p className="text-slate-600 text-xs">Support: {SUPPORT_EMAIL}</p>
                </div>
              </div>

              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-3">Product</p>
                <div className="space-y-2">
                  <button onClick={onShowPricing} className="block text-slate-400 text-xs hover:text-slate-300 transition-colors">Pricing</button>
                  <button onClick={onStartTrial} className="block text-slate-400 text-xs hover:text-slate-300 transition-colors">Start Free Trial</button>
                  <button onClick={onStartTrial} className="block text-slate-400 text-xs hover:text-slate-300 transition-colors">Sign In</button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-600 text-xs">&copy; {new Date().getFullYear()} QueryPing. All rights reserved.</p>
            <p className="text-slate-700 text-xs">Never let a query go unanswered.</p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes bounceSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
