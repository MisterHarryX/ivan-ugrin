import { useEffect } from 'react';

/**
 * Blocks that rise into place the first time they scroll into view. Hero content is
 * left out: it has its own orchestrated entrance. Photos use the scroll-linked
 * `.photo--reveal` instead.
 */
const SELECTOR = [
  '.section .eyebrow',
  '.heading-row > p',
  '.section-lead',
  '.topic-card',
  '.about-intro > p',
  '.about-tile',
  '.about-sign',
  '.process-steps > button',
  '.step-detail',
  '.service',
  '.services__note',
  '.interlude__copy > *',
  '.reflection-options > button',
  '.reflection-visual',
  '.breathe__patterns',
  '.notes__list > button',
  '.reader',
  '.faq-search',
  '.faq-tags',
  '.faq-ask',
  '.resource',
  '.faq-item',
  '.booking__intro > :not(.letter)',
  '.composer',
].join(',');

/** Siblings entering together cascade by this much, up to MAX_STAGGER steps. */
const STAGGER_MS = 50;
const MAX_STAGGER = 5;

/**
 * One-shot reveal on scroll. Hidden styles apply only under `html[data-reveal]`, which
 * is set here, so without JavaScript or with reduced motion everything is simply visible.
 * Elements already on screen at load are left as they are, so nothing flashes.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    const viewport = window.innerHeight;
    const matched = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
    // A block inside another revealed block would move twice; the outer one carries it.
    const targets = matched.filter(
      (el) => el.getBoundingClientRect().top > viewport && !matched.some((other) => other !== el && other.contains(el)),
    );
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const arriving = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as HTMLElement);
        // Stagger among siblings that arrive in the same frame, in document order.
        const byParent = new Map<Element | null, HTMLElement[]>();
        for (const el of arriving) {
          const group = byParent.get(el.parentElement) ?? [];
          group.push(el);
          byParent.set(el.parentElement, group);
        }
        for (const group of byParent.values()) {
          group.forEach((el, i) => {
            el.style.setProperty('--reveal-delay', `${Math.min(i, MAX_STAGGER) * STAGGER_MS}ms`);
            el.dataset.revealed = 'true';
            observer.unobserve(el);
          });
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );

    for (const el of targets) {
      el.dataset.revealed = 'false';
      observer.observe(el);
    }
    root.dataset.reveal = '';

    return () => {
      observer.disconnect();
      delete root.dataset.reveal;
      for (const el of targets) delete el.dataset.revealed;
    };
  }, []);
}
