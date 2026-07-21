import type { Currency, Settings } from '../types';

/** ממיר כל סכום לשקלים לפי השער הידני שבהגדרות */
export function toIls(amount: number | null | undefined, currency: Currency, settings: Settings): number {
  if (!amount) return 0;
  return currency === 'THB' ? amount * settings.thbToIls : amount;
}

export function ils(n: number | null | undefined, opts: { decimals?: number } = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toLocaleString('he-IL', {
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 0,
  })} ₪`;
}

export function thb(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `฿${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

/** פרסר סלחני לקלט ידני: "2,845 ₪" → 2845 */
export function parseAmount(input: string): number | null {
  const m = input.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
