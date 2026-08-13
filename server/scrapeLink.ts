/**
 * שליפת מידע (כותרת/תיאור/תמונה) מקישור לפוסט ברשת חברתית, לצורך מילוי אוטומטי
 * של "לו״ז". קורא תגיות Open Graph מה-HTML הגולמי של הדף — אותן תגיות ששולחות
 * תצוגה מקדימה בוואטסאפ/פייסבוק — בלי צורך במפתחות API של כל פלטפורמה.
 *
 * מגבלה ידועה: אינסטגרם ופייסבוק חוסמים לעיתים גישה לא-מאומתת ומחזירים דף
 * התחברות ללא תגיות תוכן — טיקטוק בד"כ עובד טוב יותר. כשהשליפה לא מצליחה
 * להביא כותרת/תיאור, הצד השני (הלקוח) נופל חזרה למילוי ידני.
 */

export interface ScrapeResult {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => ENTITIES[name] ?? `&${name};`);
}

function metaContent(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]).trim() || null;
  }
  return null;
}

export async function scrapeLink(url: string): Promise<ScrapeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // חלק מהפלטפורמות מגישות HTML עשיר יותר (עם תגיות OG) ל-user agent שנראה כמו דפדפן אמיתי
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) throw new Error(`הדף החזיר ${res.status}`);
    const html = await res.text();

    const title = metaContent(html, 'og:title') ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null);
    return {
      title: title ? decodeEntities(title).trim() || null : null,
      description: metaContent(html, 'og:description') ?? metaContent(html, 'description'),
      image: metaContent(html, 'og:image'),
      siteName: metaContent(html, 'og:site_name'),
    };
  } finally {
    clearTimeout(timeout);
  }
}
