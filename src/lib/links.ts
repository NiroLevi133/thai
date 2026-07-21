import {
  Instagram, Facebook, Youtube, MapPin, Music2, Link as LinkIcon, Globe, Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Platform {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** צבע הרקע של התג — מלווה תמיד בשם הפלטפורמה, לא נושא מידע לבדו */
  chip: string;
}

/**
 * הדפוסים נבדקים מול "host + path" אחרי הסרת www,
 * ולא מול ה-URL המלא — אחרת "https://tiktok.com" לא היה נתפס.
 */
const PLATFORMS: (Platform & { match: RegExp })[] = [
  {
    key: 'tiktok', label: 'טיקטוק', Icon: Music2, match: /^(vm\.|vt\.|m\.)?tiktok\.com\//i,
    chip: 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900',
  },
  {
    key: 'instagram', label: 'אינסטגרם', Icon: Instagram, match: /^(m\.)?instagram\.com\/|^instagr\.am\//i,
    chip: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200',
  },
  {
    key: 'facebook', label: 'פייסבוק', Icon: Facebook, match: /^(m\.|web\.)?facebook\.com\/|^fb\.(com|watch|me)\//i,
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  },
  {
    key: 'youtube', label: 'יוטיוב', Icon: Youtube, match: /^(m\.)?youtube\.com\/|^youtu\.be\//i,
    chip: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  },
  {
    key: 'maps', label: 'מפות', Icon: MapPin,
    match: /^maps\.app\.goo\.gl\/|^goo\.gl\/maps|^maps\.google\.|^google\.[a-z.]+\/maps/i,
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  },
  {
    key: 'tripadvisor', label: 'TripAdvisor', Icon: Star, match: /^([a-z]{2,3}\.)?tripadvisor\.[a-z.]+\//i,
    chip: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  },
  {
    key: 'booking', label: 'הזמנות', Icon: Globe,
    match: /^([a-z]{2,3}\.)?(booking\.com|agoda\.com|expedia\.[a-z.]+|trip\.com|hotels\.com)\//i,
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  },
];

const FALLBACK: Platform = {
  key: 'other', label: 'קישור', Icon: LinkIcon,
  chip: 'bg-sand-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
};

export function detectPlatform(url: string): Platform {
  let target = url;
  try {
    const u = new URL(url);
    target = u.hostname.replace(/^www\./i, '') + (u.pathname || '/');
  } catch {
    // כתובת לא תקינה — נשארים עם המחרוזת הגולמית
  }
  const found = PLATFORMS.find((p) => p.match.test(target));
  if (!found) return FALLBACK;
  const { match: _match, ...platform } = found;
  return platform;
}

/** משלים https:// כשחסר, כדי שהדבקה של "tiktok.com/..." תעבוד */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

/** תצוגה מקוצרת: "tiktok.com/@user/video/123" → "tiktok.com" */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
