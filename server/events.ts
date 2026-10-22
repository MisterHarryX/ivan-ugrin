import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { DeviceType, StoredEvent } from '../shared/analytics.js';
import { env } from './env.js';
import { appendLine, backend, dataPath, redis, redisPipeline } from './store.js';

/** Analytics events, one list per UTC day (as in ICG). */
const DAY_MS = 86_400_000;
/** Redis keeps each day's list for ~13 months. */
const RETENTION_SECONDS = 400 * 86_400;
const dayKeyRedis = (day: string) => `ugrin:events:${day}`;
const eventsFile = (day: string) => dataPath('events', `${day}.ndjson`);
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// --- Anonymous visitor id ------------------------------------------------------

let salt: Promise<string> | null = null;

/** Random per-installation salt, created on first use. */
function getSalt() {
  salt ??= (async () => {
    const fresh = randomBytes(24).toString('hex');
    const b = backend();
    if (b === 'redis') {
      await redis(['SET', 'ugrin:salt', fresh, 'NX']);
      return (await redis<string>(['GET', 'ugrin:salt'])) ?? fresh;
    }
    if (b === 'none') return env.adminSecret || fresh;
    const file = dataPath('salt');
    try {
      return (await fs.readFile(file, 'utf8')).trim();
    } catch {
      await fs.mkdir(dataPath(), { recursive: true });
      await fs.writeFile(file, fresh, 'utf8');
      return fresh;
    }
  })().catch((cause) => {
    salt = null;
    throw cause;
  });
  return salt;
}

/**
 * Same person, same day → same id; tomorrow it changes. Built from salt + IP + user
 * agent and hashed, so neither the IP nor any cookie is ever stored.
 */
export async function visitorId(ip: string, userAgent: string, now = Date.now()) {
  const hash = createHash('sha256').update(`${await getSalt()}|${utcDay(now)}|${ip}|${userAgent}`).digest('base64url');
  return hash.slice(0, 16);
}

// --- Device from the User-Agent --------------------------------------------------

export function deviceInfo(ua: string, touchPoints = 0): { os: string; device: DeviceType; browser: string; isBot: boolean } {
  let os = /Windows/i.test(ua)
    ? 'Windows'
    : /iPhone|iPod/i.test(ua)
      ? 'iOS'
      : /iPad/i.test(ua)
        ? 'iPadOS'
        : /Android/i.test(ua)
          ? 'Android'
          : /CrOS/i.test(ua)
            ? 'ChromeOS'
            : /Mac OS X|Macintosh/i.test(ua)
              ? 'macOS'
              : /Linux/i.test(ua)
                ? 'Linux'
                : 'Другое';
  let device: DeviceType = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'tablet' : /Mobi|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop';
  // iPadOS 13+ reports itself as a Mac; a Mac has no touch screen.
  if (os === 'macOS' && touchPoints > 1) {
    os = 'iPadOS';
    device = 'tablet';
  }
  const browser = /YaBrowser|Yowser/i.test(ua)
    ? 'Яндекс Браузер'
    : /Edg\//i.test(ua)
      ? 'Edge'
      : /OPR\/|Opera/i.test(ua)
        ? 'Opera'
        : /SamsungBrowser/i.test(ua)
          ? 'Samsung'
          : /Firefox|FxiOS/i.test(ua)
            ? 'Firefox'
            : /Chrome|CriOS/i.test(ua)
              ? 'Chrome'
              : /Safari/i.test(ua)
                ? 'Safari'
                : 'Другой';
  const isBot = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|monitor|curl|wget|python/i.test(ua) || ua.length < 20;
  return { os, device, browser, isBot };
}

/** Hosting platforms that geolocate for free put the result in request headers. */
export function geoFromHeaders(request: Request): { country?: string; city?: string } {
  const h = request.headers;
  const decode = (value: string | null) => {
    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const vercel = h.get('x-vercel-ip-country');
  if (vercel) return { country: vercel, city: decode(h.get('x-vercel-ip-city')) };
  const cf = h.get('cf-ipcountry');
  if (cf && cf !== 'XX' && cf !== 'T1') return { country: cf, city: decode(h.get('cf-ipcity')) };
  return {};
}

// --- Write / read ---------------------------------------------------------------

export const analyticsEnabled = () => backend() !== 'none';

export async function recordEvent(event: StoredEvent) {
  const day = utcDay(event.ts);
  const line = JSON.stringify(event);
  const b = backend();
  if (b === 'redis') {
    await redisPipeline([
      ['RPUSH', dayKeyRedis(day), line],
      ['EXPIRE', dayKeyRedis(day), RETENTION_SECONDS],
    ]);
  } else if (b === 'files') {
    await appendLine(eventsFile(day), line);
  }
}

function parseLines(lines: string[]) {
  const events: StoredEvent[] = [];
  for (const line of lines) {
    if (!line) continue;
    try {
      events.push(JSON.parse(line) as StoredEvent);
    } catch {
      // Skip a torn line rather than failing the whole dashboard.
    }
  }
  return events;
}

/** Finished days never change, so their parsed events are kept in memory. */
const dayCache = new Map<string, StoredEvent[]>();

/** Files: one ndjson file per day. */
async function readDay(day: string, today: string): Promise<StoredEvent[]> {
  if (day < today && dayCache.has(day)) return dayCache.get(day)!;
  let events: StoredEvent[] = [];
  try {
    events = parseLines((await fs.readFile(eventsFile(day), 'utf8')).split('\n'));
  } catch {
    events = [];
  }
  if (day < today) dayCache.set(day, events);
  return events;
}

/** Redis: every day not cached yet in one pipelined round trip. */
async function readRedisDays(days: string[], today: string) {
  const missing = days.filter((day) => day >= today || !dayCache.has(day));
  const results = await redisPipeline<string[] | null>(missing.map((day) => ['LRANGE', dayKeyRedis(day), 0, -1]));
  const fresh = new Map<string, StoredEvent[]>();
  missing.forEach((day, i) => {
    const events = parseLines(results[i] ?? []);
    fresh.set(day, events);
    if (day < today) dayCache.set(day, events);
  });
  return days.flatMap((day) => fresh.get(day) ?? dayCache.get(day) ?? []);
}

/** Events with from <= ts < to. */
export async function readEvents(from: number, to: number) {
  if (!analyticsEnabled()) return [];
  const set = new Set<string>();
  for (let t = from - DAY_MS; t < to + DAY_MS; t += DAY_MS) set.add(utcDay(t));
  const days = [...set];
  const today = utcDay(Date.now());
  const all =
    backend() === 'redis' ? await readRedisDays(days, today) : (await Promise.all(days.map((day) => readDay(day, today)))).flat();
  return all.filter((event) => event.ts >= from && event.ts < to);
}
