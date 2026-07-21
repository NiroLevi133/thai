import { Link } from 'react-router-dom';
import {
  AlertTriangle, BedDouble, CalendarClock, Wallet, MoonStar, ArrowLeft, TriangleAlert,
} from 'lucide-react';
import { useTrip } from '../store';
import { buildAlerts, SEVERITY_STYLES, type Alert } from '../lib/alerts';
import { tripNightTotals, gapsByDestination } from '../lib/gaps';
import { budgetSummary } from '../lib/budget';
import { ils } from '../lib/money';
import { fmt, fmtHe } from '../lib/dates';
import { StatCard, SectionTitle } from '../components/ui';
import TripHero from '../components/TripHero';
import NightsStrip, { NightsLegend } from '../components/NightsStrip';
import TripProgress from '../components/TripProgress';

function AlertRow({ alert }: { alert: Alert }) {
  return (
    <Link
      to={alert.link}
      className={`flex items-start gap-3 rounded-xl border p-3 transition hover:brightness-[0.98] ${SEVERITY_STYLES[alert.severity]}`}
    >
      {alert.days !== null && alert.severity !== 'past' && (
        <div className="min-w-[3.25rem] shrink-0 text-center">
          <div className="text-xl font-bold tabular-nums leading-none">{alert.days}</div>
          <div className="text-xs opacity-80">ימים</div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{alert.title}</div>
        <div className="mt-0.5 truncate text-xs opacity-80">{alert.detail}</div>
      </div>
      <ArrowLeft size={16} className="mt-1 shrink-0 opacity-40" />
    </Link>
  );
}

export default function Dashboard() {
  const trip = useTrip((s) => s.trip)!;
  const alerts = buildAlerts(trip);
  const nights = tripNightTotals(trip);
  const budget = budgetSummary(trip);
  const gaps = gapsByDestination(trip);

  const urgent = alerts.filter((a) => a.severity === 'critical' || a.severity === 'warning');
  const nextCancel = alerts
    .filter((a) => a.kind === 'cancel' && a.days !== null && a.days >= 0)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0];

  const bookedHotels = trip.hotels.filter((h) => h.status === 'booked');
  const unpaid = bookedHotels.filter((h) => !h.paid);

  return (
    <div className="space-y-6">
      <TripHero trip={trip} />

      <TripProgress trip={trip} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<MoonStar size={14} />}
          label="לילות מכוסים"
          value={`${nights.coveredNights} / ${nights.plannedNights}`}
          sub={nights.openNights > 0 ? `${nights.openNights} לילות עדיין ללא מלון` : 'כל הלילות סגורים'}
          tone={nights.openNights > 0 ? 'warn' : 'good'}
        />
        <StatCard
          icon={<CalendarClock size={14} />}
          label="הביטול החינם הקרוב"
          value={nextCancel ? `${nextCancel.days} ימים` : '—'}
          sub={nextCancel ? nextCancel.title.replace(/^.*— /, '') : 'אין דדליינים פתוחים'}
          tone={nextCancel && nextCancel.days !== null && nextCancel.days <= 7 ? 'bad' : 'warn'}
        />
        <StatCard
          icon={<BedDouble size={14} />}
          label="הזמנות סגורות"
          value={bookedHotels.length}
          sub={unpaid.length ? `${unpaid.length} עדיין לא סומנו כשולמו` : 'הכל סומן כשולם'}
        />
        <StatCard
          icon={<Wallet size={14} />}
          label="תחזית תקציב"
          value={ils(budget.total)}
          sub={
            budget.remaining !== null
              ? `${budget.remaining >= 0 ? 'נותרו' : 'חריגה של'} ${ils(Math.abs(budget.remaining))}`
              : `${ils(budget.paid + budget.committed)} כבר מחויב`
          }
          tone={budget.remaining !== null && budget.remaining < 0 ? 'bad' : 'neutral'}
        />
      </div>

      <section>
        <SectionTitle
          action={<Link to="/hotels" className="text-xs font-medium text-jungle-600 hover:underline dark:text-jungle-400">לכל המלונות ←</Link>}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            דורש טיפול
            {urgent.length > 0 && (
              <span className="chip bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">{urgent.length}</span>
            )}
          </span>
        </SectionTitle>

        {alerts.length === 0 ? (
          <div className="card p-6 text-center text-sm text-neutral-500">אין התראות פתוחות</div>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 7).map((a) => <AlertRow key={a.id} alert={a} />)}
          </div>
        )}
        {alerts.length > 7 && (
          <p className="mt-2 text-center text-xs text-neutral-500">
            ועוד {alerts.length - 7} התראות במסכים הרלוונטיים
          </p>
        )}
      </section>

      <section>
        <SectionTitle
          action={<Link to="/itinerary" className="text-xs font-medium text-jungle-600 hover:underline dark:text-jungle-400">למסלול המלא ←</Link>}
        >
          סקירת יעדים
        </SectionTitle>
        <div className="mb-2"><NightsLegend /></div>
        <div className="card divide-y divide-neutral-100 dark:divide-neutral-800">
          {gaps.map((g) => {
            const d = g.destination;
            const done = g.openNights.length === 0;
            return (
              <div key={d.id} className="flex items-center gap-3 p-3">
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: d.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="ltr truncate font-semibold">{d.name}</span>
                    {d.nightsConflict && (
                      <TriangleAlert size={13} className="shrink-0 text-amber-500" aria-label="אי-התאמה בלילות" />
                    )}
                  </div>
                  <div className="text-xs muted">
                    {fmtHe(d.startDate)} – {fmtHe(d.endDate)} · {d.nights} לילות
                  </div>
                </div>

                <div className="shrink-0">
                  <NightsStrip nights={g.nights} size="sm" />
                </div>

                <span
                  className={`chip shrink-0 ${
                    done
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                  }`}
                >
                  {done ? 'סגור' : `${g.openNights.length} פתוחים`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-center text-xs muted">
        המסלול בתאילנד: {fmt(trip.startDate)} → {fmt(trip.endDate)}
      </p>
    </div>
  );
}
