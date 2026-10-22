import { TRACKED_EVENTS, type StoredEvent, type TrackPayload } from '../shared/analytics.js';
import {
  CONTACT_PREFS,
  STATUSES,
  normalizePhone,
  type BookingRequest,
  type ContactPref,
  type NewRequestPayload,
  type RequestPatch,
} from '../shared/booking.js';
import { isEditable, type ContentOverrides, type Insert } from '../shared/content.js';
import { DEFAULT_WORK_HOURS, type Availability, type WorkHours } from '../shared/schedule.js';
import { zonedTime } from '../shared/time.js';
import {
  SESSION_COOKIE,
  UI_COOKIE,
  checkPassword,
  clearLoginAttempts,
  createSessionToken,
  isAdminRequest,
  loginBlocked,
  noteFailedLogin,
} from './auth.js';
import { getOverrides, saveOverrides } from './content.js';
import { adminConfigured, env } from './env.js';
import { analyticsEnabled, deviceInfo, geoFromHeaders, recordEvent, visitorId } from './events.js';
import { clientIp, cookie, error, json, noContent, rateLimiter, readJsonBody, sameOrigin, trustedOrigin } from './http.js';
import { recordLogin, readLogins } from './logins.js';
import { MAX_BYTES, acceptedType, mediaBackend, readMedia, saveUpload } from './media.js';
import { busyRanges, createRequest, deleteRequest, listRequests, updateRequest } from './requests.js';
import { getLiveCount, getStats, isRangeId } from './stats.js';
import { StorageUnavailableError, backend } from './store.js';

/**
 * All API routes in one place. `route` is the path after /api/ ("admin/requests/abc").
 * Runs unchanged as a Vercel Function (api/index.ts) and inside the Vite dev server.
 */

const trackFlood = rateLimiter(120, 60_000);
const requestFlood = rateLimiter(5, 10 * 60_000);

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const optionalText = (value: unknown, max: number) => text(value, max) || undefined;
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function referrerHost(ref: string | undefined, ownHost: string | null) {
  if (!ref) return undefined;
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    return host && host !== ownHost?.split(':')[0] ? host : undefined;
  } catch {
    return undefined;
  }
}

async function track(request: Request, body: Pick<TrackPayload, 'type'> & Partial<TrackPayload>) {
  if (!analyticsEnabled() || isAdminRequest(request)) return;
  const ua = request.headers.get('user-agent') ?? '';
  const device = deviceInfo(ua, typeof body.touch === 'number' ? body.touch : 0);
  if (device.isBot) return;
  const geo = geoFromHeaders(request);
  const event: StoredEvent = {
    ts: Date.now(),
    type: body.type,
    v: await visitorId(clientIp(request), ua),
    path: optionalText(body.path, 200),
    country: optionalText(geo.country, 2)?.toUpperCase(),
    city: optionalText(geo.city, 80),
    os: device.os,
    device: device.device,
    browser: device.browser,
    ref: referrerHost(optionalText(body.ref, 500), request.headers.get('host')),
    utm: optionalText(body.utm, 60)?.toLowerCase(),
    lang: optionalText(body.lang, 20),
    tz: optionalText(body.tz, 60),
    sw: typeof body.sw === 'number' ? Math.round(Math.min(Math.max(body.sw, 0), 10_000)) : undefined,
    place: optionalText(body.place, 40),
    dur: typeof body.dur === 'number' ? Math.round(Math.min(Math.max(body.dur, 0), 6 * 3600)) : undefined,
    seen: Array.isArray(body.seen) ? body.seen.filter((id): id is string => typeof id === 'string').slice(0, 20).map((id) => id.slice(0, 40)) : undefined,
  };
  await recordEvent(event).catch((cause) => console.error('[track] could not store event', cause));
}

async function workHours(): Promise<WorkHours> {
  return (await getOverrides()).hours ?? DEFAULT_WORK_HOURS;
}

/** Validates working hours sent from the panel. */
function cleanHours(value: unknown): WorkHours | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const days = Array.isArray(v.days) ? [...new Set(v.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort() : [];
  const start = text(v.start, 5);
  const end = text(v.end, 5);
  if (!isTime(start) || !isTime(end) || start >= end) return null;
  const clamp = (n: unknown, min: number, max: number, fallback: number) => {
    const num = finite(n);
    return num === null ? fallback : Math.round(Math.min(Math.max(num, min), max));
  };
  return {
    days,
    start,
    end,
    slotMinutes: clamp(v.slotMinutes, 15, 240, DEFAULT_WORK_HOURS.slotMinutes),
    horizonDays: clamp(v.horizonDays, 1, 60, DEFAULT_WORK_HOURS.horizonDays),
    leadHours: clamp(v.leadHours, 0, 72, DEFAULT_WORK_HOURS.leadHours),
  };
}

function cleanPatch(body: Record<string, unknown>): RequestPatch {
  const patch: RequestPatch = {};
  if (typeof body.status === 'string' && (STATUSES as readonly string[]).includes(body.status)) patch.status = body.status as RequestPatch['status'];
  if ('name' in body) patch.name = text(body.name, 60);
  if ('phone' in body) patch.phone = normalizePhone(text(body.phone, 30)) || text(body.phone, 30);
  if (typeof body.contactPref === 'string' && (CONTACT_PREFS as readonly string[]).includes(body.contactPref)) patch.contactPref = body.contactPref as ContactPref;
  if ('serviceId' in body) patch.serviceId = text(body.serviceId, 40) || null;
  if ('serviceTitle' in body) patch.serviceTitle = text(body.serviceTitle, 80) || null;
  if ('question' in body) patch.question = text(body.question, 2000);
  if ('notes' in body) patch.notes = text(body.notes, 4000);
  if ('preferredAt' in body) patch.preferredAt = finite(body.preferredAt);
  if ('scheduledAt' in body) patch.scheduledAt = finite(body.scheduledAt);
  if ('durationMin' in body) patch.durationMin = Math.round(Math.min(Math.max(finite(body.durationMin) ?? 60, 10), 600));
  if ('price' in body) patch.price = finite(body.price) === null ? null : Math.max(0, Math.round(finite(body.price)!));
  if ('paid' in body) patch.paid = body.paid === true;
  if ('seen' in body) patch.seen = body.seen === true;
  return patch;
}

/** Builds a request from the site form (or the panel's "add manually"). */
function fromPayload(body: Partial<NewRequestPayload> & Record<string, unknown>, manual: boolean): Omit<BookingRequest, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'completedAt' | 'seen'> | string {
  const name = text(body.name, 60);
  const phone = normalizePhone(text(body.phone, 30));
  if (!name) return 'name';
  if (!phone && !manual) return 'phone';
  const date = text(body.date, 10);
  const time = text(body.time, 5);
  const preferredAt = isDate(date) && isTime(time) ? zonedTime(date, time, env.tz) : null;
  if (preferredAt !== null && !manual && preferredAt < Date.now() - 3_600_000) return 'time';
  const contactPref = (CONTACT_PREFS as readonly string[]).includes(body.contactPref as string) ? (body.contactPref as ContactPref) : 'call';
  const duration = finite(body.durationMin);
  const scheduledAt = manual ? finite(body.scheduledAt) : null;
  return {
    // Added by hand with a time already agreed: straight to "Назначена".
    status: manual ? (scheduledAt ? 'scheduled' : 'in_progress') : 'new',
    name,
    phone: phone || text(body.phone, 30),
    contactPref,
    serviceId: text(body.serviceId, 40) || null,
    serviceTitle: text(body.serviceTitle, 80) || null,
    question: text(body.question, 2000),
    preferredAt,
    scheduledAt,
    durationMin: duration ? Math.round(Math.min(Math.max(duration, 10), 600)) : 60,
    price: finite(body.price),
    paid: false,
    notes: manual ? text(body.notes, 4000) : '',
    source: manual ? 'manual' : 'site',
  };
}

const isImageUrl = (value: string) => /^\/api\/media\/[\w.-]+$/.test(value) || /^\/(photos|cards)\/[\w./-]+$/.test(value) || /^https:\/\/[\w.-]+\/[^\s"'<>]+$/.test(value);

/** Free texts, image swaps and inserted images from the live editor, each checked and capped. */
function cleanPageEdits(body: Partial<ContentOverrides>): Pick<ContentOverrides, 'free' | 'media' | 'inserts'> {
  const free: ContentOverrides['free'] = {};
  for (const [key, value] of Object.entries(body.free ?? {}).slice(0, 600)) {
    const k = text(key, 400);
    if (k.length >= 1 && typeof value === 'string') free[k] = value.slice(0, 2000);
  }
  const media: ContentOverrides['media'] = {};
  for (const [key, value] of Object.entries(body.media ?? {}).slice(0, 200)) {
    const k = text(key, 200);
    if (!/^(slot:[\w-]+|\/[\w./-]+)$/.test(k) || typeof value !== 'string') continue;
    // "" hides the image; anything else must be one of our files or an https image.
    if (value === '' || isImageUrl(value)) media[k] = value;
  }
  const inserts: Insert[] = [];
  for (const raw of (Array.isArray(body.inserts) ? body.inserts : []).slice(0, 60)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as unknown as Record<string, unknown>;
    const src = text(item.src, 500);
    const section = text(item.section, 40);
    const after = text(item.after, 400);
    if (!isImageUrl(src) || !/^[\w-]+$/.test(section) || !after) continue;
    inserts.push({ id: text(item.id, 40) || `i${inserts.length}`, section, after, src, alt: text(item.alt, 200) });
  }
  return { free, media, inserts };
}

type Handler = (request: Request, params: string[]) => Promise<Response> | Response;
interface Route {
  method: string;
  pattern: RegExp;
  admin?: boolean;
  handler: Handler;
}

const routes: Route[] = [
  // --- Public ---------------------------------------------------------------------
  {
    method: 'GET',
    pattern: /^availability$/,
    handler: async () => {
      const now = Date.now();
      const busy = backend() === 'none' ? [] : await busyRanges(now).catch(() => []);
      const body: Availability = { tz: env.tz, hours: await workHours(), busy, now };
      return json(body, { headers: { 'Cache-Control': 'no-store' } });
    },
  },
  {
    method: 'GET',
    pattern: /^content$/,
    handler: async () => {
      const { texts, free, media, inserts, contacts, updatedAt, design } = await getOverrides();
      // Browsers always revalidate (an edit shows on the next visit); the CDN may hold it briefly.
      return json(
        { texts, free, media, inserts, contacts, updatedAt, design },
        { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'CDN-Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } },
      );
    },
  },
  {
    method: 'POST',
    pattern: /^track$/,
    handler: async (request) => {
      if (trackFlood(clientIp(request))) return noContent();
      const body = await readJsonBody<TrackPayload>(request, 4000);
      if (!body || !TRACKED_EVENTS.includes(body.type) || body.type === 'request') return noContent();
      await track(request, body);
      return noContent();
    },
  },
  {
    method: 'POST',
    pattern: /^requests$/,
    handler: async (request) => {
      if (!sameOrigin(request) && !trustedOrigin(request)) return error('forbidden', 403);
      const body = await readJsonBody<Partial<NewRequestPayload> & Record<string, unknown>>(request);
      if (!body) return error('bad-request', 400);
      // Bots fill every field; pretend it worked and store nothing.
      if (text(body.website, 200)) return json({ ok: true });
      if (requestFlood(clientIp(request))) return error('too-many', 429);
      const data = fromPayload(body, false);
      if (typeof data === 'string') return error(`invalid-${data}`, 422);
      const created = await createRequest(data);
      await track(request, { type: 'request', place: 'booking' });
      return json({ ok: true, id: created.id }, { status: 201 });
    },
  },

  // --- Admin session ------------------------------------------------------------------
  {
    method: 'POST',
    pattern: /^admin\/login$/,
    handler: async (request) => {
      if (!sameOrigin(request)) return error('forbidden', 403);
      if (!adminConfigured()) return error('not-configured', 503);
      const ip = clientIp(request);
      if (await loginBlocked(ip)) return error('too-many', 429);
      const body = await readJsonBody<{ password?: unknown }>(request, 2000);
      const password = typeof body?.password === 'string' ? body.password : '';
      if (!checkPassword(password)) {
        await noteFailedLogin(ip);
        await recordLogin(request, false);
        // A short pause makes guessing slower without bothering a real person.
        await new Promise((resolve) => setTimeout(resolve, 400));
        return error('wrong-password', 401);
      }
      await clearLoginAttempts(ip);
      await recordLogin(request, true);
      const { token, expires } = createSessionToken();
      const headers = new Headers();
      headers.append('Set-Cookie', cookie(SESSION_COOKIE, token, { expires, httpOnly: true, secure: env.production }));
      headers.append('Set-Cookie', cookie(UI_COOKIE, '1', { expires, secure: env.production }));
      return json({ ok: true }, { headers });
    },
  },
  {
    method: 'POST',
    pattern: /^admin\/logout$/,
    handler: () => {
      const headers = new Headers();
      headers.append('Set-Cookie', cookie(SESSION_COOKIE, '', { maxAge: 0, httpOnly: true, secure: env.production }));
      headers.append('Set-Cookie', cookie(UI_COOKIE, '', { maxAge: 0, secure: env.production }));
      return json({ ok: true }, { headers });
    },
  },
  {
    method: 'GET',
    pattern: /^admin\/session$/,
    handler: (request) => json({ admin: isAdminRequest(request), configured: adminConfigured() }),
  },

  // --- Admin data -------------------------------------------------------------------------
  {
    method: 'GET',
    pattern: /^admin\/status$/,
    admin: true,
    handler: () => json({ backend: backend(), media: mediaBackend(), tz: env.tz, analytics: analyticsEnabled() }),
  },
  {
    method: 'GET',
    pattern: /^admin\/requests$/,
    admin: true,
    handler: async () => json({ items: await listRequests(), now: Date.now() }),
  },
  {
    method: 'POST',
    pattern: /^admin\/requests$/,
    admin: true,
    handler: async (request) => {
      const body = await readJsonBody<Record<string, unknown>>(request);
      if (!body) return error('bad-request', 400);
      const data = fromPayload(body, true);
      if (typeof data === 'string') return error(`invalid-${data}`, 422);
      return json({ item: await createRequest({ ...data, seen: true }) }, { status: 201 });
    },
  },
  {
    method: 'PATCH',
    pattern: /^admin\/requests\/([\w-]+)$/,
    admin: true,
    handler: async (request, [id]) => {
      const body = await readJsonBody<Record<string, unknown>>(request);
      if (!body) return error('bad-request', 400);
      const item = await updateRequest(id, cleanPatch(body));
      return item ? json({ item }) : error('not-found', 404);
    },
  },
  {
    method: 'DELETE',
    pattern: /^admin\/requests\/([\w-]+)$/,
    admin: true,
    handler: async (_request, [id]) => ((await deleteRequest(id)) ? json({ ok: true }) : error('not-found', 404)),
  },
  {
    method: 'GET',
    pattern: /^admin\/stats$/,
    admin: true,
    handler: async (request) => {
      const range = new URL(request.url).searchParams.get('range');
      return json(await getStats(isRangeId(range) ? range : '7d'));
    },
  },
  {
    method: 'GET',
    pattern: /^admin\/live$/,
    admin: true,
    handler: async () => json({ live: await getLiveCount() }),
  },
  {
    method: 'GET',
    pattern: /^admin\/content$/,
    admin: true,
    handler: async () => json(await getOverrides()),
  },
  {
    method: 'PUT',
    pattern: /^admin\/content$/,
    admin: true,
    handler: async (request) => {
      const body = await readJsonBody<Partial<ContentOverrides>>(request, 200_000);
      if (!body) return error('bad-request', 400);
      const texts: ContentOverrides['texts'] = {};
      for (const [path, value] of Object.entries(body.texts ?? {})) {
        if (!isEditable(path)) continue;
        if (typeof value === 'number' && Number.isFinite(value)) texts[path] = value;
        else if (typeof value === 'string') texts[path] = value.slice(0, 2000);
      }
      const contacts: ContentOverrides['contacts'] = {};
      for (const kind of ['telegram', 'max'] as const) {
        const value = text(body.contacts?.[kind], 120);
        if (value) contacts[kind] = value;
      }
      const hours = body.hours === null ? null : (cleanHours(body.hours) ?? (await getOverrides()).hours);
      const previous = await getOverrides();
      const design = structuredClone(previous.design);
      const sectionKeys = ['about', 'topics', 'principles', 'method', 'gallery', 'services', 'process', 'reviews', 'reflection', 'location', 'project', 'faq'];
      for (const [key, value] of Object.entries(body.design?.sections ?? {})) {
        if (sectionKeys.includes(key) && typeof value === 'boolean') design.sections[key] = value;
      }
      const themeKeys = ['background', 'surface', 'amethyst', 'rose', 'gold', 'ivory'];
      for (const [key, value] of Object.entries(body.design?.theme ?? {})) {
        if (themeKeys.includes(key) && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) design.theme[key] = value;
      }
      return json(await saveOverrides({ design, texts, ...cleanPageEdits(body), contacts, hours, updatedAt: Date.now() }));
    },
  },
  {
    method: 'POST',
    pattern: /^admin\/upload$/,
    admin: true,
    handler: async (request) => {
      if (mediaBackend() === 'none') return error('storage-unavailable', 503);
      const form = await request.formData().catch(() => null);
      const file = form?.get('file');
      if (!(file instanceof File)) return error('no-file', 400);
      if (!acceptedType(file.type)) return error('type', 415);
      if (file.size > MAX_BYTES) return error('size', 413);
      return json({ url: await saveUpload(new Uint8Array(await file.arrayBuffer()), file.type) }, { status: 201 });
    },
  },
  {
    method: 'GET',
    pattern: /^media\/([\w.-]+)$/,
    handler: async (_request, [name]) => {
      const file = await readMedia(name);
      if (!file) return new Response('Not found', { status: 404 });
      return new Response(new Uint8Array(file.data), {
        headers: { 'Content-Type': file.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
      });
    },
  },
  {
    method: 'GET',
    pattern: /^admin\/logins$/,
    admin: true,
    handler: async () => json({ items: await readLogins() }),
  },
  {
    method: 'GET',
    pattern: /^admin\/export$/,
    admin: true,
    handler: async () => {
      const data = { exportedAt: new Date().toISOString(), requests: await listRequests(), content: await getOverrides() };
      return json(data, { headers: { 'Content-Disposition': `attachment; filename="ugrin-${new Date().toISOString().slice(0, 10)}.json"` } });
    },
  },
];

export async function handle(request: Request, route: string): Promise<Response> {
  const clean = route.replace(/^\/+|\/+$/g, '');
  const matches = routes.filter((r) => r.pattern.test(clean));
  if (matches.length === 0) return error('not-found', 404);
  // The GitHub Pages copy may call public routes from its own address; admin routes stay same-site only.
  const cors = matches.some((r) => !r.admin) ? trustedOrigin(request) : null;
  if (request.method === 'OPTIONS') {
    if (!cors) return error('forbidden', 403);
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': cors, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } });
  }
  const response = await dispatch(request, clean, matches);
  if (cors && !matches.find((r) => r.method === request.method)?.admin) {
    response.headers.set('Access-Control-Allow-Origin', cors);
    response.headers.append('Vary', 'Origin');
  }
  return response;
}

async function dispatch(request: Request, clean: string, matches: typeof routes): Promise<Response> {
  const match = matches.find((r) => r.method === request.method);
  if (!match) return error('method-not-allowed', 405);
  if (match.admin) {
    if (!isAdminRequest(request)) return error('unauthorized', 401);
    if (request.method !== 'GET' && !sameOrigin(request)) return error('forbidden', 403);
  }
  try {
    return await match.handler(request, match.pattern.exec(clean)!.slice(1));
  } catch (cause) {
    if (cause instanceof StorageUnavailableError) return error('storage-unavailable', 503);
    console.error(`[api] ${request.method} ${clean}`, cause);
    return error('server-error', 500);
  }
}
