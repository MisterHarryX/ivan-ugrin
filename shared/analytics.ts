/** Visit analytics, shared between the site tracker, the server and the panel (as in ICG). */

export const TRACKED_EVENTS = ['pageview', 'engage', 'telegram', 'max', 'b17', 'channel', 'request', 'card'] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

/** What the browser sends to /api/track. */
export interface TrackPayload {
  type: TrackedEvent;
  path?: string;
  /** document.referrer */
  ref?: string;
  /** utm_source from the landing URL */
  utm?: string;
  tz?: string;
  lang?: string;
  /** Screen width in CSS px. */
  sw?: number;
  /** navigator.maxTouchPoints (tells an iPad from a Mac). */
  touch?: number;
  /** Clicks: the section the link was in. */
  place?: string;
  /** engage: seconds the tab was visible. */
  dur?: number;
  /** engage: section ids that reached the screen. */
  seen?: string[];
}

export type DeviceType = 'desktop' | 'mobile' | 'tablet';

/** One stored event. No IPs, no cookies. */
export interface StoredEvent {
  ts: number;
  type: TrackedEvent;
  /** Daily-rotating anonymous visitor hash. */
  v: string;
  path?: string;
  country?: string;
  city?: string;
  os: string;
  device: DeviceType;
  browser: string;
  ref?: string;
  utm?: string;
  lang?: string;
  tz?: string;
  sw?: number;
  place?: string;
  dur?: number;
  seen?: string[];
}

export const RANGES = {
  today: { days: 1, label: 'Сегодня' },
  '7d': { days: 7, label: '7 дней' },
  '30d': { days: 30, label: '30 дней' },
  '90d': { days: 90, label: '90 дней' },
} as const;
export type RangeId = keyof typeof RANGES;

export interface Totals {
  visitors: number;
  pageviews: number;
  /** Clicks to Telegram, WhatsApp and e-mail together. */
  channels: number;
  /** Requests sent through the site form. */
  requests: number;
  /** Share of visitors who sent a request or opened a messenger, 0–1. */
  conversion: number;
  /** Average seconds on the site per visitor. */
  avgDuration: number;
}

export interface Row {
  name: string;
  value: number;
}

export interface Stats {
  range: RangeId;
  from: number;
  to: number;
  totals: Totals;
  previous: Totals;
  series: { key: string; label: string; visitors: number; pageviews: number; leads: number }[];
  countries: { code: string; value: number; cities: Row[] }[];
  os: Row[];
  devices: { name: DeviceType; value: number }[];
  browsers: Row[];
  sources: Row[];
  channels: Row[];
  funnel: { id: string; value: number }[];
  funnelBase: number;
  recent: { ts: number; type: TrackedEvent; city?: string; country?: string; device: DeviceType; os: string; browser: string; source: string; place?: string }[];
  hasData: boolean;
}
