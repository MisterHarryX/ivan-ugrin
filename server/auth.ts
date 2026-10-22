import { createHmac, timingSafeEqual } from 'node:crypto';
import { adminConfigured, env } from './env.js';
import { readCookie } from './http.js';
import { backend, redis, redisPipeline } from './store.js';

/** httpOnly session cookie: the actual credential. */
export const SESSION_COOKIE = 'ugrin_admin';
/** Readable hint so the public site can show the panel shortcut. Grants nothing. */
export const UI_COOKIE = 'ugrin_admin_ui';

const SESSION_DAYS = 14;

const sign = (payload: string) => createHmac('sha256', env.adminSecret).update(payload).digest('base64url');

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionToken() {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  return { token: `${expires}.${sign(String(expires))}`, expires: new Date(expires) };
}

export function verifySessionToken(token: string | undefined) {
  if (!token || !adminConfigured()) return false;
  const [expires, signature] = token.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return safeEqual(signature, sign(expires));
}

export function checkPassword(candidate: string) {
  if (!adminConfigured()) return false;
  // Compare HMACs so the check takes the same time whatever the input length.
  return safeEqual(sign(`pw:${candidate}`), sign(`pw:${env.adminPassword}`));
}

export const isAdminRequest = (request: Request) => verifySessionToken(readCookie(request, SESSION_COOKIE));

// --- Login throttling (per IP; Redis when available, else in memory) ----------

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 6;
const WINDOW_MS = 15 * 60_000;
const throttleKey = (ip: string) => `ugrin:login:${ip}`;

export async function loginBlocked(ip: string) {
  if (backend() === 'redis') {
    const count = await redis<string | null>(['GET', throttleKey(ip)]).catch(() => null);
    return Number(count ?? 0) >= MAX_ATTEMPTS;
  }
  const entry = attempts.get(ip);
  return Boolean(entry && entry.resetAt >= Date.now() && entry.count >= MAX_ATTEMPTS);
}

export async function noteFailedLogin(ip: string) {
  if (backend() === 'redis') {
    await redisPipeline([
      ['INCR', throttleKey(ip)],
      ['EXPIRE', throttleKey(ip), WINDOW_MS / 1000, 'NX'],
    ]).catch(() => {});
    return;
  }
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}

export async function clearLoginAttempts(ip: string) {
  if (backend() === 'redis') await redis(['DEL', throttleKey(ip)]).catch(() => {});
  attempts.delete(ip);
}
