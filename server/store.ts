import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

/**
 * Where data lives, picked from the environment (as in ICG):
 * - Upstash Redis (KV_REST_API_* from Vercel's integration, or UPSTASH_REDIS_REST_*): the online database;
 * - the local `.data/` folder in development or on an own server;
 * - nothing on Vercel without Redis (its file system is read-only): the site still works,
 *   requests are refused with a friendly message and visitors are sent to the messengers.
 */
export type Backend = 'redis' | 'files' | 'none';

export function backend(): Backend {
  if (env.redisUrl && env.redisToken) return 'redis';
  return env.onVercel ? 'none' : 'files';
}

export class StorageUnavailableError extends Error {}

// --- Upstash Redis over REST (no SDK) --------------------------------------------

type Command = (string | number)[];

async function call<T>(suffix: string, body: unknown): Promise<T> {
  const response = await fetch(`${env.redisUrl}${suffix}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Redis ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function redis<T = unknown>(command: Command): Promise<T> {
  const { result, error } = await call<{ result: T; error?: string }>('', command);
  if (error) throw new Error(`Redis: ${error}`);
  return result;
}

/** Several commands in one round trip. */
export async function redisPipeline<T = unknown>(commands: Command[]): Promise<T[]> {
  if (commands.length === 0) return [];
  const results = await call<{ result: T; error?: string }[]>('/pipeline', commands);
  return results.map((entry) => {
    if (entry.error) throw new Error(`Redis: ${entry.error}`);
    return entry.result;
  });
}

// --- Local files -------------------------------------------------------------------

export const dataPath = (...parts: string[]) => path.join(env.dataDir, ...parts);

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/** Write-then-rename so a crash never leaves a half-written file behind. */
export async function writeJsonAtomic(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

export async function appendLine(file: string, line: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${line}\n`, 'utf8');
}

/** Serialises read-modify-write cycles on one file within this process. */
const locks = new Map<string, Promise<unknown>>();
export function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  locks.set(
    key,
    next.catch(() => {}),
  );
  return next;
}
