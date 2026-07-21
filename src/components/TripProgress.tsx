import { Link } from 'react-router-dom';
import { BedDouble, Bus, Ticket, Wallet, Check, ArrowLeft, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Trip } from '../types';
import { tripNightTotals } from '../lib/gaps';

interface Quest {
  key: string;
  label: string;
  hint: string;
  done: number;
  total: number;
  icon: LucideIcon;
  link: string;
  /** צבע ההתקדמות — מלווה תמיד בטקסט ובאייקון, לא נושא מידע לבדו */
  bar: string;
}

export function buildQuests(trip: Trip): Quest[] {
  const nights = tripNightTotals(trip);
  const transportDone = trip.transport.filter((t) => t.status === 'booked').length;
  const attractionsPlanned = trip.attractions.filter((a) => a.plannedDate).length;
  const booked = trip.hotels.filter((h) => h.status === 'booked');
  const paid = booked.filter((h) => h.paid).length;

  return [
    {
      key: 'nights',
      label: 'לילות עם מלון',
      hint: nights.openNights > 0 ? `נשארו ${nights.openNights} לילות לסגור` : 'כל הלילות סגורים!',
      done: nights.coveredNights,
      total: nights.plannedNights,
      icon: BedDouble,
      link: '/hotels',
      bar: 'bg-jungle-500',
    },
    {
      key: 'paid',
      label: 'הזמנות ששולמו',
      hint: paid === booked.length ? 'הכל שולם' : `${booked.length - paid} עוד לא סומנו כשולמו`,
      done: paid,
      total: booked.length,
      icon: Wallet,
      link: '/hotels',
      bar: 'bg-coral-600',
    },
    {
      key: 'transport',
      label: 'מעברים שהוזמנו',
      hint: transportDone === trip.transport.length ? 'כל התחבורה סגורה' : 'טיסות ומעבורות שעוד לא הוזמנו',
      done: transportDone,
      total: trip.transport.length,
      icon: Bus,
      link: '/transport',
      bar: 'bg-sky-600',
    },
    {
      key: 'attractions',
      label: 'מקומות משובצים',
      hint: attractionsPlanned ? 'אטרקציות ומסעדות ששובצו ליום' : 'שבץ אטרקציות ומסעדות לימים',
      done: attractionsPlanned,
      total: trip.attractions.length,
      icon: Ticket,
      link: '/places',
      bar: 'bg-gold-600',
    },
  ];
}

function QuestRow({ q }: { q: Quest }) {
  const pct = q.total ? Math.round((q.done / q.total) * 100) : 0;
  const complete = q.total > 0 && q.done === q.total;
  const Icon = q.icon;

  return (
    <Link
      to={q.link}
      className="group flex items-center gap-3 rounded-2xl p-2.5 transition-colors
                 hover:bg-sand-50 dark:hover:bg-neutral-800/60"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-transform
                    group-hover:scale-105 ${
                      complete
                        ? 'bg-jungle-600 text-white'
                        : 'bg-sand-100 text-jungle-700 dark:bg-neutral-800 dark:text-sand-200'
                    }`}
      >
        {complete ? <Check size={18} /> : <Icon size={18} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold">{q.label}</span>
          <span className="shrink-0 text-xs font-bold tabular-nums text-neutral-700 dark:text-neutral-300">
            {q.done}/{q.total}
          </span>
        </div>

        <div
          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-sand-200 dark:bg-neutral-800"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${q.label}: ${q.done} מתוך ${q.total}`}
        >
          <div className={`h-full rounded-full transition-[width] duration-500 ${q.bar}`} style={{ width: `${pct}%` }} />
        </div>

        <p className="mt-1 text-xs muted">{q.hint}</p>
      </div>

      <ArrowLeft size={15} className="shrink-0 text-neutral-500 transition-transform group-hover:-translate-x-0.5" aria-hidden />
    </Link>
  );
}

export default function TripProgress({ trip }: { trip: Trip }) {
  const quests = buildQuests(trip);
  const done = quests.reduce((s, q) => s + q.done, 0);
  const total = quests.reduce((s, q) => s + q.total, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  const mood =
    pct >= 100 ? 'הכל מוכן — אפשר לארוז!'
    : pct >= 75 ? 'כמעט שם, נשארו כמה פרטים'
    : pct >= 40 ? 'מתקדמים יפה'
    : 'יש עוד מה לסגור — בוא נתחיל';

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-sand-200 bg-sand-50 p-4
                      dark:border-neutral-800 dark:bg-neutral-900">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-jungle-700">
          <Trophy size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold">כמה הטיול מוכן?</h2>
          <p className="text-xs muted">{mood}</p>
        </div>
        <div className="shrink-0 text-end">
          <div className="text-2xl font-black tabular-nums text-jungle-700 dark:text-gold-300">{pct}%</div>
          <div className="text-xs muted">{done}/{total} משימות</div>
        </div>
      </div>

      <div className="divide-y divide-sand-100 p-1.5 dark:divide-neutral-800">
        {quests.map((q) => <QuestRow key={q.key} q={q} />)}
      </div>
    </section>
  );
}
