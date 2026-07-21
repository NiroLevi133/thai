import type { NightCoverage } from '../lib/gaps';
import { fmt } from '../lib/dates';

/**
 * רצועת לילות. §1 color-not-only — הצבע לבדו לא נושא את המידע:
 * לילה פתוח מקבל גם פס אלכסוני, וכל הרצועה מקבלת תיאור טקסטואלי לקורא מסך.
 */
export default function NightsStrip({
  nights, size = 'md',
}: {
  nights: NightCoverage[];
  size?: 'sm' | 'md';
}) {
  const covered = nights.filter((n) => n.hotelId).length;
  const open = nights.length - covered;
  const dims = size === 'sm' ? 'h-5 w-2.5' : 'h-6 w-3';

  return (
    <div
      className="flex gap-0.5"
      role="img"
      aria-label={
        open === 0
          ? `כל ${nights.length} הלילות מכוסים`
          : `${covered} מתוך ${nights.length} לילות מכוסים, ${open} לילות ללא מלון`
      }
    >
      {nights.map((n) => (
        <span
          key={n.night}
          className={`${dims} rounded-sm ${
            n.hotelId ? 'bg-emerald-600' : 'night-open bg-red-500'
          }`}
          title={`${fmt(n.night)} — ${n.hotelName ?? 'ללא מלון'}`}
        />
      ))}
    </div>
  );
}

/** מקרא — מסביר את הצבעים במקום להסתמך עליהם בלבד */
export function NightsLegend() {
  return (
    <div className="flex items-center gap-4 text-xs muted">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm bg-emerald-600" aria-hidden /> לילה עם מלון
      </span>
      <span className="flex items-center gap-1.5">
        <span className="night-open h-3 w-3 rounded-sm bg-red-500" aria-hidden /> לילה ללא מלון
      </span>
    </div>
  );
}
