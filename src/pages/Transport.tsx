import { useState } from 'react';
import {
  Plus, Trash2, ExternalLink, ChevronDown,
  Ship, Waves, Plane, Truck, Car, Bus, TrainFront, Compass,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTrip, newId } from '../store';
import type { Transport, TransportType } from '../types';
import { fmt } from '../lib/dates';
import { ils, parseAmount } from '../lib/money';
import { SectionTitle, Field } from '../components/ui';
import { EmptyFun } from '../components/Encourage';

/** §4 no-emoji-icons — אייקוני SVG במקום אמוג׳י, עקביים בכל המשקלים והפלטפורמות */
const TYPE_META: Record<TransportType, { label: string; Icon: LucideIcon }> = {
  ferry: { label: 'מעבורת', Icon: Ship },
  speedboat: { label: 'ספיד בוט', Icon: Waves },
  flight: { label: 'טיסה', Icon: Plane },
  minivan: { label: 'מיניוואן', Icon: Truck },
  taxi: { label: 'מונית', Icon: Car },
  bus: { label: 'אוטובוס', Icon: Bus },
  train: { label: 'רכבת', Icon: TrainFront },
  other: { label: 'אחר', Icon: Compass },
};

export default function TransportPage() {
  const trip = useTrip((s) => s.trip)!;
  const { addTransport } = useTrip();

  const sorted = [...trip.transport].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  const totalPrice = trip.transport.reduce((s, t) => s + (t.price ?? 0), 0);
  const booked = trip.transport.filter((t) => t.status === 'booked').length;

  const add = () =>
    addTransport({
      id: newId('t'),
      fromDestinationId: null, toDestinationId: null,
      date: null, type: 'other', description: 'מעבר חדש',
      durationMinutes: null, price: null, currency: 'ILS',
      status: 'idea', bookingRef: null, url: null,
    });

  return (
    <div className="space-y-4">
      <SectionTitle action={<button onClick={add} className="btn-primary text-xs"><Plus size={14} /> הוסף מעבר</button>}>
        תחבורה · {booked}/{trip.transport.length} סגורים · {ils(totalPrice)}
      </SectionTitle>

      {sorted.length === 0 ? (
        <div className="card">
          <EmptyFun
            icon={<Compass size={22} />}
            title="עוד לא הוגדרו מעברים"
            hint="הוסף טיסות, מעבורות ומיניוואנים כדי שהם יופיעו בטיימליין ובתקציב"
            action={<button onClick={add} className="btn-primary text-xs"><Plus size={14} /> הוסף מעבר ראשון</button>}
          />
        </div>
      ) : (
        <div className="card divide-y divide-neutral-100 dark:divide-neutral-800">
          {sorted.map((t) => <Row key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}

function Row({ t }: { t: Transport }) {
  const trip = useTrip((s) => s.trip)!;
  const { updateTransport, removeTransport } = useTrip();
  const [open, setOpen] = useState(false);

  const destName = (id: string | null) =>
    id ? trip.destinations.find((d) => d.id === id)?.name ?? id : 'ישראל';

  const meta = TYPE_META[t.type];
  const { Icon } = meta;

  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="btn-icon shrink-0"
          aria-expanded={open}
          aria-label={open ? `סגור פרטי ${meta.label}` : `הצג פרטי ${meta.label}`}
        >
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <Icon size={18} className="shrink-0 text-jungle-600 dark:text-jungle-400" aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ltr text-sm font-semibold">{destName(t.fromDestinationId)}</span>
            <span className="muted" aria-hidden>←</span>
            <span className="ltr text-sm font-semibold">{destName(t.toDestinationId)}</span>
            <span className="chip bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">{meta.label}</span>
          </div>
          <p className="mt-0.5 whitespace-pre-line text-xs muted">{t.description}</p>
        </div>

        {t.date && <span className="shrink-0 text-xs tabular-nums muted">{fmt(t.date)}</span>}
        {t.durationMinutes && (
          <span className="shrink-0 text-xs tabular-nums muted">
            {Math.floor(t.durationMinutes / 60)}ש׳ {t.durationMinutes % 60 ? `${t.durationMinutes % 60}ד׳` : ''}
          </span>
        )}
        <span className="shrink-0 font-bold tabular-nums">{ils(t.price)}</span>

        <div className="flex shrink-0 items-center gap-1">
          {t.url && (
            <a href={t.url} target="_blank" rel="noreferrer" className="btn-icon"
               aria-label={`פתח את דף ההזמנה של ${t.description}`}>
              <ExternalLink size={14} />
            </a>
          )}
          <button
            onClick={() => updateTransport(t.id, { status: t.status === 'booked' ? 'idea' : 'booked' })}
            className={`btn !px-2.5 !py-1.5 text-xs ${
              t.status === 'booked'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'
            }`}
          >
            {t.status === 'booked' ? 'הוזמן' : 'סמן כהוזמן'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950/60 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="תיאור">
            <input className="input" value={t.description}
                   onChange={(e) => updateTransport(t.id, { description: e.target.value })} />
          </Field>
          <Field label="סוג">
            <select className="input" value={t.type}
                    onChange={(e) => updateTransport(t.id, { type: e.target.value as TransportType })}>
              {Object.entries(TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="מ־">
            <select className="input" value={t.fromDestinationId ?? ''}
                    onChange={(e) => updateTransport(t.id, { fromDestinationId: e.target.value || null })}>
              <option value="">ישראל / אחר</option>
              {trip.destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="אל">
            <select className="input" value={t.toDestinationId ?? ''}
                    onChange={(e) => updateTransport(t.id, { toDestinationId: e.target.value || null })}>
              <option value="">ישראל / אחר</option>
              {trip.destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="תאריך">
            <input type="date" className="input" value={t.date ?? ''}
                   onChange={(e) => updateTransport(t.id, { date: e.target.value || null })} />
          </Field>
          <Field label="מחיר (₪, לשני האנשים)">
            <input className="input" inputMode="numeric" value={t.price ?? ''}
                   onChange={(e) => updateTransport(t.id, { price: parseAmount(e.target.value) })} />
          </Field>
          <Field label="משך (דקות)">
            <input className="input" inputMode="numeric" value={t.durationMinutes ?? ''}
                   onChange={(e) => updateTransport(t.id, { durationMinutes: parseAmount(e.target.value) })} />
          </Field>
          <Field label="אסמכתא">
            <input className="input ltr" value={t.bookingRef ?? ''}
                   onChange={(e) => updateTransport(t.id, { bookingRef: e.target.value || null })} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="קישור">
              <input className="input ltr" value={t.url ?? ''} placeholder="https://…"
                     onChange={(e) => updateTransport(t.id, { url: e.target.value || null })} />
            </Field>
          </div>
          <div className="flex items-end justify-end">
            <button
              onClick={() => confirm('למחוק את המעבר?') && removeTransport(t.id)}
              className="btn !px-2.5 !py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 size={13} /> מחק
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
