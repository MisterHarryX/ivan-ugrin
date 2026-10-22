import type { WorkHours } from './schedule.js';

/** An image the reader added to the page, placed right after a block of text. */
export interface Insert {
  id: string;
  /** Section id the anchor lives in ("about", "faq"…). */
  section: string;
  /** Normalised text of the block the image goes after. */
  after: string;
  src: string;
  alt: string;
}

/**
 * Edits published from the live site editor.
 * - `texts`: dotted paths in the site config (or `cards.<id>.…`) → new value.
 * - `free`: any other text on the page, keyed by its original wording → new wording
 *   (labels, buttons and other strings written straight into the components).
 * - `media`: image key (its original file, see `imageKey`) → new URL, or "" to hide it.
 *   The empty portrait frame is the key "slot:portrait".
 * - `inserts`: images added after a block of text.
 */
export interface ContentOverrides {
  design: { sections: Record<string, boolean>; theme: Record<string, string> };
  texts: Record<string, string | number>;
  free: Record<string, string>;
  media: Record<string, string>;
  inserts: Insert[];
  contacts: Partial<Record<'telegram' | 'max', string>>;
  hours: WorkHours | null;
  updatedAt: number;
}

export const EMPTY_OVERRIDES: ContentOverrides = { design: { sections: {}, theme: {} }, texts: {}, free: {}, media: {}, inserts: [], contacts: {}, hours: null, updatedAt: 0 };

/** Parts of the config that hold visible text; layout, theme and switches are not editable. */
export const TEXT_ROOTS = [
  'meta',
  'hero',
  'practitioner',
  'topics',
  'principles',
  'method',
  'gallery',
  'services',
  'process',
  'reviews',
  'reflection',
  'location',
  'project',
  'faq',
  'booking',
  'footer',
] as const;

/** Fields that are identifiers or file paths, not text, even inside editable parts. */
export const NOT_TEXT = new Set(['id', 'card', 'photo', 'src', 'kind', 'currency', 'width', 'height', 'focus', 'sample', 'status', 'value', 'color', 'lat', 'lon', 'pending']);

/**
 * Whether a path may be edited. The server cannot see the site config, so this checks
 * the shape; the site applies a value only where its config really has text there.
 */
export function isEditable(path: string) {
  const parts = path.split('.');
  if (parts.length < 2 || parts.length > 8 || !(TEXT_ROOTS as readonly string[]).includes(parts[0])) return false;
  if (!parts.every((p) => /^[A-Za-z0-9-]{1,40}$/.test(p))) return false;
  // Lists of card ids ("hero.cards.0") are choices of cards, not text.
  if (parts.slice(1).includes('cards')) return false;
  // Review topics and the tags that point at them must stay in step: chosen in code, not typed.
  if (parts.includes('tags') || (parts[0] === 'reviews' && parts[1] === 'topics')) return false;
  return !NOT_TEXT.has(parts[parts.length - 1]);
}

/** The stable name of an image: its file without size suffix or extension ("/photos/night-flame"). */
export function imageKey(src: string) {
  try {
    const path = new URL(src, 'http://x').pathname;
    return path.replace(/-\d{3,4}(?=\.\w+$)/, '').replace(/\.(jpe?g|png|webp|avif|gif|svg)$/i, '');
  } catch {
    return src;
  }
}
