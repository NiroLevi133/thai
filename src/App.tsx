import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import {
  LayoutDashboard, Map, BedDouble, Bus, Ticket, Wallet, Settings as SettingsIcon,
  Cloud, CloudOff, Loader2, Check,
} from 'lucide-react';
import { useTrip } from './store';
import Dashboard from './pages/Dashboard';
import Itinerary from './pages/Itinerary';
import Hotels from './pages/Hotels';
import TransportPage from './pages/Transport';
import Places from './pages/Places';
import Budget from './pages/Budget';
import SettingsPage from './pages/Settings';
import { daysUntil } from './lib/dates';

const NAV = [
  { to: '/dashboard', label: 'דשבורד', icon: LayoutDashboard },
  { to: '/itinerary', label: 'מסלול', icon: Map },
  { to: '/hotels', label: 'מלונות', icon: BedDouble },
  { to: '/transport', label: 'תחבורה', icon: Bus },
  { to: '/places', label: 'מקומות', icon: Ticket },
  { to: '/budget', label: 'תקציב', icon: Wallet },
  { to: '/settings', label: 'הגדרות', icon: SettingsIcon },
];

function SaveIndicator() {
  const saveState = useTrip((s) => s.saveState);
  const map = {
    idle: null,
    dirty: { icon: Cloud, text: 'שינויים לא נשמרו', cls: 'text-neutral-500' },
    saving: { icon: Loader2, text: 'שומר…', cls: 'text-sky-500 animate-spin' },
    saved: { icon: Check, text: 'נשמר', cls: 'text-emerald-600' },
    error: { icon: CloudOff, text: 'שמירה נכשלה', cls: 'text-red-500' },
  } as const;
  const cur = map[saveState];
  if (!cur) return null;
  const Icon = cur.icon;
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs muted">
      <Icon size={14} className={cur.cls} aria-hidden />
      {cur.text}
    </span>
  );
}

export default function App() {
  const { trip, loading, loadError, load } = useTrip();

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3 text-neutral-500">
        <Loader2 className="animate-spin" /> טוען את הטיול…
      </div>
    );
  }

  if (loadError || !trip) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="card max-w-lg p-6">
          <h1 className="mb-2 text-lg font-bold text-red-600">לא הצלחתי לטעון את הנתונים</h1>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">{loadError}</p>
          <p className="text-sm">
            ודא שהשרת רץ (<code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">npm run dev</code>),
            ושהרצת את הייבוא: <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">npm run import</code>
          </p>
        </div>
      </div>
    );
  }

  const daysToTrip = daysUntil(trip.departureDate);

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">דלג לתוכן הראשי</a>
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>🇹🇭</span>
            <div>
              <h1 className="text-base font-bold leading-tight">{trip.name}</h1>
              <p className="text-xs muted">
                {daysToTrip !== null && daysToTrip > 0
                  ? `עוד ${daysToTrip} ימים לטיסה`
                  : daysToTrip === 0 ? 'היום יוצאים!' : 'הטיול בעיצומו'}
              </p>
            </div>
          </div>
          <div className="ms-auto"><SaveIndicator /></div>
        </div>

        <nav aria-label="ניווט ראשי" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-jungle-600 text-white'
                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`
              }
              aria-current={undefined}
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Icon size={16} aria-hidden />
                  <span aria-current={isActive ? 'page' : undefined}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl animate-fade-in px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/itinerary" element={<Itinerary />} />
          <Route path="/hotels" element={<Hotels />} />
          <Route path="/transport" element={<TransportPage />} />
          <Route path="/places" element={<Places />} />
          <Route path="/attractions" element={<Navigate to="/places" replace />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
