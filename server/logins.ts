import { promises as fs } from 'node:fs';
import type { DeviceType } from '../shared/analytics.js';
import { deviceInfo, geoFromHeaders } from './events.js';
import { clientIp } from './http.js';
import { appendLine, backend, dataPath, redisPipeline } from './store.js';

/** One sign-in attempt to the panel: who, from what device and where. */
export interface LoginEntry {
  ts: number;
  ok: boolean;
  device: DeviceType;
  os: string;
  browser: string;
  country?: string;
  city?: string;
  /** IP with the last part hidden ("93.184.216.•"), enough to tell places apart. */
  ip: string;
}

const KEY = 'ugrin:logins';
const KEEP = 200;
const FILE = () => dataPath('logins.ndjson');

function maskIp(ip: string) {
  if (!ip || ip === 'local') return 'локальная сеть';
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/.test(v4)) return 'локальная сеть';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.replace(/\.\d+$/, '.•');
  return `${v4.split(':').slice(0, 3).join(':')}:…`;
}

export async function recordLogin(request: Request, ok: boolean) {
  const ua = request.headers.get('user-agent') ?? '';
  const device = deviceInfo(ua);
  const geo = geoFromHeaders(request);
  const entry: LoginEntry = {
    ts: Date.now(),
    ok,
    device: device.device,
    os: device.os,
    browser: device.browser,
    country: geo.country?.toUpperCase(),
    city: geo.city,
    ip: maskIp(clientIp(request)),
  };
  const line = JSON.stringify(entry);
  try {
    const b = backend();
    if (b === 'redis') await redisPipeline([['LPUSH', KEY, line], ['LTRIM', KEY, 0, KEEP - 1]]);
    else if (b === 'files') await appendLine(FILE(), line);
  } catch (cause) {
    console.error('[logins] could not record', cause);
  }
}

export async function readLogins(limit = 60): Promise<LoginEntry[]> {
  const parse = (lines: string[]) =>
    lines.flatMap((line) => {
      try {
        return line ? [JSON.parse(line) as LoginEntry] : [];
      } catch {
        return [];
      }
    });
  const b = backend();
  if (b === 'redis') {
    const [lines] = await redisPipeline<string[]>([['LRANGE', KEY, 0, limit - 1]]);
    return parse(lines ?? []);
  }
  if (b === 'files') {
    try {
      return parse((await fs.readFile(FILE(), 'utf8')).split('\n')).reverse().slice(0, limit);
    } catch {
      return [];
    }
  }
  return [];
}
