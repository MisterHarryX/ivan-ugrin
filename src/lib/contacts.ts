import type { ContactKind, ContactMethod } from '../config/types.ts';

export const contactNames: Record<ContactKind, string> = {
  telegram: 'Telegram',
  max: 'Max',
  booking: 'Профиль',
};

/** Whether the channel can receive the visitor's pre-filled message through its link. Neither messenger can. */
export const supportsPrefill: Record<ContactKind, boolean> = {
  telegram: false,
  max: false,
  booking: false,
};

const digits = (value: string) => value.replace(/\D/g, '');
/** A phone number rather than a username or link: "+7…", "8…" or only digits and separators. */
export const isPhone = (value: string) => /^[+\d][\d\s()-]{8,}$/.test(value.trim()) && digits(value).length >= 10;
/** "+79197778861" from any spelling of a Russian (or international) number. */
export function phoneE164(value: string) {
  let d = digits(value);
  if (d.length === 11 && d.startsWith('8')) d = `7${d.slice(1)}`;
  if (d.length === 10) d = `7${d}`;
  return `+${d}`;
}

/**
 * Telegram: a username (t.me/name) or a phone number (t.me/+7…, opens the chat by number).
 * Max: a link from the app (https://max.ru/…) or a phone number. Max has no public link to a chat by
 * number, so a number becomes a call link and the site copies it for searching in Max.
 */
export function contactHref(contact: ContactMethod): string {
  const value = contact.value.trim();
  switch (contact.kind) {
    case 'telegram':
      return isPhone(value) ? `https://t.me/${phoneE164(value)}` : `https://t.me/${value.replace(/^@|^https?:\/\/t\.me\//, '')}`;
    case 'max':
      return /^https?:\/\//.test(value) ? value : `tel:${phoneE164(value)}`;
    case 'booking':
      return value;
  }
}

/** "+7 919 777-88-61" from any spelling of a Russian number. */
export function prettyPhone(value: string): string {
  const e = phoneE164(value);
  const d = e.slice(1);
  if (d.length !== 11 || !d.startsWith('7')) return value;
  return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
}

/** Human-readable handle shown next to the button. */
export function contactDisplay(contact: ContactMethod): string {
  const value = contact.value.trim();
  if (!value) return '';
  switch (contact.kind) {
    case 'telegram':
      return isPhone(value) ? prettyPhone(value) : `@${value.replace(/^@|^https?:\/\/t\.me\//, '')}`;
    case 'max':
      return /^https?:\/\//.test(value) ? value.replace(/^https?:\/\//, '').replace(/\/$/, '') : prettyPhone(value);
    case 'booking':
      return value.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  }
}

/** Max by number: the link dials, so copying the number lets people find the chat in Max. */
export const copiesNumber = (contact: ContactMethod) => contact.kind === 'max' && !/^https?:\/\//.test(contact.value.trim());

export const isExternal = (contact: ContactMethod) => !contactHref(contact).startsWith('tel:');
