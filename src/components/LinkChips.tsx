import { useState } from 'react';
import { Plus, X, ExternalLink } from 'lucide-react';
import type { SavedLink } from '../types';
import { detectPlatform, normalizeUrl, hostOf } from '../lib/links';
import { newId } from '../store';

/** תגיות הקישורים השמורים, לקריאה בלבד */
export function LinkChipList({ links }: { links: SavedLink[] }) {
  if (!links?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {links.map((l) => {
        const { Icon, label, chip } = detectPlatform(l.url);
        return (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className={`chip transition-transform hover:scale-105 ${chip}`}
            title={l.label ? `${l.label} — ${hostOf(l.url)}` : hostOf(l.url)}
          >
            <Icon size={11} aria-hidden />
            {l.label || label}
          </a>
        );
      })}
    </div>
  );
}

/** עורך קישורים — הדבקה, תווית אופציונלית, ומחיקה */
export default function LinkEditor({
  links, onChange,
}: {
  links: SavedLink[];
  onChange: (next: SavedLink[]) => void;
}) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError('הכתובת לא תקינה — הדבק קישור מלא');
      return;
    }
    onChange([...(links ?? []), { id: newId('l'), url: normalized, label: label.trim() || null }]);
    setUrl('');
    setLabel('');
    setError(null);
  };

  const remove = (id: string) => onChange((links ?? []).filter((l) => l.id !== id));

  return (
    <div className="space-y-2">
      {(links ?? []).length > 0 && (
        <ul className="space-y-1">
          {links.map((l) => {
            const { Icon, label: platformLabel, chip } = detectPlatform(l.url);
            return (
              <li key={l.id} className="flex items-center gap-2 rounded-xl bg-white p-1.5 ring-1 ring-sand-200
                                        dark:bg-neutral-900 dark:ring-neutral-700">
                <span className={`chip shrink-0 ${chip}`}>
                  <Icon size={11} aria-hidden /> {platformLabel}
                </span>
                <span className="ltr min-w-0 flex-1 truncate text-xs muted">{l.label || hostOf(l.url)}</span>
                <a href={l.url} target="_blank" rel="noreferrer" className="btn-icon !min-h-[30px] !min-w-[30px]"
                   aria-label={`פתח ${l.label || hostOf(l.url)}`}>
                  <ExternalLink size={13} />
                </a>
                <button type="button" onClick={() => remove(l.id)}
                        className="btn-icon !min-h-[30px] !min-w-[30px] hover:!text-red-600"
                        aria-label={`הסר את הקישור ${l.label || hostOf(l.url)}`}>
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-[11rem] flex-[2]">
          <input
            className="input ltr"
            value={url}
            placeholder="הדבק קישור מטיקטוק / אינסטגרם / מפות…"
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            aria-label="כתובת הקישור"
            aria-invalid={!!error}
          />
          {/* §8 error-placement — השגיאה צמודה לשדה שגרם לה */}
          {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <input
          className="input min-w-[7rem] flex-1"
          value={label}
          placeholder="תווית (לא חובה)"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          aria-label="תווית לקישור"
        />
        <button type="button" onClick={add} className="btn-ghost shrink-0" disabled={!url.trim()}>
          <Plus size={14} /> הוסף
        </button>
      </div>
    </div>
  );
}
