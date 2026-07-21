import { create } from 'zustand';
import type { Trip, Hotel, Transport, Attraction, Expense, Settings } from './types';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface TripStore {
  trip: Trip | null;
  loading: boolean;
  loadError: string | null;
  saveState: SaveState;
  load: () => Promise<void>;
  update: (fn: (draft: Trip) => void) => void;

  updateHotel: (id: string, patch: Partial<Hotel>) => void;
  addHotel: (hotel: Hotel) => void;
  removeHotel: (id: string) => void;
  updateTransport: (id: string, patch: Partial<Transport>) => void;
  addTransport: (t: Transport) => void;
  removeTransport: (id: string) => void;
  updateAttraction: (id: string, patch: Partial<Attraction>) => void;
  addAttraction: (a: Attraction) => void;
  removeAttraction: (id: string) => void;
  addExpense: (e: Expense) => void;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * מקומית הכתיבה היא לדיסק ולכן זולה; בענן כל שמירה נספרת כפעולה ב-Blob.
 * לכן בפרודקשן ממתינים יותר בין הקלדה לשמירה.
 */
const SAVE_DELAY_MS = import.meta.env.PROD ? 3000 : 800;

export const useTrip = create<TripStore>((set, get) => {
  /** שמירה אוטומטית לדיסק, מושהית כדי לא להציף את השרת בכל הקלדה */
  function scheduleSave() {
    set({ saveState: 'dirty' });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const trip = get().trip;
      if (!trip) return;
      set({ saveState: 'saving' });
      try {
        const res = await fetch('/api/trip', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trip),
        });
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        set({ saveState: 'saved' });
        setTimeout(() => {
          if (get().saveState === 'saved') set({ saveState: 'idle' });
        }, 2000);
      } catch (err) {
        console.error('שמירה נכשלה', err);
        set({ saveState: 'error' });
      }
    }, SAVE_DELAY_MS);
  }

  function mutate(fn: (draft: Trip) => void) {
    const current = get().trip;
    if (!current) return;
    const next = structuredClone(current);
    fn(next);
    set({ trip: next });
    scheduleSave();
  }

  const patchIn = <T extends { id: string }>(list: T[], id: string, patch: Partial<T>) => {
    const item = list.find((x) => x.id === id);
    if (item) Object.assign(item, patch);
  };

  return {
    trip: null,
    loading: true,
    loadError: null,
    saveState: 'idle',

    load: async () => {
      set({ loading: true, loadError: null });
      try {
        const res = await fetch('/api/trip');
        if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
        const raw = await res.json();
        // רשומות שנוצרו לפני שהוספנו קישורים שמורים מגיעות בלי השדה
        const trip: Trip = {
          ...raw,
          hotels: (raw.hotels ?? []).map((h: Hotel) => ({ ...h, links: h.links ?? [] })),
          attractions: (raw.attractions ?? []).map((a: Attraction) => ({
            ...a, links: a.links ?? [], kind: a.kind ?? 'attraction',
          })),
        };
        set({ trip, loading: false });
        document.documentElement.classList.toggle('dark', trip.settings.theme === 'dark');
      } catch (err) {
        set({ loadError: String(err), loading: false });
      }
    },

    update: mutate,

    updateHotel: (id, patch) => mutate((t) => patchIn(t.hotels, id, patch)),
    addHotel: (hotel) => mutate((t) => void t.hotels.push(hotel)),
    removeHotel: (id) => mutate((t) => { t.hotels = t.hotels.filter((h) => h.id !== id); }),

    updateTransport: (id, patch) => mutate((t) => patchIn(t.transport, id, patch)),
    addTransport: (x) => mutate((t) => void t.transport.push(x)),
    removeTransport: (id) => mutate((t) => { t.transport = t.transport.filter((x) => x.id !== id); }),

    updateAttraction: (id, patch) => mutate((t) => patchIn(t.attractions, id, patch)),
    addAttraction: (a) => mutate((t) => void t.attractions.push(a)),
    removeAttraction: (id) => mutate((t) => { t.attractions = t.attractions.filter((a) => a.id !== id); }),

    addExpense: (e) => mutate((t) => void t.expenses.push(e)),
    updateExpense: (id, patch) => mutate((t) => patchIn(t.expenses, id, patch)),
    removeExpense: (id) => mutate((t) => { t.expenses = t.expenses.filter((e) => e.id !== id); }),

    updateSettings: (patch) =>
      mutate((t) => {
        Object.assign(t.settings, patch);
        if (patch.theme) document.documentElement.classList.toggle('dark', patch.theme === 'dark');
      }),
  };
});

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
