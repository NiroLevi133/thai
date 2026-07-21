import type { Trip } from '../types';
import { toIls } from './money';
import { tripNightTotals } from './gaps';
import { nightsBetween } from './dates';

export interface BudgetLine {
  key: string;
  label: string;
  /** מה שכבר שולם בפועל */
  paid: number;
  /** מה שמחויב אך טרם שולם (הזמנות סגורות) */
  committed: number;
  /** אומדן לחלקים שעדיין לא נסגרו */
  estimated: number;
  color: string;
}

export interface BudgetSummary {
  lines: BudgetLine[];
  paid: number;
  committed: number;
  estimated: number;
  total: number;
  target: number | null;
  remaining: number | null;
}

export const CATEGORY_LABELS: Record<string, string> = {
  food: 'אוכל',
  shopping: 'שופינג',
  insurance: 'ביטוח',
  visa: 'ויזה',
  gear: 'ציוד',
  other: 'אחר',
};

/**
 * אומדן ללילה פתוח — ממוצע המחיר ללילה של ההזמנות שכבר נסגרו.
 * נותן תחזית תקציב מציאותית במקום להתעלם מ-12 הלילות הפתוחים.
 */
export function avgNightlyRate(trip: Trip): number {
  const booked = trip.hotels.filter((h) => h.status === 'booked' && h.totalPrice && h.nights);
  if (!booked.length) return 0;
  const totalCost = booked.reduce((s, h) => s + toIls(h.totalPrice, h.currency, trip.settings), 0);
  const totalNights = booked.reduce((s, h) => s + (h.nights ?? 0), 0);
  return totalNights ? totalCost / totalNights : 0;
}

export function budgetSummary(trip: Trip): BudgetSummary {
  const s = trip.settings;
  const lines: BudgetLine[] = [];

  // מלונות
  let hotelPaid = 0;
  let hotelCommitted = 0;
  for (const h of trip.hotels) {
    if (h.status !== 'booked') continue;
    const amount = toIls(h.totalPrice, h.currency, s);
    if (h.paid) hotelPaid += h.paidAmount ?? amount;
    else hotelCommitted += amount;
  }
  const { openNights } = tripNightTotals(trip);
  lines.push({
    key: 'hotels',
    label: 'מלונות',
    paid: hotelPaid,
    committed: hotelCommitted,
    estimated: openNights * avgNightlyRate(trip),
    color: '#4f6128',
  });

  // תחבורה
  const transportPaid = trip.transport
    .filter((t) => t.status === 'booked')
    .reduce((sum, t) => sum + toIls(t.price, t.currency, s), 0);
  const transportIdea = trip.transport
    .filter((t) => t.status === 'idea')
    .reduce((sum, t) => sum + toIls(t.price, t.currency, s), 0);
  lines.push({
    key: 'transport',
    label: 'תחבורה וטיסות',
    paid: 0,
    committed: transportPaid,
    estimated: transportIdea,
    color: '#0ea5e9',
  });

  // אטרקציות ומסעדות — שני קווים נפרדים
  for (const [kind, label, color] of [
    ['attraction', 'אטרקציות', '#f59e0b'],
    ['restaurant', 'מסעדות', '#c85f5f'],
  ] as const) {
    let committed = 0;
    let idea = 0;
    for (const a of trip.attractions.filter((x) => x.kind === kind)) {
      const amount = toIls(a.price, a.currency, s) * (a.price ? s.travelers : 0);
      if (a.status === 'booked' || a.status === 'done') committed += amount;
      else idea += amount;
    }
    lines.push({ key: kind, label, paid: 0, committed, estimated: idea, color });
  }

  // אוכל — אומדן לפי תקציב יומי לאדם × מטיילים × ימי הטיול
  const tripDays = nightsBetween(trip.startDate, trip.endDate).length;
  lines.push({
    key: 'food',
    label: 'אוכל (אומדן יומי)',
    paid: 0,
    committed: 0,
    estimated: (s.dailyFoodBudget ?? 0) * s.travelers * tripDays,
    color: '#ec4899',
  });

  // הוצאות אחרות
  const expPaid = trip.expenses.filter((e) => e.paid).reduce((sum, e) => sum + toIls(e.amount, e.currency, s), 0);
  const expOpen = trip.expenses.filter((e) => !e.paid).reduce((sum, e) => sum + toIls(e.amount, e.currency, s), 0);
  lines.push({
    key: 'other',
    label: 'הוצאות אחרות',
    paid: expPaid,
    committed: 0,
    estimated: expOpen,
    color: '#8b5cf6',
  });

  const paid = lines.reduce((x, l) => x + l.paid, 0);
  const committed = lines.reduce((x, l) => x + l.committed, 0);
  const estimated = lines.reduce((x, l) => x + l.estimated, 0);
  const total = paid + committed + estimated;

  return {
    lines,
    paid,
    committed,
    estimated,
    total,
    target: s.budgetTarget,
    remaining: s.budgetTarget !== null ? s.budgetTarget - total : null,
  };
}

/** פילוח עלות לפי יעד — מלונות + אטרקציות + תחבורה שיוצאת מהיעד */
export function costByDestination(trip: Trip) {
  const s = trip.settings;
  return [...trip.destinations]
    .sort((a, b) => a.order - b.order)
    .map((d) => {
      const hotels = trip.hotels
        .filter((h) => h.destinationId === d.id && h.status === 'booked')
        .reduce((sum, h) => sum + toIls(h.totalPrice, h.currency, s), 0);
      const attractions = trip.attractions
        .filter((a) => a.destinationId === d.id && a.price)
        .reduce((sum, a) => sum + toIls(a.price, a.currency, s) * s.travelers, 0);
      const transport = trip.transport
        .filter((t) => t.fromDestinationId === d.id)
        .reduce((sum, t) => sum + toIls(t.price, t.currency, s), 0);
      return { name: d.name, מלונות: hotels, אטרקציות: attractions, תחבורה: transport };
    });
}
