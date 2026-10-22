import { addDays, minutesOf, timeOfMinutes, weekdayOf, zonedTime, dayKey } from './time.js';

/** Working hours the reader sets in the panel; the site offers slots inside them. */
export interface WorkHours {
  /** 1 = Monday … 7 = Sunday. */
  days: number[];
  start: string;
  end: string;
  /** Step between offered start times. */
  slotMinutes: number;
  /** How many days ahead the site offers. */
  horizonDays: number;
  /** Earliest bookable time from now, so nobody books "in ten minutes". */
  leadHours: number;
}

export const DEFAULT_WORK_HOURS: WorkHours = {
  days: [1, 2, 3, 4, 5, 6],
  start: '10:00',
  end: '21:00',
  slotMinutes: 60,
  horizonDays: 14,
  leadHours: 3,
};

export interface Busy {
  start: number;
  end: number;
}

/** What the public availability endpoint returns. No personal data. */
export interface Availability {
  tz: string;
  hours: WorkHours;
  busy: Busy[];
  /** Server clock, so slots are cut against the same "now" everywhere. */
  now: number;
}

export interface Slot {
  time: string;
  at: number;
  free: boolean;
}

/** Days the site offers, starting today, skipping days off. */
export function bookableDays(hours: WorkHours, now: number, tz: string): string[] {
  const today = dayKey(now, tz);
  const days: string[] = [];
  for (let i = 0; i < hours.horizonDays; i++) {
    const key = addDays(today, i);
    if (hours.days.includes(weekdayOf(key))) days.push(key);
  }
  return days;
}

/** Start times for one day; a slot is taken when the session would overlap a busy one. */
export function slotsFor(date: string, durationMin: number, a: Availability): Slot[] {
  const { hours, busy, now, tz } = a;
  const from = minutesOf(hours.start);
  const to = minutesOf(hours.end);
  const earliest = now + hours.leadHours * 3_600_000;
  const slots: Slot[] = [];
  for (let t = from; t + Math.min(durationMin, hours.slotMinutes) <= to; t += hours.slotMinutes) {
    const time = timeOfMinutes(t);
    const at = zonedTime(date, time, tz);
    const end = at + durationMin * 60_000;
    const clash = busy.some((b) => at < b.end && end > b.start);
    slots.push({ time, at, free: at >= earliest && !clash });
  }
  return slots;
}
