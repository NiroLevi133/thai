import { scrapeLink } from '../server/scrapeLink.js';

/** מכריח Node.js runtime — ראה api/import-excel.ts להסבר (fetch עם timeout ו-headers מותאמים). */
export const config = { runtime: 'nodejs' };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const url = typeof body?.url === 'string' ? body.url : null;
    if (!url) return json({ error: 'לא התקבל קישור' }, 400);

    const result = await scrapeLink(url);
    return json(result);
  } catch (err) {
    console.error('שליפת קישור נכשלה:', err);
    return json({ error: `לא הצלחתי לשלוף מידע מהקישור: ${String(err instanceof Error ? err.message : err)}` }, 502);
  }
}
