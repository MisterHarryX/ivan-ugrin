import type { TrackPayload } from '../../shared/analytics.ts';
import type { NewRequestPayload } from '../../shared/booking.ts';
import type { ContentOverrides } from '../../shared/content.ts';
import type { Availability } from '../../shared/schedule.ts';

import { serverUrl } from './paths.ts';

/** The site's calls to its API (server/router.ts); on GitHub Pages they go to the Vercel copy. */

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendRequest(payload: NewRequestPayload & { serviceTitle: string | null; durationMin: number }): Promise<SendResult> {
  try {
    const response = await fetch(serverUrl('/api/requests'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? `http-${response.status}` };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function getAvailability(): Promise<Availability | null> {
  try {
    const response = await fetch(serverUrl('/api/availability'), { cache: 'no-store' });
    return response.ok ? ((await response.json()) as Availability) : null;
  } catch {
    return null;
  }
}

export type PublicContent = Pick<ContentOverrides, 'design' | 'texts' | 'free' | 'media' | 'inserts' | 'contacts' | 'updatedAt'>;

export async function getContent(timeoutMs: number): Promise<PublicContent | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(serverUrl('/api/content'), { signal: controller.signal, cache: 'no-cache' });
    return response.ok ? ((await response.json()) as PublicContent) : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Fire-and-forget analytics; survives the page closing. */
export function track(payload: TrackPayload) {
  const body = JSON.stringify(payload);
  try {
    // Plain text keeps the beacon a simple request, so it also works from the GitHub Pages copy.
    if (navigator.sendBeacon?.(serverUrl('/api/track'), new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
  } catch {
    // Fall through to fetch.
  }
  fetch(serverUrl('/api/track'), { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(() => {});
}

/** The readable hint cookie set at sign-in; grants nothing by itself. */
export const hasAdminHint = () => document.cookie.split('; ').some((c) => c === 'ugrin_admin_ui=1');
