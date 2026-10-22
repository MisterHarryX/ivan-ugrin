import { imageKey, type ContentOverrides } from '../../shared/content.ts';

/**
 * Applies the edits that are not config values, straight in the DOM after React renders:
 * - free texts (any wording on the page, keyed by its original text),
 * - swapped or hidden images,
 * - images inserted after a block of text.
 * A MutationObserver re-applies them when React re-renders a part of the page, and
 * originals are remembered so an edit can be undone without a reload.
 */
export type PageEdits = Pick<ContentOverrides, 'free' | 'media' | 'inserts'>;

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const SKIP = '[data-site-admin], script, style, noscript, textarea, title';

/** Text nodes we changed: their original wording and the value we put in. */
const originals = new WeakMap<Text, string>();
const applied = new WeakMap<Text, string>();

let edits: PageEdits = { free: {}, media: {}, inserts: [] };
let observer: MutationObserver | null = null;
let frame = 0;

function setText(node: Text, value: string) {
  const current = node.nodeValue ?? '';
  const lead = /^\s*/.exec(current)?.[0] ?? '';
  const trail = /\s*$/.exec(current)?.[0] ?? '';
  const next = `${lead}${value}${trail}`;
  if (current !== next) node.nodeValue = next;
  applied.set(node, next);
}

/** The wording a text node had before any free-text edit. */
export function originalText(node: Text) {
  return originals.get(node) ?? node.nodeValue ?? '';
}

function applyTexts(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text;
    if (node.parentElement?.closest(SKIP)) continue;
    // React (or the editor's preview) wrote something new: that becomes the original.
    if (applied.has(node) && applied.get(node) !== node.nodeValue) {
      originals.delete(node);
      applied.delete(node);
    }
    const original = originals.get(node) ?? node.nodeValue ?? '';
    const replacement = edits.free[normalize(original)];
    if (replacement !== undefined) {
      if (!originals.has(node)) originals.set(node, original);
      setText(node, replacement);
    } else if (originals.has(node)) {
      node.nodeValue = originals.get(node)!;
      originals.delete(node);
      applied.delete(node);
    }
  }
}

/** The stable key of an image element: its named slot, or its original file. */
export function mediaKeyOf(element: Element): string | null {
  const slot = element.getAttribute('data-media-slot');
  if (slot) return `slot:${slot}`;
  if (!(element instanceof HTMLImageElement) || element.closest('[data-insert-id]')) return null;
  const src = element.dataset.origSrc ?? element.getAttribute('src');
  return src ? imageKey(src) : null;
}

/** What hides along with an image: the whole frame for photos, the card for card scans. */
export function mediaFrameOf(element: Element): HTMLElement {
  return (element.closest('.photo, .reel-card, .wheel__card, .fan-card, .topic-card__preview, .about__card, .process__stage') as HTMLElement | null) ?? (element as HTMLElement);
}

function applyMedia() {
  for (const element of document.querySelectorAll<HTMLElement>('img, [data-media-slot]')) {
    if (element.closest(SKIP)) continue;
    const key = mediaKeyOf(element);
    if (!key) continue;
    const value = edits.media[key];
    const frame = mediaFrameOf(element);
    if (element instanceof HTMLImageElement) {
      if (value && value !== element.dataset.swapped) {
        if (element.dataset.origSrc === undefined) {
          element.dataset.origSrc = element.getAttribute('src') ?? '';
          element.dataset.origSrcset = element.getAttribute('srcset') ?? '';
        }
        element.removeAttribute('srcset');
        element.src = value;
        element.dataset.swapped = value;
      } else if (!value && element.dataset.swapped) {
        element.src = element.dataset.origSrc ?? element.src;
        if (element.dataset.origSrcset) element.setAttribute('srcset', element.dataset.origSrcset);
        delete element.dataset.swapped;
      }
    } else {
      // An empty frame (the portrait before a photo is published): preview as a background.
      element.style.backgroundImage = value ? `url("${value}")` : '';
      element.classList.toggle('photo--filled', Boolean(value));
    }
    if (value === '') frame.setAttribute('data-media-hidden', '');
    else frame.removeAttribute('data-media-hidden');
  }
}

/** The block an inserted image follows, found by its text inside the section. */
function anchorFor(section: string, after: string): Element | null {
  const root = document.getElementById(section);
  if (!root) return null;
  for (const element of root.querySelectorAll('h2, h3, h4, p, li, blockquote, dd, figcaption')) {
    if (element.closest(SKIP) || element.closest('[data-insert-id]')) continue;
    if (normalize(element.textContent ?? '') === after) {
      // Images go after a whole list, not inside it.
      return element.closest('ul, ol, dl') ?? element;
    }
  }
  return null;
}

function applyInserts() {
  const wanted = new Set(edits.inserts.map((i) => i.id));
  for (const figure of document.querySelectorAll<HTMLElement>('[data-insert-id]')) {
    if (!wanted.has(figure.dataset.insertId!)) figure.remove();
  }
  for (const insert of edits.inserts) {
    let figure = document.querySelector<HTMLElement>(`[data-insert-id="${CSS.escape(insert.id)}"]`);
    const anchor = anchorFor(insert.section, insert.after);
    if (!anchor) continue;
    if (!figure) {
      figure = document.createElement('figure');
      figure.className = 'user-figure';
      figure.dataset.insertId = insert.id;
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      figure.append(img);
    }
    const img = figure.querySelector('img')!;
    if (img.getAttribute('src') !== insert.src) img.src = insert.src;
    img.alt = insert.alt;
    if (anchor.nextElementSibling !== figure) anchor.after(figure);
  }
}

function applyAll() {
  frame = 0;
  observer?.disconnect();
  try {
    applyTexts(document.body);
    applyMedia();
    applyInserts();
  } finally {
    observer?.takeRecords();
    observer?.observe(document.body, { subtree: true, childList: true, characterData: true });
  }
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(applyAll);
};

/** Starts (once) and sets the edits to show; the editor calls it again for previews. */
export function setPageEdits(next: PageEdits) {
  edits = { free: next.free ?? {}, media: next.media ?? {}, inserts: next.inserts ?? [] };
  if (!observer) observer = new MutationObserver(schedule);
  applyAll();
}

export const hasPageEdits = (c: Partial<PageEdits>) =>
  Object.keys(c.free ?? {}).length > 0 || Object.keys(c.media ?? {}).length > 0 || (c.inserts?.length ?? 0) > 0;
