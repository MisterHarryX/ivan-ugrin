import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { EMPTY_OVERRIDES, type ContentOverrides, type Insert } from '../../shared/content.ts';
import { site } from '../config/site.ts';
import { contactDisplay } from '../lib/contacts.ts';
import { formatPrice } from '../lib/format.ts';
import { mediaFrameOf, mediaKeyOf, originalText, setPageEdits } from '../lib/liveLayer.ts';
import { editableEntries, getPristine, getPublished } from '../lib/pristine.ts';
import { normalize, replaceOnPage, sectionLabel, textNodeAt, textRect, type TextRef } from './dom.ts';
import { ContactsPanel, MediaPopover, PhotosPanel, TextsPanel, type ContactValues, type MediaItem } from './panels.tsx';
import { TextPopover, type TextTarget } from './TextPopover.tsx';
import { pickImage, uploadPhoto } from './upload.ts';
import './site-admin.css';

type Kind = 'telegram' | 'max';
const KINDS: Kind[] = ['telegram', 'max'];

interface Drafts {
  /** Config path → new value, or null = back to the code's text. */
  texts: Record<string, string | number | null>;
  /** Original wording → new wording, or null = back to the original. */
  free: Record<string, string | null>;
  /** Image key → new URL, "" = hidden, null = back to the original image. */
  media: Record<string, string | null>;
  /** The full list of inserted images once changed; null = unchanged. */
  inserts: Insert[] | null;
  contacts: Partial<Record<Kind, string | null>>;
}
const NO_DRAFTS: Drafts = { texts: {}, free: {}, media: {}, inserts: null, contacts: {} };

type Hover =
  | { kind: 'text'; refs: TextRef[]; rect: DOMRect; shown: string }
  | { kind: 'free'; key: string; rect: DOMRect; shown: string; area: string }
  | { kind: 'contacts'; rect: DOMRect }
  | { kind: 'media'; element: Element; rect: DOMRect; label: string }
  | { kind: 'insert-spot'; anchor: Element; section: string; rect: DOMRect };
type PanelId = 'texts' | 'contacts' | 'photos' | null;

const FLASH_KEY = 'psy-admin-flash';

const AREA_NAMES: Record<string, string> = {
  about: 'Обо мне',
  topics: 'Темы',
  gallery: 'Пространство',
  services: 'Цены',
  process: 'Как проходит',
  reflection: 'Рефлексия',
  resources: 'Заметки',
  testimonials: 'Отзывы',
  faq: 'Вопросы',
  booking: 'Запись',
  header: 'Шапка',
  footer: 'Подвал',
  hero: 'Первый экран',
};

function areaOf(element: Element | null) {
  if (!element) return 'Страница';
  if (element.closest('.hero')) return AREA_NAMES.hero;
  const section = element.closest('section[id]');
  if (section) return AREA_NAMES[section.id] ?? section.id;
  if (element.closest('header')) return AREA_NAMES.header;
  if (element.closest('footer')) return AREA_NAMES.footer;
  return 'Страница';
}

/** "Карта «Луна» · везде на сайте", "Темы · Три карты на подносе", "Обо мне · портрет". */
function mediaLabel(key: string, element: Element, img: HTMLImageElement | null) {
  if (key.startsWith('slot:')) return `${areaOf(element)} · портрет`;
  return `${areaOf(element)}${img?.alt ? ` · ${img.alt.slice(0, 60)}` : ''}`;
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Elements a new photo can follow, and where an editable page area starts. */
const BLOCKS = 'h2, h3, h4, p, li, blockquote, dd';
const PAGE = 'main, .site-header, .site-footer';

/**
 * The reader's floating toolbar on the live site (ported from ICG and extended): every
 * text on the page can be clicked and rewritten, every photo replaced, hidden or brought
 * back, the empty portrait filled, new photos inserted after any paragraph. Everything
 * previews at once and goes live with one «Опубликовать».
 */
export function AdminBar({ onHide, onLogout }: { onHide: () => void; onLogout: () => void }) {
  const pristine = useMemo(() => getPristine() ?? { site: structuredClone(site) }, []);
  const [overrides, setOverrides] = useState<ContentOverrides | null>(null);
  const [fresh, setFresh] = useState(0);
  const [drafts, setDrafts] = useState<Drafts>(NO_DRAFTS);
  const [editing, setEditing] = useState(() => new URLSearchParams(location.search).has('edit'));
  const [inserting, setInserting] = useState(false);
  const [panel, setPanel] = useState<PanelId>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [popover, setPopover] = useState<TextTarget | null>(null);
  const [mediaPop, setMediaPop] = useState<{ item: MediaItem; rect: DOMRect } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(() => {
    const flash = sessionStorage.getItem(FLASH_KEY);
    sessionStorage.removeItem(FLASH_KEY);
    return flash ? { text: flash, tone: 'ok' } : null;
  });
  const [publishing, setPublishing] = useState(false);
  const [listVersion, setListVersion] = useState(0);

  // --- What is published, and how many new requests wait ------------------------------

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/content', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Partial<ContentOverrides>) => !cancelled && setOverrides({ ...EMPTY_OVERRIDES, ...data }))
      .catch(() => !cancelled && setOverrides({ ...EMPTY_OVERRIDES, ...getPublished() }));
    const loadFresh = () =>
      fetch('/api/admin/requests', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { items: { status: string }[] } | null) => data && !cancelled && setFresh(data.items.filter((i) => i.status === 'new').length))
        .catch(() => {});
    loadFresh();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && loadFresh(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  /** Code values, as strings for the editors. */
  const base = useMemo(() => Object.fromEntries(Object.entries(editableEntries(pristine)).map(([p, v]) => [p, String(v)])), [pristine]);
  const published = overrides ?? { ...EMPTY_OVERRIDES, ...getPublished() };

  /** Config path → what the page shows right now (code + published + drafts). */
  const values = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [path, code] of Object.entries(base)) {
      const draft = drafts.texts[path];
      out[path] = path in drafts.texts ? String(draft ?? code) : String(published.texts[path] ?? code);
    }
    return out;
  }, [base, published.texts, drafts.texts]);

  /** Published edits with drafts on top, the way the page should look now. */
  const merged = useMemo(() => {
    const free: Record<string, string> = { ...published.free };
    for (const [k, v] of Object.entries(drafts.free)) {
      if (v === null) delete free[k];
      else free[k] = v;
    }
    const media: Record<string, string> = { ...published.media };
    for (const [k, v] of Object.entries(drafts.media)) {
      if (v === null) delete media[k];
      else media[k] = v;
    }
    return { free, media, inserts: drafts.inserts ?? published.inserts };
  }, [published.free, published.media, published.inserts, drafts.free, drafts.media, drafts.inserts]);

  // Free texts, photos and inserted images preview through the same layer that shows them to visitors.
  useEffect(() => {
    if (!overrides) return;
    setPageEdits(merged);
    setListVersion((v) => v + 1);
  }, [merged, overrides]);

  /** Shown config text → where it comes from, to recognise text under the pointer. */
  const index = useMemo(() => {
    const map = new Map<string, TextRef[]>();
    const add = (text: string, ref: TextRef) => {
      const key = normalize(text);
      if (key.length >= 2) map.set(key, [...(map.get(key) ?? []), ref]);
    };
    for (const [path, text] of Object.entries(values)) {
      if (path.endsWith('price.amount')) {
        const item = site.services.items[Number(path.split('.')[2])];
        if (item) add(formatPrice({ ...item.price, amount: Number(text) }), { path, price: true });
        continue;
      }
      // The headline renders as separate lines without the *accent* marks.
      const plain = text.replace(/\*/g, '');
      add(plain, { path });
      if (plain.includes('\n')) plain.split('\n').forEach((line, i) => add(line, { path, line: i }));
    }
    return map;
  }, [values]);

  const changedTexts = useMemo(() => new Set(Object.keys(values).filter((p) => values[p] !== base[p])), [values, base]);

  const baseContact = useCallback((kind: Kind) => pristine.site.contacts.find((c) => c.kind === kind)?.value ?? '', [pristine]);
  const contacts: ContactValues = {
    telegram: drafts.contacts.telegram !== undefined ? (drafts.contacts.telegram ?? baseContact('telegram')) : (published.contacts.telegram ?? baseContact('telegram')),
    max: drafts.contacts.max !== undefined ? (drafts.contacts.max ?? baseContact('max')) : (published.contacts.max ?? baseContact('max')),
  };
  const contactKey = KINDS.map((kind) => contacts[kind]).join('|');
  const contactShown = useMemo(
    () => new Set(contactKey.split('|').map((value, i) => normalize(contactDisplay({ kind: KINDS[i], value }))).filter(Boolean)),
    [contactKey],
  );

  const insertsChanged = drafts.inserts !== null && JSON.stringify(drafts.inserts) !== JSON.stringify(published.inserts);
  const draftCount =
    Object.keys(drafts.texts).length + Object.keys(drafts.free).length + Object.keys(drafts.media).length + Object.keys(drafts.contacts).length + (insertsChanged ? 1 : 0);

  // --- Drafts: texts ------------------------------------------------------------------------

  const applyText = useCallback(
    (refs: TextRef[], value: string) => {
      setDrafts((current) => {
        const texts = { ...current.texts };
        for (const { path, line } of refs) {
          let next = value;
          if (line !== undefined) {
            const lines = values[path].split('\n');
            lines[line] = value;
            next = lines.join('\n');
          }
          const live = String(published.texts[path] ?? base[path]);
          if (next === live) delete texts[path];
          else texts[path] = next === base[path] ? null : path.endsWith('price.amount') ? Number(next) : next;
        }
        return { ...current, texts };
      });
    },
    [base, published.texts, values],
  );

  const applyFree = useCallback(
    (key: string, value: string) => {
      setDrafts((current) => {
        const free = { ...current.free };
        const live = published.free[key] ?? key;
        if (normalize(value) === normalize(live)) delete free[key];
        else free[key] = normalize(value) === key ? null : value.trim();
        return { ...current, free };
      });
    },
    [published.free],
  );

  /** Edits from the list also update every place the text shows. */
  const applyFromList = (path: string, value: string) => {
    if (path.endsWith('price.amount')) {
      const item = site.services.items[Number(path.split('.')[2])];
      if (item) replaceOnPage(formatPrice({ ...item.price, amount: Number(values[path]) }), formatPrice({ ...item.price, amount: Number(value) }));
    } else {
      const before = values[path].replace(/\*/g, '').split('\n');
      const after = value.replace(/\*/g, '').split('\n');
      if (before.length === after.length && before.length > 1) before.forEach((line, i) => replaceOnPage(line, after[i]));
      else replaceOnPage(values[path].replace(/\*/g, ''), value.replace(/\*/g, ''));
    }
    applyText([{ path }], value);
  };

  const applyContacts = (next: ContactValues) => {
    for (const kind of KINDS) {
      const before = contactDisplay({ kind, value: contacts[kind] });
      const after = contactDisplay({ kind, value: next[kind] || baseContact(kind) });
      if (before !== after) replaceOnPage(before, after);
    }
    setDrafts((current) => {
      const draft = { ...current.contacts };
      for (const kind of KINDS) {
        const value = next[kind] || baseContact(kind);
        const live = published.contacts[kind] ?? baseContact(kind);
        if (value === live) delete draft[kind];
        else draft[kind] = value === baseContact(kind) ? null : value;
      }
      return { ...current, contacts: draft };
    });
  };

  // --- Drafts: photos -----------------------------------------------------------------------

  const setMedia = (key: string, value: string | null) =>
    setDrafts((current) => {
      const media = { ...current.media };
      const live = published.media[key];
      if ((value === null && live === undefined) || value === live) delete media[key];
      else media[key] = value;
      return { ...current, media };
    });

  const setInserts = (update: (list: Insert[]) => Insert[]) => setDrafts((current) => ({ ...current, inserts: update(current.inserts ?? published.inserts) }));

  /** Picks a file, uploads it and hands back the URL; null when cancelled or failed. */
  const choosePhoto = async (busyKey: string) => {
    const file = await pickImage();
    if (!file) return null;
    setBusy(busyKey);
    try {
      return await uploadPhoto(file);
    } catch (reason) {
      setToast({ text: reason instanceof Error ? reason.message : 'Не удалось загрузить фото.', tone: 'error' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const replacePhoto = async (item: MediaItem) => {
    const url = await choosePhoto(item.key);
    if (!url) return;
    if (item.insert) setInserts((list) => list.map((i) => (i.id === item.key ? { ...i, src: url } : i)));
    else setMedia(item.key, url);
    setMediaPop(null);
  };

  const insertPhoto = async (anchor: Element, section: string) => {
    setInserting(false);
    const url = await choosePhoto('insert');
    if (!url) return;
    const after = normalize(anchor.textContent ?? '');
    const id = `i${Date.now().toString(36)}`;
    setInserts((list) => [...list, { id, section, after, src: url, alt: '' }]);
    setToast({ text: 'Фото вставлено. Опубликуйте, чтобы его увидели посетители.', tone: 'ok' });
  };

  /** Every image on the page (hidden ones too) and every inserted photo, for the list and the popover. */
  const mediaItems = useMemo((): MediaItem[] => {
    void listVersion;
    const seen = new Map<string, MediaItem>();
    for (const element of document.querySelectorAll('main img, main [data-media-slot], .site-header img, .site-footer img')) {
      if (element.closest('[data-site-admin], [data-insert-id]')) continue;
      const key = mediaKeyOf(element);
      if (!key || seen.has(key)) continue;
      const value = merged.media[key];
      const img = element instanceof HTMLImageElement ? element : null;
      const isSlot = key.startsWith('slot:');
      const filledSlot = isSlot && (Boolean(value) || Boolean(img));
      seen.set(key, {
        key,
        thumb: value || img?.currentSrc || img?.src || '',
        label: mediaLabel(key, element, img),
        state: value === '' ? 'hidden' : value ? 'replaced' : isSlot && !filledSlot ? 'empty' : 'original',
      });
    }
    const inserted = merged.inserts.map((i) => ({ key: i.id, insert: true, thumb: i.src, label: `${AREA_NAMES[i.section] ?? i.section} · вставленное фото`, state: 'inserted' as const }));
    return [...inserted, ...seen.values()];
  }, [merged, listVersion]);

  const mediaItemFor = (element: Element): MediaItem | null => {
    const figure = element.closest('[data-insert-id]') as HTMLElement | null;
    if (figure) return mediaItems.find((i) => i.key === figure.dataset.insertId) ?? null;
    const key = mediaKeyOf(element);
    return key ? (mediaItems.find((i) => i.key === key) ?? null) : null;
  };

  // --- Publish / discard --------------------------------------------------------------------

  const publish = useCallback(async () => {
    if (!draftCount || publishing || !overrides) return;
    setPublishing(true);
    const texts: ContentOverrides['texts'] = { ...overrides.texts };
    for (const [path, value] of Object.entries(drafts.texts)) {
      if (value === null) delete texts[path];
      else texts[path] = value;
    }
    const nextContacts: ContentOverrides['contacts'] = { ...overrides.contacts };
    for (const [kind, value] of Object.entries(drafts.contacts) as [Kind, string | null][]) {
      if (value === null) delete nextContacts[kind];
      else nextContacts[kind] = value;
    }
    try {
      const response = await fetch('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...overrides, texts, free: merged.free, media: merged.media, inserts: merged.inserts, contacts: nextContacts }),
      });
      if (!response.ok) {
        const { error } = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error === 'storage-unavailable' ? 'Хранилище не подключено: правки нельзя сохранить.' : error === 'unauthorized' ? 'Сессия закончилась — войдите снова.' : '');
      }
      setDrafts(NO_DRAFTS);
      // Re-render from the published config so every component shows the new version.
      sessionStorage.setItem(FLASH_KEY, 'Опубликовано. Посетители уже видят изменения.');
      location.reload();
    } catch (reason) {
      setToast({ text: reason instanceof Error && reason.message ? reason.message : 'Не получилось опубликовать. Попробуйте ещё раз.', tone: 'error' });
      setPublishing(false);
    }
  }, [draftCount, drafts, merged, overrides, publishing]);

  const discard = () => {
    if (!window.confirm('Отменить все неопубликованные правки?')) return;
    location.reload();
  };

  const logout = async () => {
    if (draftCount && !window.confirm('Есть неопубликованные правки. Всё равно выйти?')) return;
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    onLogout();
    location.reload();
  };

  // Warn before leaving with unpublished work; Ctrl/⌘+S publishes.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (draftCount && !publishing) event.preventDefault();
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void publish();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('keydown', onKey);
    };
  }, [draftCount, publish, publishing]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // --- Edit mode: hover and click anything ------------------------------------------------------

  useEffect(() => {
    if ((!editing && !inserting) || popover || mediaPop) return;
    const root = document.documentElement;
    root.dataset.siteEditing = '';
    let frame = 0;
    let lastX = -1;
    let lastY = -1;

    const hitTest = (x: number, y: number): Hover | null => {
      const under = document.elementFromPoint(x, y);
      if (!under || under.closest('[data-site-admin]') || !under.closest(PAGE)) return null;

      if (inserting) {
        const block = under.closest(BLOCKS);
        const section = block?.closest('main section[id]');
        if (!block || !section || block.closest('[data-insert-id], form, .a-card, nav')) return null;
        const anchor = block.closest('ul, ol, dl') ?? block;
        return { kind: 'insert-spot', anchor: block, section: section.id, rect: anchor.getBoundingClientRect() };
      }

      const node = textNodeAt(x, y);
      if (node) {
        const shown = normalize(node.nodeValue ?? '');
        if (contactShown.has(shown)) return { kind: 'contacts', rect: textRect(node) };
        const refs = index.get(shown);
        if (refs) return { kind: 'text', refs, rect: textRect(node), shown };
        const original = normalize(originalText(node));
        if (original.length >= 2 && /[\p{L}\d]/u.test(original) && node.parentElement?.closest(PAGE)) {
          return { kind: 'free', key: original, rect: textRect(node), shown, area: areaOf(node.parentElement) };
        }
      }

      for (const element of document.elementsFromPoint(x, y)) {
        if (element.closest('[data-site-admin]')) return null;
        if (element.matches('img, [data-media-slot]') || element.closest('[data-insert-id]')) {
          const target = (element.closest('[data-insert-id]') as Element | null) ?? element;
          const frameEl = target.closest('[data-insert-id]') ? target : mediaFrameOf(target);
          const img = target instanceof HTMLImageElement ? target : target.querySelector('img');
          return { kind: 'media', element: target, rect: frameEl.getBoundingClientRect(), label: `${areaOf(target)} · ${img?.alt ? 'фото' : target.hasAttribute('data-media-slot') ? 'портрет' : 'фото'}` };
        }
      }
      return null;
    };

    const update = () => {
      frame = 0;
      const next = hitTest(lastX, lastY);
      setHover(next);
      root.toggleAttribute('data-site-hover', Boolean(next));
    };
    const onMove = (event: PointerEvent) => {
      lastX = event.clientX;
      lastY = event.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onScroll = () => {
      if (lastX >= 0 && !frame) frame = requestAnimationFrame(update);
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element).closest?.('[data-site-admin]')) return;
      const hit = hitTest(event.clientX, event.clientY);
      if (!hit) return;
      // Editing wins over the page's own behaviour (links, accordions, cards…).
      event.preventDefault();
      event.stopPropagation();
      if (hit.kind === 'insert-spot') return void insertPhoto(hit.anchor, hit.section);
      if (hit.kind === 'contacts') return setPanel('contacts');
      if (hit.kind === 'media') {
        const item = mediaItemFor(hit.element);
        if (item) setMediaPop({ item, rect: hit.rect });
        return;
      }
      if (hit.kind === 'free') {
        setPopover({ refs: [{ path: `free:${hit.area}` }], value: hit.shown, original: hit.key, shown: hit.shown, rect: hit.rect, display: (v) => v, freeKey: hit.key });
        return;
      }
      const ref = hit.refs[0];
      if (ref.price) {
        const item = site.services.items[Number(ref.path.split('.')[2])];
        const display = (amount: string) => formatPrice({ ...item.price, amount: Number(amount) || 0 });
        setPopover({ refs: hit.refs, value: values[ref.path], original: base[ref.path], shown: hit.shown, rect: hit.rect, display });
        return;
      }
      const code = base[ref.path].replace(/\*/g, '');
      const original = ref.line !== undefined ? (code.split('\n')[ref.line] ?? hit.shown) : code;
      setPopover({ refs: hit.refs, value: hit.shown, original, shown: hit.shown, rect: hit.rect, display: (v) => v });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[data-site-admin][role=dialog]')) return;
      if (inserting) setInserting(false);
      else setEditing(false);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      setHover(null);
      delete root.dataset.siteEditing;
      root.removeAttribute('data-site-hover');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('keydown', onKey);
    };
    // insertPhoto and mediaItemFor read the latest drafts through state setters and mediaItems.
  }, [editing, inserting, popover, mediaPop, index, base, values, contactShown, mediaItems]);

  const showOnPage = (item: MediaItem) => {
    const element = item.insert
      ? document.querySelector(`[data-insert-id="${CSS.escape(item.key)}"]`)
      : [...document.querySelectorAll('main img, main [data-media-slot]')].find((el) => mediaKeyOf(el) === item.key);
    const frameEl = element && !item.insert ? mediaFrameOf(element) : element;
    if (!frameEl) return;
    frameEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    frameEl.animate([{ outline: '2px solid var(--c-gold)', outlineOffset: '6px' }, { outline: '2px solid transparent', outlineOffset: '14px' }], { duration: 1400, easing: 'ease-out' });
  };

  const ready = overrides !== null;
  const outline = hover && (editing || inserting) && !popover && !mediaPop ? hover : null;
  const outlineLabel = (h: Hover) => {
    switch (h.kind) {
      case 'text':
        return `${sectionLabel(h.refs[0].path)}${h.refs.some((r) => changedTexts.has(r.path)) ? ' · изменено' : ''}`;
      case 'free':
        return `${h.area}${merged.free[h.key] !== undefined ? ' · изменено' : ''}`;
      case 'contacts':
        return 'Контакты';
      case 'media':
        return `${h.label} · заменить или скрыть`;
      case 'insert-spot':
        return '+ вставить фото после этого';
    }
  };

  return (
    <>
      {outline && outline.kind !== 'insert-spot' && (
        <div
          data-site-admin
          aria-hidden="true"
          className="sa-outline"
          data-kind={outline.kind}
          style={{ top: outline.rect.top - 4, left: outline.rect.left - 6, width: outline.rect.width + 12, height: outline.rect.height + 8 }}
        >
          <span>{outlineLabel(outline)}</span>
        </div>
      )}
      {outline && outline.kind === 'insert-spot' && (
        <div data-site-admin aria-hidden="true" className="sa-insert-line" style={{ top: outline.rect.bottom + 8, left: outline.rect.left, width: outline.rect.width }}>
          <span>{outlineLabel(outline)}</span>
        </div>
      )}
      {popover && (
        <div data-site-admin aria-hidden="true" className="sa-outline sa-outline--fixed" style={{ top: popover.rect.top - 4, left: popover.rect.left - 6, width: popover.rect.width + 12, height: popover.rect.height + 8 }} />
      )}
      {popover && (
        <TextPopover
          target={popover}
          onApply={(refs, value) => (popover.freeKey ? applyFree(popover.freeKey, value) : applyText(refs, value))}
          onClose={() => setPopover(null)}
        />
      )}
      {mediaPop && (
        <MediaPopover
          item={mediaPop.item}
          rect={mediaPop.rect}
          busy={busy === mediaPop.item.key}
          onReplace={() => void replacePhoto(mediaPop.item)}
          onHide={() => {
            setMedia(mediaPop.item.key, '');
            setMediaPop(null);
          }}
          onRestore={() => {
            setMedia(mediaPop.item.key, null);
            setMediaPop(null);
          }}
          onRemove={() => {
            setInserts((list) => list.filter((i) => i.id !== mediaPop.item.key));
            setMediaPop(null);
          }}
          onClose={() => setMediaPop(null)}
        />
      )}

      {panel === 'texts' && <TextsPanel values={values} original={base} changed={changedTexts} onApply={applyFromList} onClose={() => setPanel(null)} />}
      {panel === 'contacts' && <ContactsPanel value={contacts} onApply={applyContacts} onClose={() => setPanel(null)} />}
      {panel === 'photos' && (
        <PhotosPanel
          items={mediaItems}
          busyKey={busy}
          onReplace={(item) => void replacePhoto(item)}
          onHide={(item) => setMedia(item.key, '')}
          onRestore={(item) => setMedia(item.key, null)}
          onRemove={(item) => setInserts((list) => list.filter((i) => i.id !== item.key))}
          onShow={showOnPage}
          onClose={() => setPanel(null)}
        />
      )}

      {(editing || inserting) && !outline && !popover && !panel && !mediaPop && (
        <p data-site-admin className="sa-hint">
          {inserting
            ? 'Наведите на абзац — фото встанет сразу после него · Esc — отмена'
            : busy === 'insert'
              ? 'Загружаю фото…'
              : 'Нажмите на любой текст или фото, чтобы изменить · Esc — выйти'}
        </p>
      )}
      {toast && (
        <p data-site-admin role="status" className="sa-toast" data-tone={toast.tone}>
          {toast.text}
        </p>
      )}

      <div data-site-admin role="toolbar" aria-label="Редактор сайта специалиста" className="sa-bar">
        <span className="sa-bar__brand">
          <span className="sa-bar__moon" aria-hidden="true" />
          {site.meta.brand}
        </span>
        <Divider />
        <BarLink href="/admin#requests" icon={<path d="M4 6.5h12M4 10h12M4 13.5h7" />} label="Заявки">
          Заявки
          {fresh > 0 && <span className="sa-bar__badge">{fresh}</span>}
        </BarLink>
        <BarLink href="/admin#stats" icon={<path d="M3 15V9m4.5 6V5m4.5 10v-4m4.5 4V3" />} label="Статистика">
          Статистика
        </BarLink>
        <Divider />
        <BarButton
          active={editing && !inserting}
          disabled={!ready}
          onClick={() => {
            setInserting(false);
            setEditing((v) => !v);
            setPanel(null);
          }}
          icon={<path d="m12.5 3.5 4 4L7 17H3v-4zM10.5 5.5l4 4" />}
        >
          {editing && !inserting ? 'Редактирую' : 'Редактировать'}
        </BarButton>
        <BarButton
          active={inserting}
          disabled={!ready || busy === 'insert'}
          onClick={() => {
            setInserting((v) => !v);
            setPanel(null);
          }}
          label="Вставить фото"
          icon={
            <>
              <rect x="3" y="4" width="14" height="12" rx="1.5" />
              <path d="M10 7.5v5M7.5 10h5" />
            </>
          }
        >
          {busy === 'insert' ? 'Загружаю…' : 'Вставить фото'}
        </BarButton>
        <BarButton
          active={panel === 'photos'}
          disabled={!ready}
          onClick={() => {
            setListVersion((v) => v + 1);
            setPanel(panel === 'photos' ? null : 'photos');
          }}
          label="Фото"
          icon={
            <>
              <rect x="3" y="4" width="14" height="12" rx="1.5" />
              <path d="m3.5 13.5 4-4 3 3 2-2 4 4" />
            </>
          }
        >
          Фото
        </BarButton>
        <BarButton active={panel === 'texts'} disabled={!ready} onClick={() => setPanel(panel === 'texts' ? null : 'texts')} label="Тексты" icon={<path d="M4 5h12M4 10h12M4 15h7" />}>
          Тексты
        </BarButton>
        <BarButton
          active={panel === 'contacts'}
          disabled={!ready}
          onClick={() => setPanel(panel === 'contacts' ? null : 'contacts')}
          label="Контакты"
          icon={<path d="M5.5 3h2.5l1.2 3.2-1.6 1.2a9 9 0 0 0 5 5l1.2-1.6L17 12v2.5a1.5 1.5 0 0 1-1.5 1.5A12.5 12.5 0 0 1 4 4.5 1.5 1.5 0 0 1 5.5 3z" />}
        >
          Контакты
        </BarButton>
        <Divider />
        {draftCount > 0 ? (
          <>
            <span className="sa-bar__count">
              {draftCount} {plural(draftCount, 'правка', 'правки', 'правок')}
            </span>
            <button type="button" className="sa-bar__item" onClick={discard}>
              Отменить
            </button>
          </>
        ) : (
          <span className="sa-bar__count sa-bar__count--quiet">Всё опубликовано</span>
        )}
        <button type="button" className="sa-bar__publish" onClick={publish} disabled={!draftCount || publishing} title="Ctrl + S">
          {publishing ? 'Публикую…' : 'Опубликовать'}
        </button>
        <Divider />
        <button type="button" className="sa-bar__item" onClick={logout}>
          Выйти
        </button>
        <button
          type="button"
          className="sa-bar__item sa-bar__hide"
          onClick={() => {
            setEditing(false);
            setInserting(false);
            setPanel(null);
            onHide();
          }}
          aria-label="Скрыть панель (вернуть — ключом в подвале)"
          title="Скрыть панель"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 6.5 8 10.5l4-4" />
          </svg>
        </button>
      </div>
    </>
  );
}

const Divider = () => <span aria-hidden="true" className="sa-bar__divider" />;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function BarButton({ active, disabled, onClick, icon, label, children }: { active: boolean; disabled?: boolean; onClick: () => void; icon: ReactNode; label?: string; children: ReactNode }) {
  return (
    <button type="button" className="sa-bar__item" onClick={onClick} disabled={disabled} aria-pressed={active} aria-label={label} title={label}>
      <Icon>{icon}</Icon>
      <span className="sa-bar__label">{children}</span>
    </button>
  );
}

function BarLink({ href, icon, label, children }: { href: string; icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <a className="sa-bar__item" href={href} aria-label={label} title={label}>
      <Icon>{icon}</Icon>
      <span className="sa-bar__label">{children}</span>
    </a>
  );
}
