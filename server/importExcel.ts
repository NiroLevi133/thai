/**
 * ייבוא מקובץ האקסל אל אובייקט Trip — פורטינג של scripts/import_excel.py (openpyxl) ל-TS/SheetJS,
 * כדי שאותה לוגיקה תרוץ גם בשרת המקומי וגם בפונקציית Vercel (שם אין ריצת פייתון).
 * מקור: "מסלול לתאילנד מפורט ביותר!.xlsx" — שני גיליונות:
 *   - "מלונות שהוזמנו"   → מלונות סגורים (status=booked)
 *   - "מסלול ב - הנבחר"  → יעדים + מועמדי מלונות (צהוב FFFF00 = נסגר)
 */
import * as XLSX from 'xlsx';
import type { Trip, Destination, Hotel, Transport, Attraction, TransportType } from '../src/types';

const YELLOW = 'FFFF00';
const SHEET_BOOKED = 'מלונות שהוזמנו';
const SHEET_ITIN = 'מסלול ב - הנבחר';

// הטיול חוצה שנה: כל תאריך לפני 09.12 שייך ל-2027
const TRIP_START: SimpleDate = { y: 2026, m: 12, d: 9 };
const TRIP_END: SimpleDate = { y: 2027, m: 1, d: 14 };
const DEPARTURE: SimpleDate = { y: 2026, m: 12, d: 8 };
const RETURN: SimpleDate = { y: 2027, m: 1, d: 14 };

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
function cmpDate(a: SimpleDate, b: SimpleDate): number {
  return toJs(a).getTime() - toJs(b).getTime();
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
/** 'YYYY-MM-DD' → תאריך (מקביל ל-date.fromisoformat של פייתון) */
function parseIsoDate(s: string): SimpleDate {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return { y, m, d };
}
function dateFromExcel(v: unknown): SimpleDate | null {
  if (v instanceof Date) return { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, d: v.getUTCDate() };
  return null;
}

// ---------- עזרי פרסינג ----------

/** '09.12.2026' → תאריך */
function parseFullDate(v: unknown): SimpleDate | null {
  if (v == null) return null;
  const fromDate = dateFromExcel(v);
  if (fromDate) return fromDate;
  const m = String(v).match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  return mkDate(y, mo, dd);
}

/** '09.12' → תאריך, עם השלמת שנה לפי טווח הטיול */
function parseShortDate(text: string): SimpleDate | null {
  const m = text.match(/(\d{1,2})[./](\d{1,2})/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  for (const y of [2026, 2027]) {
    const cand = mkDate(y, mo, dd);
    if (cand && cmpDate(cand, TRIP_START) >= 0 && cmpDate(cand, TRIP_END) <= 0) return cand;
  }
  return null;
}

/** '09.12 – 13.12' → [start, end] */
function parseRange(text: unknown): [SimpleDate | null, SimpleDate | null] {
  if (!text) return [null, null];
  const parts = String(text).split(/[–\-—]/);
  if (parts.length < 2) return [null, null];
  return [parseShortDate(parts[0]), parseShortDate(parts[1])];
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

/** '★★★★½' → 4.5 */
function parseStars(v: unknown): number | null {
  if (!v) return null;
  const s = String(v);
  const n = (s.match(/★/g)?.length ?? 0) + (s.match(/⭐/g)?.length ?? 0);
  if (!n) return null;
  return s.includes('½') ? n + 0.5 : n;
}

function stripStars<T extends string | null | undefined>(name: T): string | (T & null) {
  if (!name) return name as T & null;
  return String(name).replace(/[★⭐½\s]+/g, ' ').trim();
}

const NORMALIZE_DROP = new Set([
  'hotel', 'resort', 'spa', 'and', 'the', 'villas', 'villa', 'pool',
  'sha', 'extra', 'plus', 'adults', 'adult', 'only', 'beach', 'koh', 'ko',
]);

/** נרמול שם מלון להשוואה בין שני הגיליונות */
function normalize(name: string): string {
  let s = (stripStars(name) ?? '').toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, ' ');
  return s.split(' ').filter((w) => w && !NORMALIZE_DROP.has(w)).join(' ');
}

function cellFillRgb(cell: XLSX.CellObject | undefined): string | null {
  const rgb = (cell?.s as { fgColor?: { rgb?: unknown } } | undefined)?.fgColor?.rgb;
  return typeof rgb === 'string' ? rgb : null;
}
function isYellow(cell: XLSX.CellObject | undefined): boolean {
  return cellFillRgb(cell) === YELLOW;
}
function hexColor(cell: XLSX.CellObject | undefined, fallback = '#e5e7eb'): string {
  const rgb = cellFillRgb(cell);
  if (!rgb || rgb.length !== 6 || rgb === '000000') return fallback;
  return '#' + rgb;
}

function slug(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// שמות היעדים באקסל המקור באנגלית — מתורגמים לעברית לתצוגה באפליקציה.
// יעד שלא ברשימה נשאר בשמו המקורי.
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

// ---------- חילוץ מידע מהערות (עמודה J) ----------

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}️⏱⏰✈⛴]+/gu;

/** מנקה אמוג׳י מטקסט חופשי — ב-UI סוג המעבר מיוצג באייקון SVG ובתגית */
function cleanEmoji(text: unknown): string {
  const out: string[] = [];
  for (let line of String(text).split('\n')) {
    line = line.replace(EMOJI_RE, '');
    line = line.replace(/\s{2,}/g, ' ').trim().replace(/^[\s+·\-–]+|[\s+·\-–]+$/g, '').trim();
    if (line) out.push(line);
  }
  return out.join('\n');
}

interface ParsedNote { confirmationNumber: string | null; freeCancelUntil: string | null }

/** מחלץ מס' הזמנה ותאריך ביטול מהערה חופשית בעברית */
function parseNote(note: unknown): ParsedNote {
  const out: ParsedNote = { confirmationNumber: null, freeCancelUntil: null };
  if (!note) return out;
  const s = String(note);
  const confMatch = s.match(/מס.?\s*הזמנה\s*[-–:]?\s*(\d{6,})/);
  if (confMatch) out.confirmationNumber = confMatch[1];

  const dateMatch = s.match(/(?:עד|ה)\s*ה?(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)/);
  if (dateMatch) {
    const raw = dateMatch[1];
    let d = (raw.match(/\./g)?.length ?? 0) === 2 ? parseFullDate(raw) : null;
    if (!d) {
      // תאריכי ביטול הם תמיד לפני הטיול (נוב'-דצמ' 2026) או בתוכו
      const mm = raw.match(/^(\d{1,2})[./](\d{1,2})/);
      if (mm) {
        const dd = parseInt(mm[1], 10);
        const mo = parseInt(mm[2], 10);
        const y = mo === 1 ? 2027 : 2026;
        d = mkDate(y, mo, dd);
      }
    }
    out.freeCancelUntil = isoDate(d);
  }
  return out;
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

// ---------- קריאת גיליון ההזמנות ----------

interface BookedRow {
  destination: string; name: string; stars: number | null;
  checkIn: string | null; checkOut: string | null; nights: number | null;
  pricePerNight: number | null; totalPrice: number | null;
  bookedVia: string | null; confirmationNumber: string | null;
  freeCancelUntil: string | null; notes: string | null; url: string | null;
}

function readBooked(ws: XLSX.WorkSheet): BookedRow[] {
  const rows: BookedRow[] = [];
  for (let r = 6; r <= maxRow(ws); r++) {
    const name = cellValue(ws, r, 2);
    if (!name) continue;
    const [total, totalNote] = parseMoney(cellValue(ws, r, 8));
    const [perNight] = parseMoney(cellValue(ws, r, 7));
    const linkCell = cellAt(ws, r, 14);
    const nightsRaw = cellValue(ws, r, 6);
    const confRaw = cellValue(ws, r, 10);
    rows.push({
      destination: String(cellValue(ws, r, 1) ?? '').trim(),
      name: String(name).trim(),
      stars: parseStars(cellValue(ws, r, 3)),
      checkIn: isoDate(parseFullDate(cellValue(ws, r, 4))),
      checkOut: isoDate(parseFullDate(cellValue(ws, r, 5))),
      nights: typeof nightsRaw === 'number' ? nightsRaw : null,
      pricePerNight: perNight,
      totalPrice: total,
      bookedVia: cellValue(ws, r, 9) != null ? String(cellValue(ws, r, 9)) : null,
      confirmationNumber: confRaw != null ? String(confRaw).trim() || null : null,
      freeCancelUntil: isoDate(parseFullDate(cellValue(ws, r, 11))),
      notes: [cellValue(ws, r, 13), totalNote].filter((x) => x != null && x !== '').map(String).join(' ') || null,
      url: linkCell?.l?.Target ?? null,
    });
  }
  return rows;
}

// ---------- קריאת גיליון המסלול ----------

interface DestBlock { r0: number; r1: number; label: string }

/** בלוקי יעד לפי מיזוגים בעמודה A */
function destinationBlocks(ws: XLSX.WorkSheet): DestBlock[] {
  const merged = new Map<number, number>();
  for (const rng of ws['!merges'] ?? []) {
    if (rng.s.c === 0 && rng.e.c === 0 && rng.s.r >= 1) {
      merged.set(rng.s.r + 1, rng.e.r + 1);
    }
  }

  const rowsMax = maxRow(ws);
  const starts: number[] = [];
  for (let r = 2; r <= rowsMax; r++) {
    if (cellValue(ws, r, 1)) starts.push(r);
  }

  const blocks: DestBlock[] = [];
  for (let i = 0; i < starts.length; i++) {
    const r = starts[i];
    const label = String(cellValue(ws, r, 1)).trim();
    if (label.startsWith('סה')) continue; // שורת הסיכום "סה"כ לילות - 36"
    const end = merged.get(r) ?? r;
    const nextStart = starts.slice(i + 1).find((s) => !String(cellValue(ws, s, 1)).startsWith('סה'));
    const limit = nextStart != null ? nextStart - 1 : rowsMax;
    blocks.push({ r0: r, r1: Math.max(end, Math.min(limit, rowsMax)), label });
  }
  return blocks;
}

interface CandidateRow {
  destinationId: string; name: string; stars: number | null; area: 'central' | 'remote';
  totalPrice: number | null; url: string | null; booked: boolean; notes: string | null;
}
interface TransferRow { destinationId: string; description: string; date: string | null }

function readItinerary(ws: XLSX.WorkSheet): { destinations: Destination[]; candidates: CandidateRow[]; transfers: TransferRow[] } {
  const destinations: Destination[] = [];
  const candidates: CandidateRow[] = [];
  const transfers: TransferRow[] = [];

  destinationBlocks(ws).forEach(({ r0, r1, label }, order) => {
    const excelNightsRaw = cellValue(ws, r0, 2);
    const excelNights = typeof excelNightsRaw === 'number' ? Math.trunc(excelNightsRaw) : null;
    const [start, end] = parseRange(cellValue(ws, r0, 3));
    // התאריכים הם מקור האמת (הם משתרשרים ברצף); עמודת הלילות באקסל שגויה בפוקט
    const nights = start && end ? diffDays(end, start) : excelNights;
    const destId = slug(label);
    const whereToSleepRaw = cellValue(ws, r0, 5);

    destinations.push({
      id: destId,
      name: label,
      order,
      startDate: isoDate(start),
      endDate: isoDate(end),
      nights,
      nightsConflict: excelNights && excelNights !== nights ? excelNights : null,
      color: hexColor(cellAt(ws, r0, 1)),
      whereToSleep: whereToSleepRaw ? String(whereToSleepRaw).trim() : null,
    });

    const transfer = cellValue(ws, r0, 4);
    if (transfer) transfers.push({ destinationId: destId, description: cleanEmoji(transfer), date: isoDate(end) });

    // מועמדי מלונות: F/G = מרכזי, H/I = מרוחק
    const cols: [number, number, 'central' | 'remote'][] = [[6, 7, 'central'], [8, 9, 'remote']];
    for (const [nameCol, priceCol, area] of cols) {
      for (let r = r0; r <= r1; r++) {
        const cell = cellAt(ws, r, nameCol);
        if (!cell?.v) continue;
        let raw = String(cell.v).trim();
        let url = cell.l?.Target ?? null;
        let note: string | null = null;
        if (raw.startsWith('http')) {
          url = url ?? raw;
          raw = 'מלון ללא שם';
          note = 'שם חסר באקסל — לעדכן מהלינק';
        }
        const [price, priceNote] = parseMoney(cellValue(ws, r, priceCol));
        const rowNoteRaw = isYellow(cell) ? (cellValue(ws, r, 10) ?? cellValue(ws, r0, 10)) : null;
        candidates.push({
          destinationId: destId,
          name: stripStars(raw) ?? raw,
          stars: parseStars(raw),
          area,
          totalPrice: price,
          url,
          booked: isYellow(cell),
          notes: [note, priceNote].filter((x) => x != null).join(' · ') || null,
        });
        void rowNoteRaw;
      }
    }
  });

  return { destinations, candidates, transfers };
}

/** הערות עמודה J (ממוזגות) לפי שורה */
function collectNotes(ws: XLSX.WorkSheet): string[] {
  const notes: string[] = [];
  for (let r = 2; r <= maxRow(ws); r++) {
    const v = cellValue(ws, r, 10);
    if (v && isYellow(cellAt(ws, r, 10))) notes.push(String(v).trim());
  }
  return notes;
}

// ---------- אטרקציות זרע (מינימלי: 2-3 ליעד) ----------

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

function seedAttractions(destinations: Destination[]): Attraction[] {
  const out: Attraction[] = [];
  for (const d of destinations) {
    for (const [name, category, hours] of SEED[d.name.trim().toLowerCase()] ?? []) {
      out.push({
        id: `a-${d.id}-${slug(name)}`.slice(0, 80),
        destinationId: d.id,
        kind: 'attraction',
        name,
        category,
        price: null,
        currency: 'ILS',
        durationHours: hours,
        plannedDate: null,
        status: 'idea',
        url: null,
        links: [],
        notes: null,
      });
    }
  }
  return out;
}

// ---------- הרכבה ----------

function detectTransportType(desc: string): TransportType {
  let type: TransportType = 'other';
  if (desc.includes('מעבור') || desc.includes('⛴')) type = 'ferry';
  if (desc.includes('ספיד')) type = 'speedboat';
  if (desc.includes('טיס') || desc.includes('✈')) type = 'flight';
  if (desc.includes('מיניוואן') || desc.includes('🚐')) type = 'minivan';
  if (desc.includes('רכבת')) type = 'train';
  else if (desc.includes('אוטובוס')) type = 'bus';
  else if (desc.includes('מונית')) type = 'taxi';
  return type;
}

function buildTrip(wb: XLSX.WorkBook): { trip: Trip; booked: BookedRow[] } {
  const wsBooked = wb.Sheets[SHEET_BOOKED];
  const wsItin = wb.Sheets[SHEET_ITIN];
  if (!wsBooked) throw new Error(`הגיליון "${SHEET_BOOKED}" לא נמצא בקובץ`);
  if (!wsItin) throw new Error(`הגיליון "${SHEET_ITIN}" לא נמצא בקובץ`);

  const booked = readBooked(wsBooked);
  const { destinations, candidates, transfers } = readItinerary(wsItin);
  const excelNotes = collectNotes(wsItin);

  // מיפוי הערות לפי מספר הזמנה, כדי לזהות סתירות בתאריך ביטול
  const noteByConf = new Map<string, ParsedNote>();
  for (const n of excelNotes) {
    const p = parseNote(n);
    if (p.confirmationNumber) noteByConf.set(p.confirmationNumber, p);
  }

  const destByName = new Map(destinations.map((d) => [d.name.toLowerCase(), d]));

  const hotels: Hotel[] = [];
  const usedCandidates = new Set<number>();

  for (const b of booked) {
    const dest = destByName.get(b.destination.toLowerCase());
    const destId = dest ? dest.id : slug(b.destination);
    const key = normalize(b.name);

    // מיזוג עם המועמד הצהוב המקביל
    let match: number | null = null;
    for (let i = 0; i < candidates.length; i++) {
      if (usedCandidates.has(i) || !candidates[i].booked) continue;
      const c = candidates[i];
      if (c.destinationId !== destId) continue;
      const cKey = normalize(c.name);
      if (cKey === key || key.includes(cKey) || cKey.includes(key)) { match = i; break; }
    }
    let area: 'central' | 'remote' = 'central';
    let url = b.url;
    if (match !== null) {
      usedCandidates.add(match);
      area = candidates[match].area;
      url = url ?? candidates[match].url;
    }

    // זיהוי סתירה בתאריך ביטול בין שני המקורות
    let conflict: string | null = null;
    const alt = b.confirmationNumber ? noteByConf.get(b.confirmationNumber) : undefined;
    if (alt?.freeCancelUntil && alt.freeCancelUntil !== b.freeCancelUntil) conflict = alt.freeCancelUntil;

    hotels.push({
      id: `h-${slug(b.name)}`,
      destinationId: destId,
      name: b.name,
      stars: b.stars,
      area,
      status: 'booked',
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      pricePerNight: b.pricePerNight,
      totalPrice: b.totalPrice,
      currency: 'ILS',
      bookedVia: b.bookedVia,
      confirmationNumber: b.confirmationNumber,
      freeCancelUntil: b.freeCancelUntil,
      freeCancelConflict: conflict,
      paid: false,
      paidAmount: null,
      url,
      links: [],
      notes: b.notes,
    });
  }

  // מועמדים שנותרו
  const seenIds = new Set<string>();
  candidates.forEach((c, i) => {
    if (usedCandidates.has(i)) return;
    const base = `c-${c.destinationId}-${slug(c.name)}`;
    let hid = base;
    let n = 2;
    while (seenIds.has(hid)) { hid = `${base}-${n}`; n++; }
    seenIds.add(hid);
    hotels.push({
      id: hid,
      destinationId: c.destinationId,
      name: c.name,
      stars: c.stars,
      area: c.area,
      status: 'candidate',
      checkIn: null, checkOut: null, nights: null,
      pricePerNight: null,
      totalPrice: c.totalPrice,
      currency: 'ILS',
      bookedVia: null, confirmationNumber: null,
      freeCancelUntil: null, freeCancelConflict: null,
      paid: false, paidAmount: null,
      url: c.url,
      links: [],
      notes: c.notes,
    });
  });

  // תחבורה: מעברים בין יעדים + טיסות בינ"ל ריקות
  const transport: Transport[] = [{
    id: 't-intl-out',
    fromDestinationId: null, toDestinationId: destinations[0]?.id ?? null,
    date: isoDate(DEPARTURE), type: 'flight',
    description: 'טיסה מישראל לתאילנד — למלא פרטים',
    durationMinutes: null, price: null, currency: 'ILS',
    status: 'idea', bookingRef: null, url: null,
  }];
  transfers.forEach((t, i) => {
    const idx = destinations.findIndex((d) => d.id === t.destinationId);
    const nxt = idx !== -1 && idx + 1 < destinations.length ? destinations[idx + 1].id : null;
    transport.push({
      id: `t-${i}-${t.destinationId}`,
      fromDestinationId: t.destinationId,
      toDestinationId: nxt,
      date: t.date, type: detectTransportType(t.description),
      description: t.description,
      durationMinutes: null, price: null, currency: 'ILS',
      status: 'idea', bookingRef: null, url: null,
    });
  });
  transport.push({
    id: 't-intl-back',
    fromDestinationId: destinations[destinations.length - 1]?.id ?? null,
    toDestinationId: null,
    date: isoDate(RETURN), type: 'flight',
    description: 'טיסה חזרה לישראל — יוצאת אחרי חצות בלילה שבין 13 ל-14.01',
    durationMinutes: null, price: null, currency: 'ILS',
    status: 'idea', bookingRef: null, url: null,
  });

  const attractions = seedAttractions(destinations);

  // תרגום שמות היעדים לעברית לתצוגה — אחרי שכל ההתאמות (מלונות/אטרקציות)
  // כבר נעשו לפי השם המקורי מהאקסל
  for (const d of destinations) d.name = hebrewName(d.name);

  const trip: Trip = {
    name: 'תאילנד — ניר ואשתו',
    startDate: isoDate(TRIP_START)!,
    endDate: isoDate(TRIP_END)!,
    departureDate: isoDate(DEPARTURE)!,
    returnDate: isoDate(RETURN)!,
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
  return { trip, booked };
}

// ---------- אימות ----------

/** בדיקות מבניות בלבד — לא נעולות על תמונת מצב היסטורית של הטיול, כדי שאפשר יהיה
 *  לייבא מחדש בכל פעם שהאקסל מתעדכן (הזמנות/מחירים/יעדים חדשים) */
function verify(trip: Trip): { errors: string[]; log: string[] } {
  const dests = trip.destinations;
  const booked = trip.hotels.filter((h) => h.status === 'booked');
  const candidates = trip.hotels.filter((h) => h.status === 'candidate');
  const total = booked.reduce((sum, h) => sum + (h.totalPrice ?? 0), 0);
  const nightsPlanned = dests.reduce((sum, d) => sum + (d.nights ?? 0), 0);

  const covered = new Set<string>();
  for (const h of booked) {
    if (!h.checkIn || !h.checkOut) continue;
    let a = parseIsoDate(h.checkIn);
    const b = parseIsoDate(h.checkOut);
    while (cmpDate(a, b) < 0) { covered.add(isoDate(a)!); a = addDays(a, 1); }
  }
  const allNights = new Set<string>();
  for (const d of dests) {
    if (!d.startDate || !d.endDate) continue;
    let a = parseIsoDate(d.startDate);
    const b = parseIsoDate(d.endDate);
    while (cmpDate(a, b) < 0) { allNights.add(isoDate(a)!); a = addDays(a, 1); }
  }
  const openNights = [...allNights].filter((n) => !covered.has(n)).sort();

  const log = [
    `  יעדים:            ${dests.length}`,
    `  לילות מתוכננים:   ${nightsPlanned}`,
    `  מלונות סגורים:    ${booked.length}`,
    `  מועמדים:          ${candidates.length}`,
    `  סה"כ שולם/שוריין: ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })} ₪`,
    `  לילות פתוחים:     ${openNights.length}`,
    `  תחבורה:           ${trip.transport.length} רשומות`,
    `  אטרקציות:         ${trip.attractions.length}`,
  ];

  const errors: string[] = [];
  if (!dests.length) errors.push('לא נמצאו יעדים בגיליון המסלול — בדוק את שם הגיליון והמבנה');
  if (nightsPlanned <= 0) errors.push('סה"כ הלילות המתוכננים הוא 0 — בדוק את התאריכים בגיליון');
  const badDates = dests.filter((d) => !d.startDate || !d.endDate).map((d) => d.name);
  if (badDates.length) errors.push(`יעדים בלי תאריכים תקינים: ${badDates.join(', ')}`);
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
    ({ trip } = buildTrip(wb));
  } catch (err) {
    return { ok: false, trip: null, errors: [String(err instanceof Error ? err.message : err)], log: [] };
  }

  const { errors, log } = verify(trip);
  if (errors.length) return { ok: false, trip: null, errors, log };
  return { ok: true, trip, errors: [], log };
}
