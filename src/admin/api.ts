import type { RangeId, Stats } from '../../shared/analytics.ts';
import type { BookingRequest, RequestPatch } from '../../shared/booking.ts';
import type { ContentOverrides } from '../../shared/content.ts';

/** Panel calls to /api/admin/*. A 401 anywhere means the session ended. */

export class Unauthorized extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    cache: 'no-store',
    ...init,
    headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
  });
  if (response.status === 401) throw new Unauthorized();
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `http-${response.status}`);
  return body;
}

export interface LoginEntry {
  ts: number;
  ok: boolean;
  device: 'desktop' | 'mobile' | 'tablet';
  os: string;
  browser: string;
  country?: string;
  city?: string;
  ip: string;
}

export interface Status {
  backend: 'redis' | 'files' | 'none';
  media: 'blob' | 'redis' | 'files' | 'none';
  tz: string;
  analytics: boolean;
}

export const adminApi = {
  session: () => call<{ admin: boolean; configured: boolean }>('admin/session'),
  login: (password: string) => call<{ ok: true }>('admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => call<{ ok: true }>('admin/logout', { method: 'POST' }),
  status: () => call<Status>('admin/status'),
  requests: () => call<{ items: BookingRequest[]; now: number }>('admin/requests'),
  create: (data: Record<string, unknown>) => call<{ item: BookingRequest }>('admin/requests', { method: 'POST', body: JSON.stringify(data) }),
  patch: (id: string, patch: RequestPatch) => call<{ item: BookingRequest }>(`admin/requests/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => call<{ ok: true }>(`admin/requests/${id}`, { method: 'DELETE' }),
  stats: (range: RangeId) => call<Stats>(`admin/stats?range=${range}`),
  live: () => call<{ live: number }>('admin/live'),
  logins: () => call<{ items: LoginEntry[] }>('admin/logins'),
  content: () => call<ContentOverrides>('admin/content'),
  saveContent: (data: ContentOverrides) => call<ContentOverrides>('admin/content', { method: 'PUT', body: JSON.stringify(data) }),
};

export const ERROR_TEXT: Record<string, string> = {
  'wrong-password': 'Пароль не подошёл.',
  'too-many': 'Слишком много попыток. Подождите пятнадцать минут.',
  'not-configured': 'Пароль не задан: добавьте ADMIN_PASSWORD в переменные окружения.',
  'storage-unavailable': 'Хранилище не подключено. Откройте «Настройки», там написано, что сделать.',
};
