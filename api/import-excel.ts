import { get, put } from '@vercel/blob';
import { importExcelBuffer } from '../server/importExcel';

/**
 * מכריח ריצה ב-Node.js runtime (לא Edge). ל-xlsx (SheetJS) יש תלות ב-API של Node
 * (Buffer/zlib וכו') שלא קיים ב-Edge — בלי זה הפונקציה קורסת בטעינה, לפני שהקוד
 * שלנו בכלל רץ, ומחזירה שגיאת פלטפורמה גולמית (לא JSON) במקום השגיאה המפורטת שלנו.
 */
export const config = { runtime: 'nodejs' };

/** מקביל ל-api/trip.ts — Blob הוא מקור האמת בפרודקשן, אין דיסק לכתוב אליו. */
const PATH = 'trip.json';
const ACCESS = 'private' as const;
const backupPath = () => `backups/trip-${new Date().toISOString().slice(0, 10)}.json`;

async function readTrip(): Promise<unknown | null> {
  const res = await get(PATH, { access: ACCESS, useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = await new Response(res.stream).text();
  return JSON.parse(text);
}

async function writeTrip(data: unknown, pathname = PATH) {
  await put(pathname, JSON.stringify(data, null, 2), {
    access: ACCESS,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** ייצוא לפי שם המתודה — ראה api/trip.ts להסבר. */
export async function POST(req: Request): Promise<Response> {
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (!buf.length) return json({ error: 'לא התקבל קובץ' }, 400);

    const result = importExcelBuffer(buf);
    if (!result.ok || !result.trip) {
      return json({ error: result.errors.join('\n') }, 400);
    }

    const previous = await readTrip();
    if (previous) {
      await writeTrip(previous, backupPath()).catch((e) => console.error('גיבוי נכשל', e));
    }
    await writeTrip(result.trip);

    return json({ ok: true, trip: result.trip, log: result.log.join('\n') });
  } catch (err) {
    console.error('ייבוא אקסל נכשל:', err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
}
