import { dayKey } from '../../shared/time.ts';

/** Dates in the reader's time zone, whatever the browser's zone is. */
export function formatters(tz: string) {
  const make = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ru-RU', { timeZone: tz, ...options });
  const time = make({ hour: '2-digit', minute: '2-digit' });
  const dayMonth = make({ day: 'numeric', month: 'short' });
  const weekdayShort = make({ weekday: 'short' });
  const full = make({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const date = make({ day: 'numeric', month: 'long', year: 'numeric' });
  const clean = (s: string) => s.replace(/\./g, '');

  return {
    time: (ms: number) => time.format(ms),
    day: (ms: number) => clean(dayMonth.format(ms)),
    weekday: (ms: number) => clean(weekdayShort.format(ms)),
    full: (ms: number) => clean(full.format(ms)),
    date: (ms: number) => date.format(ms),
    /** "сегодня в 14:00", "завтра в 10:30", "ср, 15 окт, 18:00". */
    when(ms: number, now = Date.now()) {
      const today = dayKey(now, tz);
      const key = dayKey(ms, tz);
      const tomorrow = dayKey(now + 86_400_000, tz);
      const yesterday = dayKey(now - 86_400_000, tz);
      if (key === today) return `сегодня в ${time.format(ms)}`;
      if (key === tomorrow) return `завтра в ${time.format(ms)}`;
      if (key === yesterday) return `вчера в ${time.format(ms)}`;
      return clean(full.format(ms));
    },
  };
}

export type Formatters = ReturnType<typeof formatters>;

/** "только что", "5 мин назад", "3 ч назад", "2 дн назад". */
export function ago(ms: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'только что';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн назад`;
}

export const money = (value: number | null) => (value === null ? '—' : `${new Intl.NumberFormat('ru-RU').format(value)} ₽`);

export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
