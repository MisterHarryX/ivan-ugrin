import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { put } from '@vercel/blob';
import { StorageUnavailableError, backend, dataPath, redis } from './store.js';

/**
 * Photos uploaded in the live editor. Where they go:
 * - Vercel Blob when BLOB_READ_WRITE_TOKEN is set (best for Vercel);
 * - otherwise Redis (fine for a handful of shrunk photos; Upstash caps a value at a few MB);
 * - otherwise `.data/media/` on disk (development, own server).
 * The browser shrinks photos before upload, so files are typically 150–500 KB.
 */
export const MAX_BYTES = 4 * 1024 * 1024;
export const TYPES: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', avif: 'image/avif', gif: 'image/gif' };
const EXT_OF: Record<string, string> = Object.fromEntries(Object.entries(TYPES).map(([ext, type]) => [type, ext]));

export type MediaBackend = 'blob' | 'redis' | 'files' | 'none';

export function mediaBackend(): MediaBackend {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  const b = backend();
  return b === 'redis' ? 'redis' : b === 'files' ? 'files' : 'none';
}

export const acceptedType = (type: string) => EXT_OF[type] !== undefined;

export async function saveUpload(data: Uint8Array, type: string): Promise<string> {
  const ext = EXT_OF[type];
  const name = `${Date.now().toString(36)}-${randomBytes(5).toString('hex')}.${ext}`;
  const where = mediaBackend();
  if (where === 'none') throw new StorageUnavailableError('No media storage');
  if (where === 'blob') {
    const blob = await put(`ugrin/media/${name}`, Buffer.from(data), {
      access: 'public',
      contentType: type,
      addRandomSuffix: false,
      cacheControlMaxAge: 31_536_000,
    });
    return blob.url;
  }
  if (where === 'redis') {
    await redis(['SET', `ugrin:media:${name}`, Buffer.from(data).toString('base64')]);
    return `/api/media/${name}`;
  }
  await fs.mkdir(dataPath('media'), { recursive: true });
  await fs.writeFile(dataPath('media', name), data);
  return `/api/media/${name}`;
}

/** Reads a file saved by `saveUpload` (Redis or disk); null when unknown. */
export async function readMedia(name: string): Promise<{ data: Uint8Array; type: string } | null> {
  const match = /^[a-z0-9]+-[a-f0-9]{10}\.(webp|jpg|png|avif|gif)$/.exec(name);
  if (!match) return null;
  const type = TYPES[match[1]];
  try {
    // Blob files are served by Vercel directly; /api/media only covers Redis and disk.
    if (backend() === 'redis') {
      const base64 = await redis<string | null>(['GET', `ugrin:media:${name}`]);
      return base64 ? { data: Buffer.from(base64, 'base64'), type } : null;
    }
    return { data: await fs.readFile(dataPath('media', name)), type };
  } catch {
    return null;
  }
}
