/**
 * Booking requests, shared by the site, the admin panel and the server.
 * Times are epoch milliseconds; wall-clock dates and times are in the reader's
 * time zone (ADMIN_TZ, Moscow by default).
 */

export const STATUSES = ['new', 'in_progress', 'scheduled', 'done', 'cancelled'] as const;
export type RequestStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  scheduled: 'Назначена',
  done: 'Завершена',
  cancelled: 'Отменена',
};

/** How the client would like to be contacted back. */
export const CONTACT_PREFS = ['call', 'telegram', 'max'] as const;
export type ContactPref = (typeof CONTACT_PREFS)[number];

export const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  call: 'Звонок',
  telegram: 'Telegram',
  max: 'Max',
};

export interface HistoryEntry {
  ts: number;
  status: RequestStatus;
}

export interface BookingRequest {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: RequestStatus;
  name: string;
  /** Normalised to "+7XXXXXXXXXX"-style digits with a leading plus. */
  phone: string;
  contactPref: ContactPref;
  serviceId: string | null;
  /** Service title at the time of the request, kept even if the service is renamed. */
  serviceTitle: string | null;
  question: string;
  /** What the client asked for: a date and time in the reader's time zone. */
  preferredAt: number | null;
  /** Confirmed appointment. */
  scheduledAt: number | null;
  durationMin: number;
  price: number | null;
  paid: boolean;
  /** Private notes, never shown to the client. */
  notes: string;
  /** "site" for the website form, "manual" when added in the panel. */
  source: 'site' | 'manual';
  /** Has the reader opened it in the panel yet. */
  seen: boolean;
  completedAt: number | null;
  history: HistoryEntry[];
}

/** What the website form sends. */
export interface NewRequestPayload {
  name: string;
  phone: string;
  contactPref: ContactPref;
  serviceId: string | null;
  question: string;
  /** "YYYY-MM-DD" and "HH:MM" in the reader's time zone, or empty. */
  date: string;
  time: string;
  /** Honeypot: real visitors never fill it. */
  website?: string;
}

/** Fields the panel may change. */
export type RequestPatch = Partial<
  Pick<
    BookingRequest,
    'status' | 'name' | 'phone' | 'contactPref' | 'serviceId' | 'serviceTitle' | 'question' | 'preferredAt' | 'scheduledAt' | 'durationMin' | 'price' | 'paid' | 'notes' | 'seen'
  >
>;

/** Digits with a leading "+", Russian 8XXXXXXXXXX turned into +7. Empty when it cannot be a phone. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('9')) digits = `7${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : '';
}

/** "+7 900 123-45-67" for Russian numbers, the raw value otherwise. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('7')) return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
  return phone;
}
