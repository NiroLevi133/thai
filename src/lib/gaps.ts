import type { Trip, Destination } from '../types';
import { nightsBetween, groupConsecutive, checkoutOf } from './dates';

export interface NightCoverage {
  night: string;       // תאריך הלילה (יום הכניסה אליו)
  hotelId: string | null;
  hotelName: string | null;
}

export interface DestinationGaps {
  destination: Destination;
  nights: NightCoverage[];
  openNights: string[];
  /** טווחים רציפים של לילות פתוחים, עם תאריך צ׳ק-אאוט מחושב */
  openRanges: { from: string; checkout: string; count: number }[];
  coveredCount: number;
}

/** מיפוי לילה → מלון סגור שמכסה אותו */
export function coverageMap(trip: Trip): Map<string, { id: string; name: string }> {
  const map = new Map<string, { id: string; name: string }>();
  for (const h of trip.hotels) {
    if (h.status !== 'booked') continue;
    for (const n of nightsBetween(h.checkIn, h.checkOut)) {
      map.set(n, { id: h.id, name: h.name });
    }
  }
  return map;
}

export function gapsByDestination(trip: Trip): DestinationGaps[] {
  const covered = coverageMap(trip);

  return [...trip.destinations]
    .sort((a, b) => a.order - b.order)
    .map((destination) => {
      const nights = nightsBetween(destination.startDate, destination.endDate).map((night) => {
        const hit = covered.get(night);
        return { night, hotelId: hit?.id ?? null, hotelName: hit?.name ?? null };
      });
      const openNights = nights.filter((n) => !n.hotelId).map((n) => n.night);
      return {
        destination,
        nights,
        openNights,
        openRanges: groupConsecutive(openNights).map((r) => ({
          from: r.from,
          checkout: checkoutOf(r.to),
          count: r.count,
        })),
        coveredCount: nights.length - openNights.length,
      };
    });
}

export interface TripTotals {
  plannedNights: number;
  coveredNights: number;
  openNights: number;
}

export function tripNightTotals(trip: Trip): TripTotals {
  const gaps = gapsByDestination(trip);
  const planned = gaps.reduce((s, g) => s + g.nights.length, 0);
  const open = gaps.reduce((s, g) => s + g.openNights.length, 0);
  return { plannedNights: planned, coveredNights: planned - open, openNights: open };
}
