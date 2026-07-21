import { useState } from 'react';
import {
  Plus, Trash2, Clock, ChevronDown, Ticket, UtensilsCrossed, Pencil,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTrip } from '../store';
import type { Attraction, PlaceKind } from '../types';
import { nightsBetween, fmt } from '../lib/dates';
import { ils, parseAmount } from '../lib/money';
import { SectionTitle, Field } from '../components/ui';
import { EmptyFun } from '../components/Encourage';
import AddPlaceDialog from '../components/AddPlaceDialog';
import LinkEditor, { LinkChipList } from '../components/LinkChips';

const STATUS_META: Record<Attraction['status'], { label: string; cls: string }> = {
  idea: { label: 'רעיון', cls: 'bg-sand-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
  planned: { label: 'מתוכנן', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  booked: { label: 'הוזמן', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  done: { label: 'בוצע', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300' },
};

const KIND_UI: Record<PlaceKind, { title: string; Icon: LucideIcon; chip: string; empty: string }> = {
  attraction: {
    title: 'אטרקציות',
    Icon: Ticket,
    chip: 'bg-gold-300/50 text-neutral-800 dark:bg-gold-600/25 dark:text-gold-300',
    empty: 'אין עדיין אטרקציות ביעד הזה',
  },
  restaurant: {
    title: 'מסעדות',
    Icon: UtensilsCrossed,
    chip: 'bg-coral-200/70 text-coral-700 dark:bg-coral-700/25 dark:text-coral-400',
    empty: 'אין עדיין מסעדות ביעד הזה',
  },
};

export default function Places() {
  const trip = useTrip((s) => s.trip)!;
  // ברירת מחדל: הכל מקופל — היעד נפתח בקליק
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<{ destId: string; kind?: PlaceKind } | null>(null);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const destinations = [...trip.destinations].sort((a, b) => a.order - b.order);
  const addingDest = destinations.find((d) => d.id === adding?.destId);

  const counts = (kind: PlaceKind) => trip.attractions.filter((a) => a.kind === kind).length;

  return (
    <div className="space-y-3">
      <SectionTitle
        action={
          <button
            onClick={() => setOpen(open.size ? new Set() : new Set(destinations.map((d) => d.id)))}
            className="btn-ghost text-xs"
          >
            {open.size ? 'סגור הכל' : 'פתח הכל'}
          </button>
        }
      >
        מקומות · {counts('attraction')} אטרקציות · {counts('restaurant')} מסעדות
      </SectionTitle>

      {destinations.map((d) => {
        const all = trip.attractions.filter((a) => a.destinationId === d.id);
        const byKind = (k: PlaceKind) => all.filter((a) => a.kind === k);
        const isOpen = open.has(d.id);
        const days = nightsBetween(d.startDate, d.endDate);

        return (
          <div key={d.id} className="card overflow-hidden">
            {/* כותרת היעד — לחיצה פותחת וסוגרת */}
            <div
              className="flex items-center gap-3 p-3"
              style={{ borderInlineStartWidth: 5, borderInlineStartColor: d.color, borderInlineStartStyle: 'solid' }}
            >
              <button
                onClick={() => toggle(d.id)}
                aria-expanded={isOpen}
                aria-controls={`panel-${d.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 text-start transition-colors
                           hover:bg-sand-50 dark:hover:bg-neutral-800/60"
              >
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="ltr block font-bold">{d.name}</span>
                  <span className="block text-xs muted">
                    {fmt(d.startDate)}–{fmt(d.endDate)} · {d.nights} לילות
                  </span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {(['attraction', 'restaurant'] as PlaceKind[]).map((k) => {
                    const { Icon, chip, title } = KIND_UI[k];
                    return (
                      <span key={k} className={`chip ${chip}`} title={title}>
                        <Icon size={11} aria-hidden /> {byKind(k).length}
                      </span>
                    );
                  })}
                </span>
              </button>

              <button onClick={() => setAdding({ destId: d.id })} className="btn-primary shrink-0 !px-3 text-xs">
                <Plus size={14} aria-hidden /> הוסף
              </button>
            </div>

            {isOpen && (
              <div id={`panel-${d.id}`} className="animate-fade-in border-t border-sand-100 dark:border-neutral-800">
                {all.length === 0 ? (
                  <EmptyFun
                    title={`עוד לא שמרת מקומות ב-${d.name}`}
                    hint="הוסף אטרקציה או מסעדה, כולל קישור מטיקטוק, אינסטגרם או גוגל מפאס"
                    action={
                      <button onClick={() => setAdding({ destId: d.id })} className="btn-primary text-xs">
                        <Plus size={14} aria-hidden /> הוסף מקום ראשון
                      </button>
                    }
                  />
                ) : (
                  <div className="grid gap-0 lg:grid-cols-2">
                    {(['attraction', 'restaurant'] as PlaceKind[]).map((k, i) => {
                      const list = byKind(k);
                      const { title, Icon, empty } = KIND_UI[k];
                      return (
                        <section
                          key={k}
                          className={`p-3 ${i === 1 ? 'border-t border-sand-100 dark:border-neutral-800 lg:border-t-0 lg:border-e lg:border-sand-100 lg:dark:border-neutral-800' : ''}`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide muted">
                              <Icon size={13} aria-hidden /> {title} ({list.length})
                            </h3>
                            <button
                              onClick={() => setAdding({ destId: d.id, kind: k })}
                              className="btn-icon !min-h-[30px] !min-w-[30px]"
                              aria-label={`הוסף ${title} ל-${d.name}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          {list.length === 0 ? (
                            <p className="py-3 text-center text-xs muted">{empty}</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {list.map((a) => <PlaceRow key={a.id} a={a} days={days} />)}
                            </ul>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {addingDest && (
        <AddPlaceDialog
          destination={addingDest}
          initialKind={adding?.kind}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}

function PlaceRow({ a, days }: { a: Attraction; days: string[] }) {
  const { updateAttraction, removeAttraction } = useTrip();
  const travelers = useTrip((s) => s.trip!.settings.travelers);
  const [edit, setEdit] = useState(false);
  const meta = STATUS_META[a.status];
  const isRestaurant = a.kind === 'restaurant';

  return (
    <li className="rounded-2xl bg-sand-50/70 p-2.5 dark:bg-neutral-800/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm font-semibold">{a.name}</span>
        <span className={`chip shrink-0 ${meta.cls}`}>{meta.label}</span>
        {a.durationHours != null && (
          <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums muted">
            <Clock size={11} aria-hidden /> {a.durationHours}ש׳
          </span>
        )}
        {a.price != null && (
          <span className="shrink-0 text-sm font-bold tabular-nums">{ils(a.price * travelers)}</span>
        )}
        <button onClick={() => setEdit(!edit)} className="btn-icon !min-h-[32px] !min-w-[32px] shrink-0"
                aria-expanded={edit} aria-label={`ערוך את ${a.name}`}>
          <Pencil size={13} />
        </button>
      </div>

      {(a.category || a.notes) && (
        <p className="mt-1 text-xs muted">{[a.category, a.notes].filter(Boolean).join(' · ')}</p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <LinkChipList links={a.links} />
        <select
          className="input !w-auto !py-0.5 text-xs"
          value={a.plannedDate ?? ''}
          aria-label={`שבץ את ${a.name} ליום`}
          onChange={(e) =>
            updateAttraction(a.id, {
              plannedDate: e.target.value || null,
              status: e.target.value && a.status === 'idea' ? 'planned' : a.status,
            })
          }
        >
          <option value="">ללא תאריך</option>
          {days.map((d) => <option key={d} value={d}>{fmt(d)}</option>)}
        </select>
      </div>

      {edit && (
        <div className="mt-2 space-y-2 rounded-xl bg-white p-2.5 dark:bg-neutral-900">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="שם">
              <input className="input" value={a.name}
                     onChange={(e) => updateAttraction(a.id, { name: e.target.value })} />
            </Field>
            <Field label={isRestaurant ? 'סוג מטבח' : 'קטגוריה'}>
              <input className="input" value={a.category ?? ''}
                     onChange={(e) => updateAttraction(a.id, { category: e.target.value || null })} />
            </Field>
            <Field label="מחיר לאדם (₪)">
              <input className="input" inputMode="numeric" value={a.price ?? ''}
                     onChange={(e) => updateAttraction(a.id, { price: parseAmount(e.target.value) })} />
            </Field>
            {!isRestaurant && (
              <Field label="משך (שעות)">
                <input className="input" inputMode="decimal" value={a.durationHours ?? ''}
                       onChange={(e) => updateAttraction(a.id, { durationHours: parseAmount(e.target.value) })} />
              </Field>
            )}
            <Field label="סטטוס">
              <select className="input" value={a.status}
                      onChange={(e) => updateAttraction(a.id, { status: e.target.value as Attraction['status'] })}>
                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="סוג המקום">
              <select className="input" value={a.kind}
                      onChange={(e) => updateAttraction(a.id, { kind: e.target.value as PlaceKind })}>
                <option value="attraction">אטרקציה</option>
                <option value="restaurant">מסעדה</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="הערה">
                <input className="input" value={a.notes ?? ''}
                       onChange={(e) => updateAttraction(a.id, { notes: e.target.value || null })} />
              </Field>
            </div>
          </div>
          <div>
            <span className="label">קישורים שמורים</span>
            <LinkEditor links={a.links ?? []} onChange={(links) => updateAttraction(a.id, { links })} />
          </div>
          <div className="flex justify-end">
            <button onClick={() => confirm(`למחוק את ${a.name}?`) && removeAttraction(a.id)}
                    className="btn !px-2.5 !py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
              <Trash2 size={13} aria-hidden /> מחק
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
