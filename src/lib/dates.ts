import { differenceInCalendarDays, format, parseISO, addDays, isValid } from 'date-fns';

export const today = () => new Date(new Date().toDateString());

export function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? d : null;
}

export const iso = (d: Date) => format(d, 'yyyy-MM-dd');

/** 09.12.26 */
export function fmt(isoStr: string | null | undefined): string {
  const d = toDate(isoStr);
  return d ? format(d, 'dd.MM.yy') : '—';
}

/** 9 בדצמ׳ */
const HE_MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
export function fmtHe(isoStr: string | null | undefined): string {
  const d = toDate(isoStr);
  return d ? `${d.getDate()} ב${HE_MONTHS[d.getMonth()]}` : '—';
}

const HE_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
export const dayLetter = (d: Date) => HE_DAYS[d.getDay()];

/** מספר ימים מהיום עד התאריך. שלילי = עבר. */
export function daysUntil(isoStr: string | null | undefined): number | null {
  const d = toDate(isoStr);
  return d ? differenceInCalendarDays(d, today()) : null;
}

/** כל הלילות בטווח [start, end) — לילה מזוהה לפי תאריך הכניסה אליו */
export function nightsBetween(startIso: string | null, endIso: string | null): string[] {
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (!start || !end) return [];
  const out: string[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) out.push(iso(d));
  return out;
}

/** קיבוץ תאריכים רצופים לטווחים: ['1','2','4'] → [{from:'1',to:'2'},{from:'4',to:'4'}] */
export function groupConsecutive(dates: string[]): { from: string; to: string; count: number }[] {
  const sorted = [...dates].sort();
  const out: { from: string; to: string; count: number }[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && iso(addDays(parseISO(last.to), 1)) === cur) {
      last.to = cur;
      last.count++;
    } else {
      out.push({ from: cur, to: cur, count: 1 });
    }
  }
  return out;
}

/** טווח לילות פתוח מוצג כ"עד" יום העזיבה, כלומר יום אחרי הלילה האחרון */
export const checkoutOf = (lastNightIso: string) => iso(addDays(parseISO(lastNightIso), 1));

export { addDays };
