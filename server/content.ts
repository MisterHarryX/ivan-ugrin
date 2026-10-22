import { EMPTY_OVERRIDES, type ContentOverrides } from '../shared/content.js';
import { StorageUnavailableError, backend, dataPath, readJson, redis, writeJsonAtomic } from './store.js';

/** Published edits from the panel: texts, contacts and working hours. */
const KEY = 'ugrin:content';
const FILE = () => dataPath('content.json');

export async function getOverrides(): Promise<ContentOverrides> {
  const b = backend();
  if (b === 'none') return EMPTY_OVERRIDES;
  try {
    const stored =
      b === 'redis'
        ? ((await redis<string | null>(['GET', KEY])) ?? null)
        : JSON.stringify(await readJson<Partial<ContentOverrides>>(FILE(), {}));
    const parsed = stored ? (JSON.parse(stored) as Partial<ContentOverrides>) : {};
    return { ...EMPTY_OVERRIDES, ...parsed };
  } catch (cause) {
    console.error('[content] could not read overrides', cause);
    return EMPTY_OVERRIDES;
  }
}

export async function saveOverrides(next: ContentOverrides) {
  const b = backend();
  if (b === 'none') throw new StorageUnavailableError('No storage configured');
  const value = { ...next, updatedAt: Date.now() };
  if (b === 'redis') await redis(['SET', KEY, JSON.stringify(value)]);
  else await writeJsonAtomic(FILE(), value);
  return value;
}
