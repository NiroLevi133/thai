import * as XLSX from 'xlsx';
import type { Trip } from '../types';
import { fmt, toDate, addDays } from './dates';
import { gapsByDestination } from './gaps';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** ייצוא לאקסל בשני גיליונות, בפורמט שתואם לקובץ המקורי */
export function exportExcel(trip: Trip) {
  const destName = (id: string) => trip.destinations.find((d) => d.id === id)?.name ?? id;
  const stars = (n: number | null) =>
    n === null ? '' : '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '');

  const booked = trip.hotels
    .filter((h) => h.status === 'booked')
    .sort((a, b) => (a.checkIn ?? '').localeCompare(b.checkIn ?? ''))
    .map((h) => ({
      'יעד': destName(h.destinationId),
      'מלון': h.name,
      'דירוג כוכבים': stars(h.stars),
      'צ׳ק-אין': fmt(h.checkIn),
      'צ׳ק-אאוט': fmt(h.checkOut),
      'מס׳ לילות': h.nights,
      'מחיר ללילה': h.pricePerNight,
      'מחיר כולל': h.totalPrice,
      'הוזמן דרך': h.bookedVia,
      'מספר הזמנה': h.confirmationNumber,
      'ביטול חינם עד': fmt(h.freeCancelUntil),
      'שולם': h.paid ? 'כן' : 'לא',
      'הערה': h.notes,
      'קישור': h.url,
    }));

  const itinerary: Record<string, unknown>[] = [];
  for (const g of gapsByDestination(trip)) {
    const d = g.destination;
    const hotels = trip.hotels.filter((h) => h.destinationId === d.id && h.status !== 'rejected');
    const transfer = trip.transport.find((t) => t.fromDestinationId === d.id);
    if (!hotels.length) {
      itinerary.push({
        'יעד': d.name, 'לילות': d.nights,
        'תאריכים': `${fmt(d.startDate)} – ${fmt(d.endDate)}`,
        'מעבר ליעד הבא': transfer?.description ?? '',
        'איפה כדאי לישון': d.whereToSleep ?? '',
        'מלון': '', 'סטטוס': '', 'מחיר': '', 'אזור': '', 'קישור': '',
        'לילות פתוחים': g.openNights.length,
      });
      continue;
    }
    hotels.forEach((h, i) => {
      itinerary.push({
        'יעד': i === 0 ? d.name : '',
        'לילות': i === 0 ? d.nights : '',
        'תאריכים': i === 0 ? `${fmt(d.startDate)} – ${fmt(d.endDate)}` : '',
        'מעבר ליעד הבא': i === 0 ? transfer?.description ?? '' : '',
        'איפה כדאי לישון': i === 0 ? d.whereToSleep ?? '' : '',
        'מלון': `${h.name} ${stars(h.stars)}`.trim(),
        'סטטוס': h.status === 'booked' ? 'שוריין' : 'מועמד',
        'מחיר': h.totalPrice,
        'אזור': h.area === 'central' ? 'מרכזי' : 'מרוחק',
        'קישור': h.url ?? '',
        'לילות פתוחים': i === 0 ? g.openNights.length : '',
      });
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(booked), 'מלונות שהוזמנו');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itinerary), 'מסלול');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(new Blob([out]), `תאילנד-גיבוי-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ---------- ICS ----------

const stamp = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/** תווים בעלי משמעות ב-ICS חייבים escaping, אחרת היומן דוחה את הקובץ */
const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

function vevent(uid: string, start: Date, end: Date, summary: string, description: string) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@thai-planner.local`,
    `DTSTAMP:${stamp(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${stamp(start)}`,
    `DTEND;VALUE=DATE:${stamp(end)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    'END:VEVENT',
  ].join('\r\n');
}

export function exportIcs(trip: Trip) {
  const destName = (id: string) => trip.destinations.find((d) => d.id === id)?.name ?? id;
  const events: string[] = [];

  for (const h of trip.hotels) {
    if (h.status !== 'booked') continue;
    const dest = destName(h.destinationId);
    const meta = [
      h.bookedVia ? `הוזמן דרך: ${h.bookedVia}` : '',
      h.confirmationNumber ? `מספר הזמנה: ${h.confirmationNumber}` : '',
      h.totalPrice ? `מחיר: ${h.totalPrice} ₪` : '',
      h.url ?? '',
    ].filter(Boolean).join('\n');

    const ci = toDate(h.checkIn);
    const co = toDate(h.checkOut);
    if (ci) events.push(vevent(`ci-${h.id}`, ci, addDays(ci, 1), `🏨 צ׳ק-אין: ${h.name} (${dest})`, meta));
    if (co) events.push(vevent(`co-${h.id}`, co, addDays(co, 1), `🧳 צ׳ק-אאוט: ${h.name} (${dest})`, meta));

    const fc = toDate(h.freeCancelUntil);
    if (fc) {
      events.push(vevent(
        `fc-${h.id}`, fc, addDays(fc, 1),
        `⚠️ יום אחרון לביטול חינם — ${h.name}`,
        `${dest}\n${meta}`,
      ));
    }
  }

  for (const t of trip.transport) {
    const d = toDate(t.date);
    if (!d) continue;
    events.push(vevent(`tr-${t.id}`, d, addDays(d, 1), `🚐 ${t.description.split('\n')[0]}`,
      t.bookingRef ? `אסמכתא: ${t.bookingRef}` : ''));
  }

  for (const a of trip.attractions) {
    const d = toDate(a.plannedDate);
    if (!d) continue;
    events.push(vevent(`at-${a.id}`, d, addDays(d, 1), `🎟️ ${a.name}`, destName(a.destinationId)));
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Thailand Trip Planner//HE',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  download(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'תאילנד.ics');
}

export function exportJson(trip: Trip) {
  download(
    new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' }),
    `trip-${new Date().toISOString().slice(0, 10)}.json`,
  );
}
