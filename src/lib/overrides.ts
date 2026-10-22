import { isEditable } from '../../shared/content.ts';
import type { SiteConfig } from '../config/types.ts';
import type { PublicContent } from './api.ts';

/**
 * Applies edits published from the live editor onto the config before the first render.
 * Only text-shaped paths are touched (shared/content.ts) and only where the config really
 * has text, so a stale or odd entry can never break the page. Card texts live under
 * "cards.<id>…"; contacts are matched by kind; the portrait photo is the "slot:portrait" image.
 */
export function applyOverrides(site: SiteConfig, content: Partial<PublicContent>) {
  for (const [key, value] of Object.entries(content.design?.sections ?? {})) {
    if (Object.hasOwn(site.sections, key) && typeof value === 'boolean') site.sections[key as keyof typeof site.sections] = value;
  }
  for (const [key, value] of Object.entries(content.design?.theme ?? {})) {
    if (Object.hasOwn(site.theme, key) && /^#[0-9a-f]{6}$/i.test(value)) site.theme[key as keyof typeof site.theme] = value;
  }
  for (const [path, value] of Object.entries(content.texts ?? {})) {
    if (!isEditable(path)) continue;
    const keys = path.split('.');
    let target: unknown = site;
    for (const key of keys.slice(0, -1)) {
      target = target && typeof target === 'object' ? (target as Record<string, unknown>)[key] : undefined;
    }
    const last = keys[keys.length - 1];
    if (!target || typeof target !== 'object' || !(last in target)) continue;
    const record = target as Record<string, unknown>;
    // Keep the type the page expects: numbers stay numbers.
    if (typeof record[last] === 'number') {
      const number = Number(value);
      if (Number.isFinite(number)) record[last] = number;
    } else if (typeof record[last] === 'string') {
      record[last] = String(value);
    }
  }

  for (const [kind, value] of Object.entries(content.contacts ?? {})) {
    if (!value) continue;
    const contact = site.contacts.find((c) => c.kind === kind);
    if (contact) {
      contact.value = value;
      contact.sample = false;
    } else if (kind === 'telegram' || kind === 'max') {
      site.contacts.push({ kind, value });
    }
  }

  const portrait = content.media?.['slot:portrait'];
  if (portrait) site.practitioner.portrait = { ...site.practitioner.portrait, src: portrait };
}
