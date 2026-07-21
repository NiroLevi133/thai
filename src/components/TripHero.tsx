import { MoonStar, CalendarDays, MapPin, PlaneTakeoff, Heart, Star, Sparkles } from 'lucide-react';
import type { Trip } from '../types';
import { daysUntil, toDate, fmtHe } from '../lib/dates';

/** מספר הימים הקלנדריים של הטיול, כולל יום היציאה ויום הנחיתה */
export function tripDurationDays(trip: Trip): number | null {
  const out = toDate(trip.departureDate);
  const back = toDate(trip.returnDate);
  if (!out || !back) return null;
  return Math.round((back.getTime() - out.getTime()) / 86400000) + 1;
}

const YEAR = (iso: string | null) => toDate(iso)?.getFullYear() ?? '';

function Metric({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/75 px-3 py-2 shadow-sm ring-1 ring-sand-200
                    dark:bg-white/10 dark:ring-white/15">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-jungle-600
                       dark:bg-white/10 dark:text-gold-300">
        {icon}
      </span>
      <div className="leading-tight">
        <div className="text-lg font-extrabold tabular-nums text-jungle-700 dark:text-sand-100">{value}</div>
        <div className="text-xs text-neutral-600 dark:text-neutral-300">{label}</div>
      </div>
    </div>
  );
}

/** לבבות וכוכבים מפוזרים — קישוט בלבד, מוסתר מקוראי מסך */
function Confetti() {
  const bits = [
    { C: Heart, cls: 'top-[12%] left-[7%] text-coral-400 h-5 w-5', delay: '0s' },
    { C: Star, cls: 'top-[30%] left-[18%] text-gold-400 h-3.5 w-3.5', delay: '0.6s' },
    { C: Heart, cls: 'top-[64%] left-[5%] text-coral-200 h-4 w-4', delay: '1.2s' },
    { C: Sparkles, cls: 'bottom-[12%] left-[16%] text-gold-300 h-4 w-4', delay: '0.3s' },
    { C: Star, cls: 'top-[10%] right-[36%] text-gold-300 h-3 w-3', delay: '0.9s' },
    { C: Heart, cls: 'bottom-[16%] right-[32%] text-coral-200 h-4 w-4', delay: '1.6s' },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map(({ C, cls, delay }, i) => (
        <C key={i} fill="currentColor" className={`absolute animate-twinkle ${cls}`} style={{ animationDelay: delay }} />
      ))}
    </div>
  );
}

export default function TripHero({ trip }: { trip: Trip }) {
  const days = daysUntil(trip.departureDate);
  const duration = tripDurationDays(trip);
  const nights = trip.destinations.reduce((n, d) => n + (d.nights ?? 0), 0);

  const isCountdown = days !== null && days > 0;
  const headline = days === null ? '—' : days > 0 ? days : days === 0 ? 'היום!' : 'בטיול';

  return (
    <div
      className="relative overflow-hidden rounded-4xl border border-sand-200 bg-gradient-to-bl
                 from-sand-50 via-sand-100 to-sand-200 shadow-sm
                 dark:border-neutral-800 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-950"
    >
      <Confetti />

      <div className="relative flex flex-col-reverse items-center gap-4 p-5 sm:flex-row sm:items-end sm:gap-6">
        <div className="min-w-0 flex-1 text-center sm:text-start">
          <p className="text-xs font-bold uppercase tracking-wide text-coral-700 dark:text-coral-400">
            {isCountdown ? 'הרפתקה מתקרבת' : 'הטיול'}
          </p>

          <div className="flex items-baseline justify-center gap-2 sm:justify-start">
            <span className="animate-pop-in bg-gradient-to-bl from-jungle-600 to-jungle-500 bg-clip-text text-6xl
                             font-black tabular-nums leading-none text-transparent
                             dark:from-gold-300 dark:to-gold-500">
              {headline}
            </span>
            {typeof headline === 'number' && (
              <span className="text-xl font-bold text-jungle-600 dark:text-gold-300">ימים</span>
            )}
          </div>

          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 text-sm font-medium
                        text-neutral-700 dark:text-neutral-300 sm:justify-start">
            <PlaneTakeoff size={15} className="text-coral-600 dark:text-coral-400" aria-hidden />
            ממריאים ב־{fmtHe(trip.departureDate)} {YEAR(trip.departureDate)}
            <span className="text-neutral-500" aria-hidden>·</span>
            נוחתים חזרה ב־{fmtHe(trip.returnDate)} {YEAR(trip.returnDate)}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Metric icon={<CalendarDays size={16} />} value={duration ?? '—'} label="ימים סה״כ" />
            <Metric icon={<MoonStar size={16} />} value={nights} label="לילות" />
            <Metric icon={<MapPin size={16} />} value={trip.destinations.length} label="יעדים" />
          </div>
        </div>

        {/* מסגרת "פולרויד" — הופכת את הפרש הגוון בין רקע האיור לרקע ההירו לבחירה מכוונת */}
        <div className="shrink-0 animate-float">
          <div className="-rotate-2 rounded-2xl bg-white p-2 pb-3 shadow-md ring-1 ring-sand-200
                          transition-transform duration-300 hover:rotate-0 hover:scale-[1.03]
                          dark:bg-neutral-800 dark:ring-neutral-700">
            {/* §3 image-dimension — מידות מוצהרות מונעות קפיצת פריסה בטעינה */}
            <img
              src="/couple.jpg"
              width={570}
              height={760}
              alt="איור של ניר ואשתו מחובקים, מוכנים לצאת לטיול"
              className="h-36 w-auto rounded-xl object-contain sm:h-44 lg:h-52"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
