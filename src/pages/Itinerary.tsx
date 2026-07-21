import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, Bus, Ticket, MapPin, TriangleAlert, PlaneLanding, UtensilsCrossed } from 'lucide-react';
import { useTrip } from '../store';
import { gapsByDestination } from '../lib/gaps';
import { fmt, fmtHe, nightsBetween, toDate, dayLetter } from '../lib/dates';
import { ils } from '../lib/money';
import { SectionTitle } from '../components/ui';
import NightsStrip, { NightsLegend } from '../components/NightsStrip';

type View = 'destinations' | 'timeline';

export default function Itinerary() {
  const trip = useTrip((s) => s.trip)!;
  const [view, setView] = useState<View>('destinations');
  const gaps = useMemo(() => gapsByDestination(trip), [trip]);

  return (
    <div className="space-y-5">
      <SectionTitle
        action={
          <div className="flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
            {([['destinations', 'לפי יעד'], ['timeline', 'יום-יום']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  view === k ? 'bg-white shadow-sm dark:bg-neutral-950' : 'text-neutral-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        המסלול · {fmt(trip.startDate)} → {fmt(trip.endDate)}
      </SectionTitle>

      {view === 'destinations' ? <DestinationsView gaps={gaps} /> : <TimelineView />}
    </div>
  );
}

function DestinationsView({ gaps }: { gaps: ReturnType<typeof gapsByDestination> }) {
  const trip = useTrip((s) => s.trip)!;

  return (
    <div className="space-y-3">
      <NightsLegend />
      {gaps.map((g) => {
        const d = g.destination;
        const booked = trip.hotels.filter((h) => h.destinationId === d.id && h.status === 'booked');
        const candidates = trip.hotels.filter((h) => h.destinationId === d.id && h.status === 'candidate');
        const transfer = trip.transport.find((t) => t.fromDestinationId === d.id);
        const attractions = trip.attractions.filter((a) => a.destinationId === d.id);

        return (
          <div key={d.id} className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-neutral-100 p-4 dark:border-neutral-800"
                 style={{ borderInlineStartWidth: 5, borderInlineStartColor: d.color, borderInlineStartStyle: 'solid' }}>
              <div className="min-w-0 flex-1">
                <h3 className="ltr text-lg font-bold">{d.name}</h3>
                <p className="text-xs muted">
                  {fmtHe(d.startDate)} – {fmtHe(d.endDate)} · {d.nights} לילות
                  {d.whereToSleep && <> · <span className="ltr">{d.whereToSleep}</span></>}
                </p>
                {d.nightsConflict && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <TriangleAlert size={12} />
                    באקסל נרשמו {d.nightsConflict} לילות — טווח התאריכים נותן {d.nights}
                  </p>
                )}
              </div>
              <div className="text-end">
                <NightsStrip nights={g.nights} />
                <div className="mt-1 text-xs muted">
                  {g.coveredCount}/{g.nights.length} לילות
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
                  <BedDouble size={13} /> לינה
                </h4>
                {booked.map((h) => (
                  <div key={h.id} className="mb-1.5 flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm dark:bg-emerald-950/40">
                    <span className="ltr min-w-0 flex-1 truncate font-medium">{h.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                      {fmt(h.checkIn)}–{fmt(h.checkOut)}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">{ils(h.totalPrice)}</span>
                  </div>
                ))}
                {g.openRanges.map((r) => (
                  <Link
                    key={r.from}
                    to="/hotels"
                    className="mb-1.5 flex items-center gap-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-sm text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
                  >
                    <span className="flex flex-1 items-center gap-1.5 font-medium">
                      <TriangleAlert size={13} aria-hidden /> {r.count} לילות ללא מלון
                    </span>
                    <span className="text-xs tabular-nums">{fmt(r.from)}–{fmt(r.checkout)}</span>
                  </Link>
                ))}
                {candidates.length > 0 && (
                  <Link to="/hotels" className="mt-1 block text-xs text-jungle-600 hover:underline dark:text-jungle-400">
                    {candidates.length} מועמדים לבחירה ←
                  </Link>
                )}
              </div>

              <div className="space-y-3">
                {transfer && (
                  <div>
                    <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
                      <Bus size={13} /> מעבר ליעד הבא
                    </h4>
                    <p className="whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">
                      {transfer.description}
                    </p>
                  </div>
                )}
                {attractions.length > 0 && (
                  <div className="space-y-2">
                    {([
                      ['attraction', 'אטרקציות', Ticket],
                      ['restaurant', 'מסעדות', UtensilsCrossed],
                    ] as const).map(([kind, title, Icon]) => {
                      const list = attractions.filter((a) => a.kind === kind);
                      if (!list.length) return null;
                      return (
                        <div key={kind}>
                          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold muted">
                            <Icon size={13} aria-hidden /> {title} ({list.length})
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {list.map((a) => (
                              <span key={a.id} className="chip bg-sand-100 dark:bg-neutral-800">{a.name}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineView() {
  const trip = useTrip((s) => s.trip)!;
  // כולל את יום החזרה עצמו, ולכן endDate+1 מיוצג ע"י הוספת לילה וירטואלי אחרון
  const days = nightsBetween(trip.startDate, trip.endDate).concat(trip.endDate);

  const hotelFor = (day: string) =>
    trip.hotels.find((h) => h.status === 'booked' && h.checkIn && h.checkOut && day >= h.checkIn && day < h.checkOut);
  const destFor = (day: string) =>
    trip.destinations.find((d) => d.startDate && d.endDate && day >= d.startDate && day < d.endDate);

  return (
    <div className="card divide-y divide-neutral-100 dark:divide-neutral-800">
      {days.map((day) => {
        const d = toDate(day)!;
        const hotel = hotelFor(day);
        const dest = destFor(day);
        const transfers = trip.transport.filter((t) => t.date === day);
        const attractions = trip.attractions.filter((a) => a.plannedDate === day);
        const isLast = day === trip.endDate;
        const weekend = d.getDay() === 5 || d.getDay() === 6;

        return (
          <div key={day} className={`flex gap-3 p-3 ${weekend ? 'bg-sand-50/60 dark:bg-neutral-900/40' : ''}`}>
            <div className="w-14 shrink-0 text-center">
              <div className="text-xs muted">יום {dayLetter(d)}</div>
              <div className="text-base font-bold tabular-nums leading-tight">{d.getDate()}</div>
              <div className="text-xs muted">{fmtHe(day).split(' ').slice(1).join(' ')}</div>
            </div>

            <span className="w-1 shrink-0 rounded-full" style={{ background: dest?.color ?? '#e5e7eb' }} />

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {dest && <span className="ltr text-sm font-semibold">{dest.name}</span>}
                {isLast && (
                  <span className="chip bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                    <PlaneLanding size={12} aria-hidden /> טיסה הביתה
                  </span>
                )}
              </div>

              {!isLast && (
                hotel ? (
                  <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                    <BedDouble size={12} className="text-emerald-600" />
                    <span className="ltr truncate">{hotel.name}</span>
                    {hotel.checkIn === day && <span className="chip bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">צ׳ק-אין</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                    <BedDouble size={12} /> אין מלון ללילה הזה
                  </div>
                )
              )}

              {transfers.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-400">
                  <Bus size={12} />
                  <span className="truncate">{t.description.split('\n').join(' · ')}</span>
                </div>
              ))}

              {attractions.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-1.5 text-xs ${
                    a.kind === 'restaurant'
                      ? 'text-coral-700 dark:text-coral-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {a.kind === 'restaurant' ? <UtensilsCrossed size={12} aria-hidden /> : <Ticket size={12} aria-hidden />}
                  {a.name}
                </div>
              ))}

              {!hotel && !transfers.length && !attractions.length && !isLast && dest && (
                <div className="flex items-center gap-1.5 text-xs muted">
                  <MapPin size={12} /> יום פנוי
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
