import type { ReactNode } from 'react';
import { PartyPopper, Sparkles } from 'lucide-react';

/**
 * מצב ריק מעודד — §8 empty-states.
 * במקום "אין נתונים" יבש, מסביר מה אפשר לעשות ונותן כפתור להתחיל.
 */
export function EmptyFun({
  title, hint, action, icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-sand-100 text-jungle-600
                       dark:bg-neutral-800 dark:text-gold-300">
        {icon ?? <Sparkles size={22} />}
      </span>
      <p className="text-sm font-bold">{title}</p>
      {hint && <p className="max-w-xs text-xs muted">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** באנר חגיגה כשמשימה נסגרת במלואה — משוב חיובי שהופך מילוי למתגמל */
export function Celebrate({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex animate-pop-in items-center justify-center gap-2 rounded-2xl bg-jungle-600/10 px-3 py-2
                 text-sm font-bold text-jungle-700 ring-1 ring-jungle-600/20
                 dark:bg-jungle-400/10 dark:text-jungle-400 dark:ring-jungle-400/25"
      role="status"
    >
      <PartyPopper size={16} aria-hidden />
      {children}
    </div>
  );
}
