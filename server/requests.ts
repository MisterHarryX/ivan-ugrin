import { randomBytes } from 'node:crypto';
import type { BookingRequest, RequestPatch } from '../shared/booking.js';
import type { Busy } from '../shared/schedule.js';
import { StorageUnavailableError, backend, dataPath, readJson, redis, withLock, writeJsonAtomic } from './store.js';

/**
 * Booking requests. Redis keeps them in one hash (id → JSON); without Redis they live
 * in `.data/requests.json`. Volumes are small (a reader's clients), so whole-list reads are fine.
 */
const HASH = 'ugrin:requests';
const FILE = () => dataPath('requests.json');

type FileShape = { items: BookingRequest[] };

const newId = () => `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;

function assertStorage() {
  if (backend() === 'none') throw new StorageUnavailableError('No storage configured');
}

async function readAll(): Promise<BookingRequest[]> {
  assertStorage();
  if (backend() === 'redis') {
    const flat = (await redis<string[] | null>(['HGETALL', HASH])) ?? [];
    const items: BookingRequest[] = [];
    for (let i = 1; i < flat.length; i += 2) {
      try {
        items.push(JSON.parse(flat[i]) as BookingRequest);
      } catch {
        // Skip a damaged entry rather than hiding every request.
      }
    }
    return items;
  }
  return (await readJson<FileShape>(FILE(), { items: [] })).items;
}

export async function listRequests() {
  return (await readAll()).sort((a, b) => b.createdAt - a.createdAt);
}

async function save(item: BookingRequest) {
  if (backend() === 'redis') {
    await redis(['HSET', HASH, item.id, JSON.stringify(item)]);
    return;
  }
  await withLock('requests', async () => {
    const data = await readJson<FileShape>(FILE(), { items: [] });
    const index = data.items.findIndex((r) => r.id === item.id);
    if (index === -1) data.items.push(item);
    else data.items[index] = item;
    await writeJsonAtomic(FILE(), data);
  });
}

export async function getRequest(id: string) {
  assertStorage();
  if (backend() === 'redis') {
    const raw = await redis<string | null>(['HGET', HASH, id]);
    return raw ? (JSON.parse(raw) as BookingRequest) : null;
  }
  return (await readAll()).find((r) => r.id === id) ?? null;
}

export type NewRequest = Omit<BookingRequest, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'completedAt' | 'seen'> &
  Partial<Pick<BookingRequest, 'seen'>>;

export async function createRequest(data: NewRequest) {
  assertStorage();
  const now = Date.now();
  const item: BookingRequest = {
    ...data,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    seen: data.seen ?? false,
    completedAt: data.status === 'done' ? now : null,
    history: [{ ts: now, status: data.status }],
  };
  await save(item);
  return item;
}

export async function updateRequest(id: string, patch: RequestPatch) {
  assertStorage();
  const current = await getRequest(id);
  if (!current) return null;
  const now = Date.now();
  const next: BookingRequest = { ...current, ...patch, id, updatedAt: now };
  if (patch.status && patch.status !== current.status) {
    next.history = [...current.history, { ts: now, status: patch.status }].slice(-40);
    next.completedAt = patch.status === 'done' ? now : patch.status === 'cancelled' ? (current.completedAt ?? now) : null;
  }
  await save(next);
  return next;
}

export async function deleteRequest(id: string) {
  assertStorage();
  if (backend() === 'redis') {
    return (await redis<number>(['HDEL', HASH, id])) > 0;
  }
  return withLock('requests', async () => {
    const data = await readJson<FileShape>(FILE(), { items: [] });
    const before = data.items.length;
    data.items = data.items.filter((r) => r.id !== id);
    await writeJsonAtomic(FILE(), data);
    return data.items.length < before;
  });
}

/** Confirmed sessions as time ranges, for the public slot picker. */
export async function busyRanges(from: number): Promise<Busy[]> {
  return (await readAll())
    .filter((r) => r.scheduledAt && r.status !== 'cancelled' && r.status !== 'done' && r.scheduledAt + r.durationMin * 60_000 > from)
    .map((r) => ({ start: r.scheduledAt!, end: r.scheduledAt! + r.durationMin * 60_000 }));
}
