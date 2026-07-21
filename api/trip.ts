import { get, put } from '@vercel/blob';
import seed from '../data/trip.json';

/**
 * שמירת נתוני הטיול ב-Vercel Blob.
 *
 * למה לא קובץ בדיסק: ב-Vercel מערכת הקבצים היא לקריאה בלבד, והפונקציה
 * נולדת מחדש בכל בקשה — כתיבה לדיסק פשוט תיעלם. Blob הוא אחסון אובייקטים
 * (לא דאטהבייס): אותו trip.json, רק שהוא שורד בין בקשות ומשותף לכל המכשירים.
 */
const PATH = 'trip.json';
const ACCESS = 'private' as const;

/** גיבוי יומי — pathname לפי תאריך, כך שנצבר לכל היותר קובץ אחד ליום */
const backupPath = () => `backups/trip-${new Date().toISOString().slice(0, 10)}.json`;

async function readTrip(): Promise<unknown | null> {
  // useCache: false — אחרת עדכון עלול לחזור ישן עד דקה
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
    // הנתונים משתנים תדיר — לא רוצים שה-CDN יחזיק גרסה ישנה
    cacheControlMaxAge: 0,
  });
}

export default async function handler(req: Request): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });

  try {
    if (req.method === 'GET') {
      const trip = await readTrip();
      if (trip) return json(trip);

      // ריצה ראשונה אחרי דיפלוי — מזריעים מהקובץ שבריפו ושומרים
      await writeTrip(seed);
      return json(seed);
    }

    if (req.method === 'PUT') {
      const body = await req.json();

      // בדיקת שפיות: לא נותנים לגוף ריק או פגום למחוק את הטיול
      if (!body || typeof body !== 'object' || !Array.isArray(body.destinations)) {
        return json({ error: 'מבנה נתונים לא תקין — השמירה בוטלה' }, 400);
      }

      // גיבוי יומי של המצב הקודם, לפני הדריסה
      const previous = await readTrip();
      if (previous) {
        await writeTrip(previous, backupPath()).catch((e) => console.error('גיבוי נכשל', e));
      }

      await writeTrip(body);
      return json({ ok: true, savedAt: new Date().toISOString() });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (err) {
    console.error('שגיאת אחסון:', err);
    return json({ error: String(err) }, 500);
  }
}
