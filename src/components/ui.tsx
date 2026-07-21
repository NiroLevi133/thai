import type { ReactNode } from 'react';
import { Star } from 'lucide-react';

export function StatCard({
  label, value, sub, tone = 'neutral', icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  icon?: ReactNode;
}) {
  const tones = {
    neutral: 'text-neutral-900 dark:text-neutral-100',
    good: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    bad: 'text-red-600 dark:text-red-400',
  };
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium muted">
        {icon}{label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs muted">{sub}</div>}
    </div>
  );
}

export function Stars({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" title={`${n} כוכבים`}>
      <Star size={12} fill="currentColor" />
      <span className="text-xs font-semibold tabular-nums">{n}</span>
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="card p-8 text-center text-sm muted">
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
