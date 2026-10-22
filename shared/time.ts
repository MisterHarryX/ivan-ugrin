/** Wall-clock helpers for a fixed IANA time zone, shared by server, site and panel. */

export interface ZonedParts {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function partsIn(ms: number, tz: string): ZonedParts {
  let format = formatters.get(tz);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    formatters.set(tz, format);
  }
  const parts = format.formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    h: Number(get('hour')),
    min: Number(get('minute')),
    weekday: WEEKDAYS[get('weekday')] ?? 1,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-12" in the zone. */
export function dayKey(ms: number, tz: string) {
  const p = partsIn(ms, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** "14:30" in the zone. */
export function timeKey(ms: number, tz: string) {
  const p = partsIn(ms, tz);
  return `${pad(p.h)}:${pad(p.min)}`;
}

/** Epoch ms for a wall-clock date ("YYYY-MM-DD") and time ("HH:MM") in the zone. */
export function zonedTime(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle the offset even across a DST change.
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = partsIn(guess, tz);
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    guess += wall - shown;
  }
  return guess;
}

/** Midnight in the zone of the day containing `ms`. */
export function startOfDay(ms: number, tz: string) {
  return zonedTime(dayKey(ms, tz), '00:00', tz);
}

/** Adds whole days to a day key. */
export function addDays(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** 1 = Monday … 7 = Sunday, for a day key. */
export function weekdayOf(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function minutesOf(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function timeOfMinutes(total: number) {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
