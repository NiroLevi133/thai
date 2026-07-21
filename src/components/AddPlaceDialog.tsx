import { useEffect, useRef, useState } from 'react';
import { X, Ticket, UtensilsCrossed, ArrowRight } from 'lucide-react';
import type { SavedLink, Destination, PlaceKind } from '../types';
import { useTrip, newId } from '../store';
import { parseAmount } from '../lib/money';
import { nightsBetween, fmt } from '../lib/dates';
import { Field } from './ui';
import LinkEditor from './LinkChips';

const KIND_META: Record<PlaceKind, {
  label: string; blurb: string; placeholder: string; categoryLabel: string; categoryHint: string;
}> = {
  attraction: {
    label: 'אטרקציה',
    blurb: 'מקום לבקר בו, טיול, חוף או חוויה',
    placeholder: 'למשל: Maya Bay',
    categoryLabel: 'קטגוריה',
    categoryHint: 'חוף / שיט / טבע',
  },
  restaurant: {
    label: 'מסעדה',
    blurb: 'מסעדה, בר, קפה או דוכן אוכל',
    placeholder: 'למשל: Bebop Bar',
    categoryLabel: 'סוג מטבח',
    categoryHint: 'תאילנדי / ים / צמחוני',
  },
};

export default function AddPlaceDialog({
  destination, onClose, initialKind,
}: {
  destination: Destination;
  onClose: () => void;
  initialKind?: PlaceKind;
}) {
  const { addAttraction } = useTrip();
  const [kind, setKind] = useState<PlaceKind | null>(initialKind ?? null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [hours, setHours] = useState('');
  const [plannedDate, setPlannedDate] = useState('');

  // §1 escape-routes — Esc סוגר תמיד
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // §5 נעילת גלילת הרקע — אחרת הדף זז מתחת למודאל והלחיצות נוחתות עליו
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  // §1 focus-management — בשלב הבחירה הפוקוס על הדיאלוג;
  // בשלב הפרטים משאירים אותו לשדה השם (autoFocus) ולא גוזלים אותו חזרה
  useEffect(() => {
    if (!kind) dialogRef.current?.focus();
  }, [kind]);

  const days = nightsBetween(destination.startDate, destination.endDate);

  const submit = () => {
    if (!name.trim() || !kind) return;
    addAttraction({
      id: newId('a'),
      destinationId: destination.id,
      kind,
      name: name.trim(),
      category: category.trim() || null,
      price: parseAmount(price),
      currency: 'ILS',
      durationHours: parseAmount(hours),
      plannedDate: plannedDate || null,
      status: plannedDate ? 'planned' : 'idea',
      url: null,
      links,
      notes: notes.trim() || null,
    });
    onClose();
  };

  const meta = kind ? KIND_META[kind] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`הוספת מקום ל-${destination.name}`}
        className="max-h-[92vh] w-full max-w-lg animate-pop-in overflow-y-auto rounded-t-4xl bg-white p-5
                   shadow-xl outline-none dark:bg-neutral-900 sm:rounded-4xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold">
              {meta ? `${meta.label} חדשה` : 'מה מוסיפים?'}
            </h2>
            <p className="ltr text-xs muted">
              {destination.name} · {fmt(destination.startDate)}–{fmt(destination.endDate)}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon shrink-0" aria-label="סגור">
            <X size={18} />
          </button>
        </div>

        {/* שלב 1 — אטרקציה או מסעדה */}
        {!kind ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setKind('attraction')}
              className="group flex flex-col items-center gap-2 rounded-3xl border-2 border-sand-200 bg-sand-50 p-6
                         transition-all hover:border-gold-400 hover:bg-gold-300/20 active:scale-[0.98]
                         dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-gold-400"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gold-400 text-jungle-700
                               transition-transform group-hover:scale-110">
                <Ticket size={24} />
              </span>
              <span className="text-base font-bold">אטרקציה</span>
              <span className="text-xs muted">{KIND_META.attraction.blurb}</span>
            </button>

            <button
              onClick={() => setKind('restaurant')}
              className="group flex flex-col items-center gap-2 rounded-3xl border-2 border-sand-200 bg-sand-50 p-6
                         transition-all hover:border-coral-400 hover:bg-coral-200/30 active:scale-[0.98]
                         dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-coral-400"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-coral-600 text-white
                               transition-transform group-hover:scale-110">
                <UtensilsCrossed size={24} />
              </span>
              <span className="text-base font-bold">מסעדה</span>
              <span className="text-xs muted">{KIND_META.restaurant.blurb}</span>
            </button>
          </div>
        ) : (
          /* שלב 2 — פרטים */
          <div className="space-y-3">
            <Field label={`שם ה${meta!.label} *`}>
              <input className="input" value={name} autoFocus placeholder={meta!.placeholder}
                     onChange={(e) => setName(e.target.value)} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={meta!.categoryLabel}>
                <input className="input" value={category} placeholder={meta!.categoryHint}
                       onChange={(e) => setCategory(e.target.value)} />
              </Field>
              <Field label="מחיר לאדם (₪)">
                <input className="input" inputMode="numeric" value={price}
                       onChange={(e) => setPrice(e.target.value)} />
              </Field>
              {kind === 'attraction' && (
                <Field label="משך (שעות)">
                  <input className="input" inputMode="decimal" value={hours}
                         onChange={(e) => setHours(e.target.value)} />
                </Field>
              )}
              <Field label="שבץ ליום">
                <select className="input" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)}>
                  <option value="">ללא תאריך</option>
                  {days.map((d) => <option key={d} value={d}>{fmt(d)}</option>)}
                </select>
              </Field>
            </div>

            <div>
              <span className="label">קישורים שמורים (טיקטוק, אינסטגרם, מפות…)</span>
              <LinkEditor links={links} onChange={setLinks} />
            </div>

            <Field label="הערה">
              <input className="input" value={notes} placeholder="מה מיוחד במקום הזה?"
                     onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <div className="flex items-center justify-between gap-2 pt-2">
              {!initialKind ? (
                <button onClick={() => setKind(null)} className="btn-ghost text-xs">
                  <ArrowRight size={14} aria-hidden /> חזרה
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-ghost">ביטול</button>
                <button onClick={submit} className="btn-primary" disabled={!name.trim()}>
                  שמור {meta!.label}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
