import { useEffect, useState } from 'react';
import { Settings, CheckCircle } from 'lucide-react';

const LANDING_PAGE_KEY = 'member_landing_page';

export type MemberLandingPage = 'dashboard' | 'queries';

export function getMemberLandingPage(): MemberLandingPage {
  const stored = localStorage.getItem(LANDING_PAGE_KEY);
  if (stored === 'dashboard' || stored === 'queries') return stored;
  return 'dashboard';
}

export default function MemberSettings() {
  const [landingPage, setLandingPage] = useState<MemberLandingPage>(getMemberLandingPage());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    localStorage.setItem(LANDING_PAGE_KEY, landingPage);
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [landingPage]);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
          <Settings className="w-5 h-5 text-slate-600" />
          <h2 className="font-semibold text-slate-900">Portal Preferences</h2>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Default page after login
            </label>
            <div className="space-y-2.5">
              <label className="flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50">
                <input
                  type="radio"
                  name="landing_page"
                  value="dashboard"
                  checked={landingPage === 'dashboard'}
                  onChange={() => setLandingPage('dashboard')}
                  className="mt-0.5 accent-slate-800"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">Dashboard</p>
                  <p className="text-xs text-slate-500 mt-0.5">See your query status summary and response rate first</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-colors hover:bg-slate-50 has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50">
                <input
                  type="radio"
                  name="landing_page"
                  value="queries"
                  checked={landingPage === 'queries'}
                  onChange={() => setLandingPage('queries')}
                  className="mt-0.5 accent-slate-800"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">My Queries</p>
                  <p className="text-xs text-slate-500 mt-0.5">Go directly to your pending queries list</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {saved && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 text-emerald-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Preferences saved</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
