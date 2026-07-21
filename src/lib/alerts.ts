import type { Trip } from '../types';
import { daysUntil, fmt } from './dates';
import { gapsByDestination } from './gaps';
import { ils } from './money';

export type Severity = 'critical' | 'warning' | 'info' | 'past';

export interface Alert {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  /** ימים עד האירוע — לצורך מיון וספירה לאחור */
  days: number | null;
  link: string;
  kind: 'cancel' | 'payment' | 'gap' | 'conflict' | 'transport';
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2, past: 3 };

/** דדליין ביטול: אדום ≤7 ימים, כתום ≤21, אפור אם עבר */
function cancelSeverity(days: number): Severity {
  if (days < 0) return 'past';
  if (days <= 7) return 'critical';
  if (days <= 21) return 'warning';
  return 'info';
}

export function buildAlerts(trip: Trip): Alert[] {
  const alerts: Alert[] = [];
  const destName = (id: string) => trip.destinations.find((d) => d.id === id)?.name ?? id;

  for (const h of trip.hotels) {
    if (h.status !== 'booked') continue;

    // (א) דדליין ביטול חינם
    if (h.freeCancelUntil) {
      const days = daysUntil(h.freeCancelUntil);
      if (days !== null) {
        const sev = cancelSeverity(days);
        alerts.push({
          id: `cancel-${h.id}`,
          severity: sev,
          kind: 'cancel',
          title:
            days < 0
              ? `חלון הביטול נסגר — ${h.name}`
              : days === 0
                ? `היום האחרון לביטול חינם — ${h.name}`
                : `${days} ימים לביטול חינם — ${h.name}`,
          detail: `${destName(h.destinationId)} · עד ${fmt(h.freeCancelUntil)} · ${ils(h.totalPrice)} · ${h.bookedVia ?? ''} ${h.confirmationNumber ?? ''}`.trim(),
          days,
          link: '/hotels',
        });
      }
    }

    // (ב) הזמנה סגורה שעדיין לא סומנה כשולמה
    if (!h.paid) {
      alerts.push({
        id: `pay-${h.id}`,
        severity: 'info',
        kind: 'payment',
        title: `לא סומן כשולם — ${h.name}`,
        detail: `${destName(h.destinationId)} · ${ils(h.totalPrice)} · ${h.bookedVia ?? ''}`.trim(),
        days: daysUntil(h.checkIn),
        link: '/hotels',
      });
    }

    // (ד) סתירה בין שני מקורות התאריך באקסל
    if (h.freeCancelConflict) {
      alerts.push({
        id: `conflict-${h.id}`,
        severity: 'warning',
        kind: 'conflict',
        title: `סתירה בתאריך הביטול — ${h.name}`,
        detail: `גיליון ההזמנות: ${fmt(h.freeCancelUntil)} · ההערה במסלול: ${fmt(h.freeCancelConflict)}. בדוק באתר ההזמנה ועדכן.`,
        days: daysUntil(h.freeCancelConflict),
        link: '/hotels',
      });
    }
  }

  // (ג) לילות ללא מלון
  for (const g of gapsByDestination(trip)) {
    for (const r of g.openRanges) {
      alerts.push({
        id: `gap-${g.destination.id}-${r.from}`,
        severity: 'warning',
        kind: 'gap',
        title: `${r.count} לילות ללא מלון — ${g.destination.name}`,
        detail: `${fmt(r.from)} → ${fmt(r.checkout)}`,
        days: daysUntil(r.from),
        link: '/hotels',
      });
    }
    // סתירה בין עמודת הלילות באקסל לטווח התאריכים
    if (g.destination.nightsConflict) {
      alerts.push({
        id: `nights-conflict-${g.destination.id}`,
        severity: 'info',
        kind: 'conflict',
        title: `אי-התאמה בלילות — ${g.destination.name}`,
        detail: `באקסל נרשמו ${g.destination.nightsConflict} לילות, אך טווח התאריכים נותן ${g.destination.nights}. השתמשנו בתאריכים.`,
        days: null,
        link: '/itinerary',
      });
    }
  }

  // (ו) טיסת החזרה לא מסתדרת עם הצ׳ק-אאוט האחרון
  const lastCheckout = trip.hotels
    .filter((h) => h.status === 'booked' && h.checkOut)
    .map((h) => h.checkOut!)
    .sort()
    .at(-1);
  if (lastCheckout && trip.returnDate && lastCheckout !== trip.returnDate) {
    const lastHotel = trip.hotels.find((h) => h.status === 'booked' && h.checkOut === lastCheckout);
    const extra = daysUntil(lastCheckout)! - daysUntil(trip.returnDate)!;
    alerts.push({
      id: 'return-date-mismatch',
      severity: 'warning',
      kind: 'conflict',
      title: 'טיסת החזרה לא תואמת לצ׳ק-אאוט האחרון',
      detail:
        `הטיסה חזרה ב-${fmt(trip.returnDate)}, אבל הצ׳ק-אאוט מ-${lastHotel?.name ?? 'המלון האחרון'} ב-${fmt(lastCheckout)}` +
        (extra > 0 ? ` — ${extra} לילות מעבר לטיסה. בדוק אם ההזמנה ארוכה מדי או שהטיסה יוצאת אחרי חצות.` : '.'),
      days: daysUntil(trip.returnDate),
      link: '/hotels',
    });
  }

  // (ה) מעבר בין יעדים ללא פרטים
  for (const t of trip.transport) {
    if (t.status === 'idea' && t.price === null) {
      alerts.push({
        id: `transport-${t.id}`,
        severity: 'info',
        kind: 'transport',
        title: `תחבורה לא סגורה — ${t.description.split('\n')[0].slice(0, 50)}`,
        detail: t.fromDestinationId
          ? `${destName(t.fromDestinationId)} → ${t.toDestinationId ? destName(t.toDestinationId) : 'ישראל'}`
          : 'טיסה בינלאומית',
        days: daysUntil(t.date),
        link: '/transport',
      });
    }
  }

  return alerts.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return (a.days ?? 9999) - (b.days ?? 9999);
  });
}

export const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'border-red-500/60 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200',
  warning: 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200',
  info: 'border-sky-500/50 bg-sky-50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-200',
  past: 'border-neutral-300 bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400',
};
