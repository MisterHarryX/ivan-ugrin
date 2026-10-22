import { useCallback, type PointerEvent } from 'react';

const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Pointer-driven tilt and light position for cards. Writes CSS variables only;
 * the visual response lives in CSS and is disabled for touch and reduced motion.
 */
export function useTilt(maxDeg = 7) {
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse' || !finePointer()) return;
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      el.style.setProperty('--tilt-x', `${((0.5 - py) * maxDeg * 2).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${((px - 0.5) * maxDeg * 2).toFixed(2)}deg`);
      el.style.setProperty('--light-x', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--light-y', `${(py * 100).toFixed(1)}%`);
    },
    [maxDeg],
  );

  const onPointerLeave = useCallback((event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--tilt-x', '0deg');
    event.currentTarget.style.setProperty('--tilt-y', '0deg');
  }, []);

  return { onPointerMove, onPointerLeave };
}

/** Pointer position inside an element as --spot-x / --spot-y, for spotlight hovers. */
export function spotlight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return;
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
  el.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
}
