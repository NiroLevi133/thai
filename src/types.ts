export type HotelStatus = 'booked' | 'candidate' | 'rejected';

/** קישור שמור — טיקטוק/אינסטגרם/פייסבוק/מפות או כל מקור אחר */
export interface SavedLink {
  id: string;
  url: string;
  /** כותרת חופשית, למשל "הסרטון של דנה" */
  label: string | null;
}
export type Currency = 'ILS' | 'THB';

export interface Destination {
  id: string;
  name: string;
  order: number;
  startDate: string | null;
  endDate: string | null;
  nights: number | null;
  /** מספר הלילות שהופיע באקסל כשהוא סותר את טווח התאריכים */
  nightsConflict: number | null;
  color: string;
  whereToSleep: string | null;
}

export interface Hotel {
  id: string;
  destinationId: string;
  name: string;
  stars: number | null;
  area: 'central' | 'remote';
  status: HotelStatus;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  pricePerNight: number | null;
  totalPrice: number | null;
  currency: Currency;
  bookedVia: string | null;
  confirmationNumber: string | null;
  freeCancelUntil: string | null;
  /** תאריך ביטול חלופי שנמצא באקסל וסותר את הראשי */
  freeCancelConflict: string | null;
  paid: boolean;
  paidAmount: number | null;
  url: string | null;
  /** קישורים שמורים מרשתות חברתיות ומקורות אחרים */
  links: SavedLink[];
  notes: string | null;
}

export type TransportType =
  | 'ferry' | 'flight' | 'minivan' | 'taxi' | 'bus' | 'train' | 'speedboat' | 'other';

export interface Transport {
  id: string;
  fromDestinationId: string | null;
  toDestinationId: string | null;
  date: string | null;
  type: TransportType;
  description: string;
  durationMinutes: number | null;
  price: number | null;
  currency: Currency;
  status: 'idea' | 'booked';
  bookingRef: string | null;
  url: string | null;
}

/** מקום בעמוד "מקומות" — אטרקציה או מסעדה (מלונות מנוהלים בנפרד) */
export type PlaceKind = 'attraction' | 'restaurant';

export interface Attraction {
  id: string;
  destinationId: string;
  kind: PlaceKind;
  name: string;
  category: string | null;
  price: number | null;
  currency: Currency;
  durationHours: number | null;
  plannedDate: string | null;
  status: 'idea' | 'planned' | 'booked' | 'done';
  url: string | null;
  /** קישורים שמורים מרשתות חברתיות ומקורות אחרים */
  links: SavedLink[];
  notes: string | null;
}

export type ExpenseCategory =
  | 'food' | 'shopping' | 'insurance' | 'visa' | 'gear' | 'other';

export interface Expense {
  id: string;
  date: string | null;
  destinationId: string | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: Currency;
  paid: boolean;
}

export interface Settings {
  travelers: number;
  thbToIls: number;
  budgetTarget: number | null;
  dailyFoodBudget: number | null;
  theme: 'light' | 'dark';
}

export interface Trip {
  name: string;
  /** תחילת המסלול בתאילנד (הצ׳ק-אין הראשון) */
  startDate: string;
  /** סוף המסלול בתאילנד (הצ׳ק-אאוט האחרון) */
  endDate: string;
  /** תאריך הטיסה מישראל — מוקדם ב-יום מ-startDate בטיסת לילה */
  departureDate: string;
  /** תאריך הנחיתה חזרה בישראל */
  returnDate: string;
  destinations: Destination[];
  hotels: Hotel[];
  transport: Transport[];
  attractions: Attraction[];
  expenses: Expense[];
  settings: Settings;
}
