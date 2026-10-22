import { RANGES, type RangeId, type Row, type Stats, type StoredEvent, type Totals } from '../shared/analytics.js';
import { dayKey, partsIn, startOfDay } from '../shared/time.js';
import { env } from './env.js';
import { readEvents } from './events.js';

/** Statistics for the panel, ported from ICG and cut in the reader's time zone. */

export const isRangeId = (value: unknown): value is RangeId => typeof value === 'string' && Object.hasOwn(RANGES, value);

const DAY = 86_400_000;
const LEADS = new Set(['telegram', 'max', 'b17', 'request']);
const CHANNEL_NAMES: Record<string, string> = { telegram: 'Telegram', max: 'Max или звонок', b17: 'Профиль на B17', request: 'Заявка на сайте' };

/** Sections in page order, for the "how far people read" funnel. */
export const FUNNEL = ['about', 'topics', 'gallery', 'services', 'process', 'try', 'faq', 'booking'];

const SOURCES: [RegExp, string][] = [
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)(yandex\.|ya\.ru$)/, 'Яндекс'],
  [/(^|\.)(t\.me|telegram\.(org|me))$/, 'Telegram'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(vk\.com|vk\.ru|vk\.me)$/, 'ВКонтакте'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
  [/(^|\.)pinterest\./, 'Pinterest'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
];

export const DIRECT = 'Прямые заходы';

function sourceOf(event: StoredEvent) {
  if (event.utm) return event.utm;
  if (!event.ref) return DIRECT;
  return SOURCES.find(([pattern]) => pattern.test(event.ref!))?.[1] ?? event.ref;
}

function countRows(counts: Map<string, number>, limit = 12): Row[] {
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

const bump = (map: Map<string, number>, key: string, by = 1) => map.set(key, (map.get(key) ?? 0) + by);

/** A "visitor" is one anonymous id on one day (ids rotate daily by design). */
const visitorKey = (event: StoredEvent) => `${dayKey(event.ts, env.tz)}|${event.v}`;

function totalsOf(events: StoredEvent[]): Totals {
  const visitors = new Set<string>();
  const converted = new Set<string>();
  const durations = new Map<string, number>();
  let pageviews = 0;
  let channels = 0;
  let requests = 0;

  for (const event of events) {
    const key = visitorKey(event);
    if (event.type === 'pageview') {
      visitors.add(key);
      pageviews += 1;
    } else if (event.type === 'request') {
      requests += 1;
      converted.add(key);
    } else if (LEADS.has(event.type)) {
      channels += 1;
      converted.add(key);
    } else if (event.type === 'engage' && event.dur) bump(durations, key, event.dur);
  }

  const values = [...durations.values()];
  return {
    visitors: visitors.size,
    pageviews,
    channels,
    requests,
    conversion: visitors.size ? Math.min(converted.size / visitors.size, 1) : 0,
    avgDuration: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
  };
}

export async function getStats(range: RangeId, now = Date.now()): Promise<Stats> {
  const tz = env.tz;
  const days = RANGES[range].days;
  const start = startOfDay(startOfDay(now, tz) - (days - 1) * DAY + DAY / 2, tz);
  const previousStart = startOfDay(start - days * DAY + DAY / 2, tz);
  const [events, previousEvents] = await Promise.all([readEvents(start, now + 1), readEvents(previousStart, start)]);

  // Buckets: hours for "today", days otherwise.
  const series: Stats['series'] = [];
  const bucketOf = (ms: number) => (range === 'today' ? String(partsIn(ms, tz).h) : dayKey(ms, tz));
  if (range === 'today') {
    for (let h = 0; h < 24; h++) series.push({ key: String(h), label: `${String(h).padStart(2, '0')}:00`, visitors: 0, pageviews: 0, leads: 0 });
  } else {
    for (let i = 0; i < days; i++) {
      const ms = startOfDay(start + i * DAY + DAY / 2, tz);
      const { d, m } = partsIn(ms, tz);
      series.push({ key: dayKey(ms, tz), label: `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`, visitors: 0, pageviews: 0, leads: 0 });
    }
  }
  const bucketIndex = new Map(series.map((bucket, i) => [bucket.key, i]));
  const bucketVisitors = series.map(() => new Set<string>());

  const firstSeen = new Map<string, StoredEvent>();
  const sectionsSeen = new Map<string, Set<string>>();
  const countries = new Map<string, { visitors: Set<string>; cities: Map<string, Set<string>> }>();
  const channels = new Map<string, number>();

  for (const event of events) {
    const key = visitorKey(event);
    const bucket = bucketIndex.get(bucketOf(event.ts));
    if (event.type === 'pageview') {
      if (!firstSeen.has(key)) firstSeen.set(key, event);
      if (bucket !== undefined) {
        series[bucket].pageviews += 1;
        bucketVisitors[bucket].add(key);
      }
      const code = event.country ?? '';
      const country = countries.get(code) ?? { visitors: new Set(), cities: new Map() };
      country.visitors.add(key);
      const city = event.city ?? '';
      if (!country.cities.has(city)) country.cities.set(city, new Set());
      country.cities.get(city)!.add(key);
      countries.set(code, country);
    } else if (LEADS.has(event.type)) {
      if (bucket !== undefined) series[bucket].leads += 1;
      bump(channels, CHANNEL_NAMES[event.type] ?? event.type);
    } else if (event.type === 'engage' && event.seen) {
      const seen = sectionsSeen.get(key) ?? new Set<string>();
      event.seen.forEach((id) => seen.add(id));
      sectionsSeen.set(key, seen);
    }
  }
  bucketVisitors.forEach((set, i) => (series[i].visitors = set.size));

  const os = new Map<string, number>();
  const devices = new Map<string, number>();
  const browsers = new Map<string, number>();
  const sources = new Map<string, number>();
  for (const event of firstSeen.values()) {
    bump(os, event.os);
    bump(devices, event.device);
    bump(browsers, event.browser);
    bump(sources, sourceOf(event));
  }

  const recent = events
    .filter((event) => event.type === 'pageview' || LEADS.has(event.type))
    .slice(-30)
    .reverse()
    .map((event) => ({
      ts: event.ts,
      type: event.type,
      country: event.country,
      city: event.city,
      os: event.os,
      device: event.device,
      browser: event.browser,
      place: event.place,
      // Clicks carry no referrer; show where that visitor originally came from.
      source: sourceOf(firstSeen.get(visitorKey(event)) ?? event),
    }));

  return {
    range,
    from: start,
    to: now,
    totals: totalsOf(events),
    previous: totalsOf(previousEvents),
    series,
    countries: [...countries.entries()]
      .map(([code, { visitors, cities }]) => ({
        code,
        value: visitors.size,
        cities: [...cities.entries()].map(([name, set]) => ({ name, value: set.size })).sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => b.value - a.value),
    os: countRows(os),
    devices: (['desktop', 'mobile', 'tablet'] as const).map((name) => ({ name, value: devices.get(name) ?? 0 })),
    browsers: countRows(browsers, 8),
    sources: countRows(sources, 10),
    channels: countRows(channels),
    funnel: FUNNEL.map((id) => ({ id, value: [...sectionsSeen.values()].filter((seen) => seen.has(id)).length })),
    funnelBase: sectionsSeen.size,
    recent,
    hasData: events.length > 0,
  };
}

/** Visitors active in the last 5 minutes. */
export async function getLiveCount(now = Date.now()) {
  const events = await readEvents(now - 5 * 60_000, now + 1);
  return new Set(events.filter((event) => event.type === 'pageview' || event.type === 'engage').map((event) => event.v)).size;
}
