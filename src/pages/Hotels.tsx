import { useMemo, useState } from 'react';
import {
  ExternalLink, Check, X, Undo2, Plus, Trash2, TriangleAlert, ChevronDown, CalendarX2,
  BedDouble, PartyPopper,
} from 'lucide-react';
import { useTrip, newId } from '../store';
import type { Hotel, HotelStatus } from '../types';
import { gapsByDestination } from '../lib/gaps';
import { fmt, daysUntil } from '../lib/dates';
import { ils, parseAmount } from '../lib/money';
import { SectionTitle, Stars, Field } from '../components/ui';
import { EmptyFun } from '../components/Encourage';
import LinkEditor, { LinkChipList } from '../components/LinkChips';

type Tab = HotelStatus;

const TAB_LABELS: Record<Tab, string> = { booked: 'סגורים', candidate: 'מועמדים', rejected: 'נפסלו' };

export default function Hotels() {
  const trip = useTrip((s) => s.trip)!;
  const [tab, setTab] = useState<Tab>('booked');
  const [openDest, setOpenDest] = useState<string | null>(null);
  const gaps = useMemo(() => gapsByDestination(trip), [trip]);

  const counts = {
    booked: trip.hotels.filter((h) => h.status === 'booked').length,
    candidate: trip.hotels.filter((h) => h.status === 'candidate').length,
    rejected: trip.hotels.filter((h) => h.status === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        action={
          <div className="flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
            {(Object.keys(TAB_LABELS) as Tab[]).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  tab === k ? 'bg-white shadow-sm dark:bg-neutral-950' : 'text-neutral-500'
                }`}
              >
                {TAB_LABELS[k]} ({counts[k]})
              </button>
            ))}
          </div>
        }
      >
        מלונות
      </SectionTitle>

      {gaps.map((g) => {
        const d = g.destination;
        const list = trip.hotels
          .filter((h) => h.destinationId === d.id && h.status === tab)
          .sort((a, b) => (a.checkIn ?? '').localeCompare(b.checkIn ?? '') || (a.totalPrice ?? 1e9) - (b.totalPrice ?? 1e9));

        if (!list.length && tab !== 'booked') return null;

        return (
          <div key={d.id} className="card overflow-hidden">
            <div
              className="flex items-center gap-3 p-3"
              style={{ borderInlineStartWidth: 5, borderInlineStartColor: d.color, borderInlineStartStyle: 'solid' }}
            >
              <h3 className="ltr font-bold">{d.name}</h3>
              <span className="text-xs muted">
                {fmt(d.startDate)}–{fmt(d.endDate)} · {d.nights} לילות
              </span>
              {g.openNights.length > 0 ? (
                <span className="chip bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                  <CalendarX2 size={11} /> {g.openNights.length} לילות פתוחים
                </span>
              ) : (
                <span className="chip bg-jungle-600/10 text-jungle-700 dark:bg-jungle-400/15 dark:text-jungle-400">
                  <PartyPopper size={11} /> יעד סגור
                </span>
              )}
              <button
                onClick={() => setOpenDest(openDest === d.id ? null : d.id)}
                className="btn-ghost ms-auto !px-2 !py-1 text-xs"
              >
                <Plus size={13} /> מלון
              </button>
            </div>

            {g.openRanges.length > 0 && tab === 'booked' && (
              <div className="border-t border-neutral-100 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-neutral-800 dark:bg-red-950/20 dark:text-red-300">
                חסר מלון: {g.openRanges.map((r) => `${fmt(r.from)} → ${fmt(r.checkout)} (${r.count} לילות)`).join(' · ')}
              </div>
            )}

            {openDest === d.id && (
              <NewHotelForm
                destinationId={d.id}
                defaultCheckIn={g.openRanges[0]?.from ?? d.startDate ?? ''}
                defaultCheckOut={g.openRanges[0]?.checkout ?? d.endDate ?? ''}
                onDone={() => setOpenDest(null)}
              />
            )}

            {list.length === 0 ? (
              <div className="border-t border-sand-100 dark:border-neutral-800">
                <EmptyFun
                  icon={<BedDouble size={22} />}
                  title={tab === 'booked' ? `עוד לא סגרת מלון ב-${d.name}` : 'אין כאן מלונות'}
                  hint={tab === 'booked'
                    ? 'עבור ללשונית "מועמדים" ולחץ "סגרתי" על המלון שבחרת, או הוסף מלון חדש'
                    : 'אפשר להוסיף מועמד חדש עם הכפתור למעלה'}
                />
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
                {list.map((h) => <HotelRow key={h.id} hotel={h} destStart={d.startDate} destEnd={d.endDate} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HotelRow({ hotel: h, destStart, destEnd }: { hotel: Hotel; destStart: string | null; destEnd: string | null }) {
  const { updateHotel, removeHotel } = useTrip();
  const [expanded, setExpanded] = useState(false);
  const cancelDays = daysUntil(h.freeCancelUntil);

  const cancelTone =
    cancelDays === null ? '' :
    cancelDays < 0 ? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800' :
    cancelDays <= 7 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
    cancelDays <= 21 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
    'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300';

  /** סגירת מלון מועמד — ממלאת אוטומטית את טווח התאריכים של היעד */
  const markBooked = () => {
    const checkIn = h.checkIn ?? destStart;
    const checkOut = h.checkOut ?? destEnd;
    const nights = checkIn && checkOut
      ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
      : null;
    updateHotel(h.id, {
      status: 'booked',
      checkIn,
      checkOut,
      nights,
      pricePerNight: h.pricePerNight ?? (h.totalPrice && nights ? Math.round(h.totalPrice / nights) : null),
    });
    setExpanded(true);
  };

  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn-icon shrink-0"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'סגור' : 'ערוך'} את ${h.name}`}
        >
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ltr font-medium">{h.name}</span>
            <Stars n={h.stars} />
            <span className="chip bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {h.area === 'central' ? 'מרכזי' : 'מרוחק'}
            </span>
            {h.freeCancelConflict && (
              <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    title={`גיליון ההזמנות: ${fmt(h.freeCancelUntil)} · ההערה במסלול: ${fmt(h.freeCancelConflict)}`}>
                <TriangleAlert size={11} /> סתירה בתאריך ביטול
              </span>
            )}
          </div>
          {h.status === 'booked' && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs muted">
              <span className="tabular-nums">{fmt(h.checkIn)} – {fmt(h.checkOut)} · {h.nights} לילות</span>
              {h.bookedVia && <span>{h.bookedVia}</span>}
              {h.confirmationNumber && <span className="ltr tabular-nums">#{h.confirmationNumber}</span>}
            </div>
          )}
          {h.notes && <p className="mt-0.5 text-xs muted">{h.notes}</p>}
          {h.links?.length > 0 && <div className="mt-1"><LinkChipList links={h.links} /></div>}
        </div>

        {h.freeCancelUntil && (
          <span className={`chip shrink-0 tabular-nums ${cancelTone}`}>
            {cancelDays !== null && cancelDays >= 0 ? `ביטול חינם: ${cancelDays} ימים` : 'חלון הביטול נסגר'}
          </span>
        )}

        <div className="shrink-0 text-end">
          <div className="font-bold tabular-nums">{ils(h.totalPrice)}</div>
          {h.pricePerNight && <div className="text-xs muted">{ils(h.pricePerNight)}/לילה</div>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {h.url && (
            <a href={h.url} target="_blank" rel="noreferrer" className="btn-icon"
               aria-label={`פתח את דף ההזמנה של ${h.name}`}>
              <ExternalLink size={14} />
            </a>
          )}
          {h.status === 'booked' ? (
            <button
              onClick={() => updateHotel(h.id, { paid: !h.paid, paidAmount: !h.paid ? h.totalPrice : null })}
              className={`btn !px-2.5 !py-1.5 text-xs ${
                h.paid
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'
              }`}
            >
              <Check size={13} /> {h.paid ? 'שולם' : 'סמן כשולם'}
            </button>
          ) : h.status === 'candidate' ? (
            <>
              <button onClick={markBooked} className="btn-primary !px-2.5 !py-1.5 text-xs">
                <Check size={13} /> סגרתי
              </button>
              <button
                onClick={() => updateHotel(h.id, { status: 'rejected' })}
                className="btn-icon" aria-label={`פסול את ${h.name}`}
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <button onClick={() => updateHotel(h.id, { status: 'candidate' })} className="btn-icon"
                    aria-label={`החזר את ${h.name} למועמדים`}>
              <Undo2 size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950/60 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="צ׳ק-אין">
            <input type="date" className="input" value={h.checkIn ?? ''}
                   onChange={(e) => updateHotel(h.id, { checkIn: e.target.value || null })} />
          </Field>
          <Field label="צ׳ק-אאוט">
            <input type="date" className="input" value={h.checkOut ?? ''}
                   onChange={(e) => updateHotel(h.id, { checkOut: e.target.value || null })} />
          </Field>
          <Field label="ביטול חינם עד">
            <input type="date" className="input" value={h.freeCancelUntil ?? ''}
                   onChange={(e) => updateHotel(h.id, { freeCancelUntil: e.target.value || null, freeCancelConflict: null })} />
          </Field>
          <Field label="מחיר כולל (₪)">
            <input type="number" className="input" value={h.totalPrice ?? ''}
                   onChange={(e) => updateHotel(h.id, { totalPrice: parseAmount(e.target.value) })} />
          </Field>
          <Field label="הוזמן דרך">
            <input className="input" value={h.bookedVia ?? ''} placeholder="Agoda / Booking"
                   onChange={(e) => updateHotel(h.id, { bookedVia: e.target.value || null })} />
          </Field>
          <Field label="מספר הזמנה">
            <input className="input ltr" value={h.confirmationNumber ?? ''}
                   onChange={(e) => updateHotel(h.id, { confirmationNumber: e.target.value || null })} />
          </Field>
          <Field label="קישור">
            <input className="input ltr" value={h.url ?? ''} placeholder="https://…"
                   onChange={(e) => updateHotel(h.id, { url: e.target.value || null })} />
          </Field>
          <Field label="הערה">
            <input className="input" value={h.notes ?? ''}
                   onChange={(e) => updateHotel(h.id, { notes: e.target.value || null })} />
          </Field>

          <div className="sm:col-span-2 lg:col-span-4">
            <span className="label">קישורים שמורים (טיקטוק, אינסטגרם, מפות…)</span>
            <LinkEditor links={h.links ?? []} onChange={(links) => updateHotel(h.id, { links })} />
          </div>

          {h.freeCancelConflict && (
            <div className="sm:col-span-2 lg:col-span-4 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <b>סתירה באקסל:</b> גיליון ההזמנות אמר {fmt(h.freeCancelUntil)}, ההערה במסלול אמרה {fmt(h.freeCancelConflict)}.
              בדוק באתר ההזמנה — עדכון התאריך למעלה יסיר את האזהרה.
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button
              onClick={() => confirm(`למחוק את ${h.name}?`) && removeHotel(h.id)}
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

function NewHotelForm({
  destinationId, defaultCheckIn, defaultCheckOut, onDone,
}: {
  destinationId: string; defaultCheckIn: string; defaultCheckOut: string; onDone: () => void;
}) {
  const addHotel = useTrip((s) => s.addHotel);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    addHotel({
      id: newId('h'),
      destinationId,
      name: name.trim(),
      stars: null,
      area: 'central',
      status: 'candidate',
      checkIn: defaultCheckIn || null,
      checkOut: defaultCheckOut || null,
      nights: null,
      pricePerNight: null,
      totalPrice: parseAmount(price),
      currency: 'ILS',
      bookedVia: null,
      confirmationNumber: null,
      freeCancelUntil: null,
      freeCancelConflict: null,
      paid: false,
      paidAmount: null,
      url: url.trim() || null,
      links: [],
      notes: null,
    });
    onDone();
  };

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/60">
      <div className="min-w-[12rem] flex-1">
        <Field label="שם המלון">
          <input className="input ltr" value={name} autoFocus
                 onChange={(e) => setName(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </Field>
      </div>
      <div className="w-28">
        <Field label="מחיר כולל">
          <input className="input" value={price} inputMode="numeric"
                 onChange={(e) => setPrice(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </Field>
      </div>
      <div className="min-w-[12rem] flex-1">
        <Field label="קישור">
          <input className="input ltr" value={url} placeholder="https://…"
                 onChange={(e) => setUrl(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </Field>
      </div>
      <button onClick={submit} className="btn-primary">הוסף</button>
      <button onClick={onDone} className="btn-ghost">ביטול</button>
    </div>
  );
}
