import type { TrackPayload } from '../../shared/analytics.ts';
import { track } from './api.ts';

/** Section id (or header/footer) a link sits in, for "where do people click Telegram". */
function placeOf(element: Element) {
  const area = element.closest('section[id], header, footer, nav');
  if (!area) return 'page';
  return area.id || area.tagName.toLowerCase();
}

/**
 * Cookie-free visit analytics (ported from ICG): one pageview, clicks to Telegram,
 * WhatsApp and e-mail, and on leave how long the tab was visible plus which sections
 * reached the screen. Device and country are worked out on the server.
 */
export function startTracking() {
  const params = new URLSearchParams(location.search);
  const context: Partial<TrackPayload> = {
    path: location.pathname,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: navigator.language,
    sw: screen.width,
    touch: navigator.maxTouchPoints ?? 0,
  };

  track({ ...context, type: 'pageview', ref: document.referrer || undefined, utm: params.get('utm_source') ?? undefined });

  document.addEventListener(
    'click',
    (event) => {
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!link) return;
      const href = link.getAttribute('href') ?? '';
      // Links to the project channels are interest, not a request to Ivan: counted apart.
      const type = link.closest('#project')
        ? /^(https?:)?\/\/(t\.me|dzen\.ru|(www\.)?youtube\.com)\//i.test(href) ? 'channel' : null
        : /^(https?:)?\/\/(t\.me|telegram\.me)\//i.test(href)
          ? 'telegram'
          : /^(https?:)?\/\/(www\.)?max\.ru\//i.test(href) || href.startsWith('tel:')
            ? 'max'
            : /^(https?:)?\/\/(www\.)?b17\.ru\//i.test(href)
              ? 'b17'
              : null;
      if (type) track({ ...context, type, place: placeOf(link) });
    },
    { capture: true },
  );

  // Sections that were at least a third on screen.
  const seen = new Set<string>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) seen.add((entry.target as HTMLElement).id || 'footer');
    },
    { threshold: [0, 0.35], rootMargin: '-30% 0px -30% 0px' },
  );
  document.querySelectorAll('main section[id], footer').forEach((element) => observer.observe(element));

  // Visible time, flushed whenever the tab is hidden (the reliable "leave" signal on mobile).
  let visibleSince = document.visibilityState === 'visible' ? performance.now() : 0;
  let pending = 0;
  const flush = () => {
    if (visibleSince) {
      pending += performance.now() - visibleSince;
      visibleSince = 0;
    }
    const dur = Math.round(pending / 1000);
    if (dur < 1 && seen.size === 0) return;
    track({ ...context, type: 'engage', dur, seen: [...seen] });
    pending = 0;
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else visibleSince = performance.now();
  });
  window.addEventListener('pagehide', flush);
}
