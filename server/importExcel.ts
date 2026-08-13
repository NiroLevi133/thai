/**
 * ייבוא מקובץ האקסל אל אובייקט Trip.
 * מקור: גיליון יחיד "מלונות שהוזמנו" עם כל המידע על כל מלון — אין יותר גיליון מסלול
 * נפרד ואין יותר זיהוי לפי צבעי תא. עמודות (A→N):
 *   יעד, שם מלון, סוג חדר, צ׳ק-אין, צ׳ק-אאוט, מספר לילות, מחיר ללילה, מחיר כולל,
 *   דרך מי הוזמן, מספר הזמנה, ביטול חינם עד, סטטוס ההזמנה, הערות, קישור (היפרלינק)
 *
 * היעדים (המסלול) נגזרים מתוך עמודת "יעד" + טווח התאריכים של המלונות שמשויכים אליה —
 * אין יותר גיליון מסלול נפרד עם סדר/צבע/לילות/מעברי תחבורה.
 */
// ייבוא מהקובץ הישיר של ה-ESM build (לא 'xlsx' עצמו) — ראה server/xlsx-mjs.d.ts להסבר
import * as XLSX from 'xlsx/xlsx.mjs';
import type { Trip, Destination, Hotel, Transport, HotelStatus } from '../src/types';

const SHEET_HOTELS = 'מלונות שהוזמנו';

// ---------- תאריכים (מבנה עצמאי מ-timezone, מקביל ל-date של פייתון) ----------

interface SimpleDate { y: number; m: number; d: number }

function mkDate(y: number, m: number, d: number): SimpleDate | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d };
}
function toJs(sd: SimpleDate): Date {
  return new Date(Date.UTC(sd.y, sd.m - 1, sd.d));
}
function addDays(sd: SimpleDate, n: number): SimpleDate {
  const dt = toJs(sd);
  dt.setUTCDate(dt.getUTCDate() + n);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
function diffDays(a: SimpleDate, b: SimpleDate): number {
  return Math.round((toJs(a).getTime() - toJs(b).getTime()) / 86400000);
}
function isoDate(sd: SimpleDate | null): string | null {
  if (!sd) return null;
  return `${String(sd.y).padStart(4, '0')}-${String(sd.m).padStart(2, '0')}-${String(sd.d).padStart(2, '0')}`;
}
/** 'YYYY-MM-DD' → תאריך */
function parseIsoDate(s: string): SimpleDate {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return { y, m, d };
}

// ---------- עזרי פרסינג ----------

/** תא תאריך אקסל (Date אמיתי) או טקסט '09.12.2026' / '09/12/26' */
function parseFullDate(v: unknown): SimpleDate | null {
  if (v == null) return null;
  if (v instanceof Date) return { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, d: v.getUTCDate() };
  const m = String(v).match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  return mkDate(y, mo, dd);
}

/** '2,845 ₪' / '819₪' / '1812 בלי החזר' → [מספר, הערה] */
function parseMoney(v: unknown): [number | null, string | null] {
  if (v == null) return [null, null];
  if (typeof v === 'number') return [v, null];
  const s = String(v).trim();
  const m = s.match(/[\d,]+(?:\.\d+)?/);
  if (!m || m.index == null) return [null, s || null];
  const num = parseFloat(m[0].replace(/,/g, ''));
  let leftover = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/₪/g, '').trim();
  leftover = leftover.replace(/\s+/g, ' ');
  return [num, leftover || null];
}

function slug(s: string): string {
  const ascii = String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (ascii) return ascii;
  // אין תווים לטיניים בטקסט (למשל יעד שכתוב כבר בעברית) — משתמשים בטקסט המקורי כמזהה
  return String(s).trim().toLowerCase().replace(/\s+/g, '-');
}

// שמות היעדים באקסל עשויים להיות עדיין באנגלית — מתורגמים לעברית לתצוגה.
// יעד שכבר בעברית (או לא ברשימה) נשאר כפי שהוא.
const HEBREW_DEST_NAMES: Record<string, string> = {
  'koh samui': 'קו סמוי',
  'ko tao': 'קו טאו',
  'koh phangan': 'קו פנגן',
  'krabi': 'קרבי',
  'ko lanta': 'קו לנטה',
  'ko phi phi': 'קו פיפי',
  'phuket': 'פוקט',
  'khao lak': 'קאו לאק',
  'pattaya': 'פאטאיה',
  'bangkok': 'בנגקוק',
};
function hebrewName(label: string): string {
  return HEBREW_DEST_NAMES[label.trim().toLowerCase()] ?? label.trim();
}

/** מסווג את עמודת "סטטוס ההזמנה" החופשית לאחד משלושת הסטטוסים באפליקציה */
function classifyStatus(raw: unknown): { status: HotelStatus; paid: boolean; unrecognized: string | null } {
  if (!raw) return { status: 'candidate', paid: false, unrecognized: null };
  const s = String(raw).trim();
  const norm = s.toLowerCase();
  const has = (words: string[]) => words.some((w) => norm.includes(w));

  if (has(['בוטל', 'מבוטל', 'נפסל', 'ירד', 'לא רלוונטי', 'נדחה', 'דחוי'])) {
    return { status: 'rejected', paid: false, unrecognized: null };
  }
  if (has(['שולם', 'סגור', 'נסגר', 'הוזמן', 'מאושר', 'בוצע', 'אושר', 'confirmed', 'paid', 'booked'])) {
    return { status: 'booked', paid: has(['שולם', 'paid']), unrecognized: null };
  }
  if (has(['מועמד', 'אולי', 'לבדוק', 'בבדיקה', 'פתוח', 'אפשרות', 'בהמתנה', 'candidate'])) {
    return { status: 'candidate', paid: false, unrecognized: null };
  }
  // מחרוזת שלא זוהתה — ברירת מחדל בטוחה: מועמד, עם המחרוזת המקורית שמורה בהערות
  return { status: 'candidate', paid: false, unrecognized: s };
}

// ---------- עזרי גישה לתאים ----------

function cellAt(ws: XLSX.WorkSheet, r1: number, c1: number): XLSX.CellObject | undefined {
  return ws[XLSX.utils.encode_cell({ r: r1 - 1, c: c1 - 1 })];
}
function cellValue(ws: XLSX.WorkSheet, r1: number, c1: number): unknown {
  return cellAt(ws, r1, c1)?.v;
}
function maxRow(ws: XLSX.WorkSheet): number {
  const ref = ws['!ref'];
  if (!ref) return 0;
  return XLSX.utils.decode_range(ref).e.r + 1;
}

// ---------- קריאת גיליון המלונות ----------

interface HotelRow {
  destination: string; name: string; roomType: string | null;
  checkIn: string | null; checkOut: string | null; nights: number | null;
  pricePerNight: number | null; totalPrice: number | null;
  bookedVia: string | null; confirmationNumber: string | null;
  freeCancelUntil: string | null; status: HotelStatus; paid: boolean;
  notes: string | null; url: string | null;
}

function readHotels(ws: XLSX.WorkSheet): HotelRow[] {
  const rows: HotelRow[] = [];
  for (let r = 1; r <= maxRow(ws); r++) {
    const destRaw = cellValue(ws, r, 1);
    const nameRaw = cellValue(ws, r, 2);
    if (!destRaw || !nameRaw) continue;
    const name = String(nameRaw).trim();
    if (name === 'שם מלון' || name === 'שם המלון') continue; // שורת כותרת

    const [pricePerNight, priceNote] = parseMoney(cellValue(ws, r, 7));
    const [totalPrice, totalNote] = parseMoney(cellValue(ws, r, 8));
    const nightsRaw = cellValue(ws, r, 6);
    const roomTypeRaw = cellValue(ws, r, 3);
    const bookedViaRaw = cellValue(ws, r, 9);
    const confRaw = cellValue(ws, r, 10);
    const { status, paid, unrecognized } = classifyStatus(cellValue(ws, r, 12));
    const linkCell = cellAt(ws, r, 14);

    rows.push({
      destination: String(destRaw).trim(),
      name,
      roomType: roomTypeRaw ? String(roomTypeRaw).trim() : null,
      checkIn: isoDate(parseFullDate(cellValue(ws, r, 4))),
      checkOut: isoDate(parseFullDate(cellValue(ws, r, 5))),
      nights: typeof nightsRaw === 'number' ? nightsRaw : null,
      pricePerNight,
      totalPrice,
      bookedVia: bookedViaRaw != null ? String(bookedViaRaw).trim() || null : null,
      confirmationNumber: confRaw != null ? String(confRaw).trim() || null : null,
      freeCancelUntil: isoDate(parseFullDate(cellValue(ws, r, 11))),
      status,
      paid,
      notes: [cellValue(ws, r, 13), priceNote, totalNote, unrecognized && `סטטוס לא זוהה: "${unrecognized}"`]
        .filter((x) => x != null && x !== '')
        .map(String)
        .join(' · ') || null,
      url: linkCell?.l?.Target ?? (typeof cellValue(ws, r, 14) === 'string' ? String(cellValue(ws, r, 14)) : null),
    });
  }
  return rows;
}

// ---------- גזירת היעדים מתוך המלונות ----------

const DEST_PALETTE = [
  '#DCEBFB', '#D6F2EF', '#FDF6D3', '#DDF1DD', '#EFEFEF',
  '#FBE0EA', '#FCE6CF', '#EBE2F5', '#D8F0F2', '#ECECEC',
];

function buildDestinations(rows: HotelRow[]): Destination[] {
  const groups = new Map<string, HotelRow[]>();
  for (const r of rows) {
    if (!r.destination) continue;
    if (!groups.has(r.destination)) groups.set(r.destination, []);
    groups.get(r.destination)!.push(r);
  }

  const withSortKey: (Destination & { sortKey: string })[] = [];
  let i = 0;
  for (const [label, group] of groups) {
    // מעדיפים את התאריכים של המלונות הסגורים בפועל; אם אין, נופלים לכל מלון עם תאריכים
    const dated = group.filter((h) => h.status === 'booked' && h.checkIn && h.checkOut);
    const source = dated.length ? dated : group.filter((h) => h.checkIn && h.checkOut);
    const checkIns = source.map((h) => h.checkIn!).sort();
    const checkOuts = source.map((h) => h.checkOut!).sort();
    const startDate = checkIns[0] ?? null;
    const endDate = checkOuts[checkOuts.length - 1] ?? null;
    const nights = startDate && endDate ? diffDays(parseIsoDate(endDate), parseIsoDate(startDate)) : null;

    withSortKey.push({
      id: slug(label),
      name: hebrewName(label),
      order: 0,
      startDate,
      endDate,
      nights,
      nightsConflict: null,
      color: DEST_PALETTE[i % DEST_PALETTE.length],
      whereToSleep: null,
      sortKey: startDate ?? `zzz-${i}`, // יעדים בלי תאריך בכלל נדחים לסוף, בסדר ההופעה בגיליון
    });
    i++;
  }

  withSortKey.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return withSortKey.map(({ sortKey: _sortKey, ...d }, order) => ({ ...d, order }));
}

// ---------- הרכבה ----------

function buildTrip(wb: XLSX.WorkBook): Trip {
  const ws = wb.Sheets[SHEET_HOTELS];
  if (!ws) throw new Error(`הגיליון "${SHEET_HOTELS}" לא נמצא בקובץ`);

  const rows = readHotels(ws);
  const destinations = buildDestinations(rows);
  const destIdByLabel = new Map<string, string>();
  for (const r of rows) {
    if (r.destination && !destIdByLabel.has(r.destination)) destIdByLabel.set(r.destination, slug(r.destination));
  }

  const hotels: Hotel[] = rows.map((r) => ({
    id: `h-${destIdByLabel.get(r.destination)}-${slug(r.name)}`,
    destinationId: destIdByLabel.get(r.destination) ?? slug(r.destination),
    name: r.roomType ? `${r.name} — ${r.roomType}` : r.name,
    stars: null,
    area: 'central',
    status: r.status,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    nights: r.nights,
    pricePerNight: r.pricePerNight,
    totalPrice: r.totalPrice,
    currency: 'ILS',
    bookedVia: r.bookedVia,
    confirmationNumber: r.confirmationNumber,
    freeCancelUntil: r.freeCancelUntil,
    freeCancelConflict: null,
    paid: r.paid,
    paidAmount: r.paid ? r.totalPrice : null,
    url: r.url,
    links: [],
    notes: r.notes,
  }));

  // דה-דופ למקרה של אותו שם מלון פעמיים באותו יעד
  const seenIds = new Set<string>();
  for (const h of hotels) {
    const base = h.id;
    let n = 2;
    while (seenIds.has(h.id)) { h.id = `${base}-${n}`; n++; }
    seenIds.add(h.id);
  }

  const startDates = destinations.map((d) => d.startDate).filter((x): x is string => !!x).sort();
  const endDates = destinations.map((d) => d.endDate).filter((x): x is string => !!x).sort();
  const tripStart = startDates[0] ?? null;
  const tripEnd = endDates[endDates.length - 1] ?? null;
  const departureDate = tripStart ? isoDate(addDays(parseIsoDate(tripStart), -1)) : null;

  // טיסות בינ"ל ריקות — אין יותר מקור לתיאורי מעברים בין יעדים (זה היה מגיע מגיליון המסלול שכבר לא קיים)
  const transport: Transport[] = [
    {
      id: 't-intl-out',
      fromDestinationId: null, toDestinationId: destinations[0]?.id ?? null,
      date: departureDate, type: 'flight',
      description: 'טיסה מישראל לתאילנד — למלא פרטים',
      durationMinutes: null, price: null, currency: 'ILS',
      status: 'idea', bookingRef: null, url: null,
    },
    {
      id: 't-intl-back',
      fromDestinationId: destinations[destinations.length - 1]?.id ?? null,
      toDestinationId: null,
      date: tripEnd, type: 'flight',
      description: 'טיסה חזרה לישראל — למלא פרטים',
      durationMinutes: null, price: null, currency: 'ILS',
      status: 'idea', bookingRef: null, url: null,
    },
  ];

  const attractions = seedAttractions(destinations, rows.map((r) => r.destination));

  return {
    name: 'תאילנד — ניר ואשתו',
    startDate: tripStart ?? '',
    endDate: tripEnd ?? '',
    departureDate: departureDate ?? tripStart ?? '',
    returnDate: tripEnd ?? '',
    destinations,
    hotels,
    transport,
    attractions,
    expenses: [],
    settings: {
      travelers: 2,
      thbToIls: 0.105,
      budgetTarget: null,
      dailyFoodBudget: 120,
      theme: 'light',
    },
  };
}

// ---------- אטרקציות זרע (מינימלי: 2-3 ליעד, לפי השם המקורי מהאקסל) ----------

const SEED: Record<string, [string, string, number][]> = {
  'koh samui': [["Ang Thong Marine Park — שיט יומי", 'טבע', 6.0],
    ["Big Buddha & Fisherman's Village", 'תרבות', 3.0]],
  'ko tao': [['קורס/צלילת היכרות', 'ספורט ימי', 4.0],
    ['Nang Yuan Viewpoint', 'טבע', 3.0]],
  'koh phangan': [['Bottle Beach + Thong Nai Pan', 'חופים', 5.0],
    ['Phaeng Waterfall Viewpoint', 'טבע', 3.0]],
  'krabi': [['Railay Beach + Phra Nang Cave', 'חופים', 6.0],
    ['Four Islands Tour', 'שיט', 7.0],
    ['Emerald Pool & Hot Springs', 'טבע', 5.0]],
  'ko lanta': [['Old Town + חופי המערב', 'סיור', 4.0],
    ['Koh Rok / Koh Haa — שנרקול', 'שיט', 8.0]],
  'ko phi phi': [['Maya Bay + Pileh Lagoon', 'שיט', 6.0],
    ['Phi Phi Viewpoint', 'טבע', 2.5]],
  'phuket': [['Old Town פוקט', 'תרבות', 3.0],
    ['Phang Nga Bay / James Bond Island', 'שיט', 8.0],
    ['Promthep Cape — שקיעה', 'נוף', 2.0]],
  'khao lak': [['Similan Islands — יום שנרקול/צלילה', 'שיט', 9.0],
    ['Khao Sok National Park', 'טבע', 10.0]],
  'pattaya': [['Sanctuary of Truth', 'תרבות', 2.5],
    ['Koh Larn — אי סמוך', 'חופים', 6.0]],
  'bangkok': [['Grand Palace + Wat Pho', 'תרבות', 4.0],
    ['Chatuchak Weekend Market', 'שופינג', 4.0],
    ['שוק לילה + רופטופ בר', 'בילוי', 4.0]],
};

function seedAttractions(destinations: Destination[], originalLabels: string[]) {
  // צריך את השם המקורי (לפני תרגום לעברית) כדי להתאים ל-SEED — בונים מיפוי id→שם מקורי
  const labelById = new Map<string, string>();
  for (const label of originalLabels) labelById.set(slug(label), label);

  const out = [];
  for (const d of destinations) {
    const originalLabel = labelById.get(d.id) ?? d.name;
    for (const [name, category, hours] of SEED[originalLabel.trim().toLowerCase()] ?? []) {
      out.push({
        id: `a-${d.id}-${slug(name)}`.slice(0, 80),
        destinationId: d.id,
        kind: 'attraction' as const,
        name,
        category,
        price: null,
        currency: 'ILS' as const,
        durationHours: hours,
        plannedDate: null,
        status: 'idea' as const,
        url: null,
        links: [],
        notes: null,
      });
    }
  }
  return out;
}

// ---------- אימות ----------

function verify(trip: Trip): { errors: string[]; log: string[] } {
  const dests = trip.destinations;
  const booked = trip.hotels.filter((h) => h.status === 'booked');
  const candidates = trip.hotels.filter((h) => h.status === 'candidate');
  const rejected = trip.hotels.filter((h) => h.status === 'rejected');
  const total = booked.reduce((sum, h) => sum + (h.totalPrice ?? 0), 0);
  const nightsPlanned = dests.reduce((sum, d) => sum + (d.nights ?? 0), 0);

  const log = [
    `  יעדים:            ${dests.length}`,
    `  לילות מתוכננים:   ${nightsPlanned}`,
    `  מלונות סגורים:    ${booked.length}`,
    `  מועמדים:          ${candidates.length}`,
    `  נפסלו:            ${rejected.length}`,
    `  סה"כ שולם/שוריין: ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })} ₪`,
  ];

  const errors: string[] = [];
  if (!dests.length) errors.push('לא נמצאו יעדים בגיליון — בדוק את עמודת "יעד"');
  if (!trip.hotels.length) errors.push('לא נמצאו מלונות בגיליון — בדוק את שם הגיליון והמבנה');
  const badDates = dests.filter((d) => !d.startDate || !d.endDate).map((d) => d.name);
  if (badDates.length) errors.push(`יעדים בלי תאריכים (אין למלונות שלהם צ׳ק-אין/אאוט): ${badDates.join(', ')}`);
  const idCounts = new Map<string, number>();
  for (const d of dests) idCounts.set(d.id, (idCounts.get(d.id) ?? 0) + 1);
  const dupIds = [...idCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id).sort();
  if (dupIds.length) errors.push(`מזהי יעדים כפולים: ${dupIds.join(', ')}`);

  return { errors, log };
}

// ---------- API ציבורי ----------

export interface ImportResult {
  ok: boolean;
  trip: Trip | null;
  errors: string[];
  log: string[];
}

export function importExcelBuffer(buf: ArrayBuffer | Buffer): ImportResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'buffer', cellStyles: true, cellDates: true });
  } catch (err) {
    return { ok: false, trip: null, errors: [`לא ניתן לקרוא את הקובץ — ודא שזה קובץ .xlsx תקין (${String(err)})`], log: [] };
  }

  let trip: Trip;
  try {
    trip = buildTrip(wb);
  } catch (err) {
    return { ok: false, trip: null, errors: [String(err instanceof Error ? err.message : err)], log: [] };
  }

  const { errors, log } = verify(trip);
  if (errors.length) return { ok: false, trip: null, errors, log };
  return { ok: true, trip, errors: [], log };
}
