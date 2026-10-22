import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export interface DropInfo {
  /** The element marked [data-drop] under the pointer, if any. */
  zone: HTMLElement | null;
  x: number;
  y: number;
  /** Where inside the dragged card the pointer grabbed it (for the schedule's time snap). */
  grabY: number;
}

/**
 * Pointer drag for cards: after a small move a ghost copy follows the pointer and the
 * [data-drop] zone beneath gets data-over. Works with mouse, pen and touch (long press
 * is not needed: touch-action on cards keeps vertical scrolling until a sideways move).
 */
export function useCardDrag(onDrop: (id: string, info: DropInfo) => void) {
  const suppress = useRef(false);

  const onPointerDown = useCallback(
    (id: string) => (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      // Links and fields inside a card keep working; the card's own cover button lets drags through.
      const control = (event.target as Element).closest('a, button, input, select, textarea');
      if (control && !control.hasAttribute('data-drag-through')) return;
      const card = event.currentTarget;
      const startX = event.clientX;
      const startY = event.clientY;
      const rect = card.getBoundingClientRect();
      const grabY = startY - rect.top;
      let ghost: HTMLElement | null = null;
      let over: HTMLElement | null = null;

      const zoneAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null) ?? null;

      const move = (e: PointerEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!ghost) {
          if (Math.hypot(dx, dy) < 7) return;
          ghost = card.cloneNode(true) as HTMLElement;
          ghost.classList.add('a-ghost');
          Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` });
          document.body.append(ghost);
          card.dataset.dragging = 'true';
          document.documentElement.dataset.dragging = 'true';
        }
        e.preventDefault();
        ghost.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-4, Math.min(4, dx / 60))}deg)`;
        const zone = zoneAt(e.clientX, e.clientY);
        if (zone !== over) {
          if (over) {
            delete over.dataset.over;
            over.dispatchEvent(new CustomEvent('a-dragleave', { bubbles: true }));
          }
          if (zone) zone.dataset.over = 'true';
          over = zone;
        }
        // Zones that draw their own preview (the calendar) hide the ghost: what you see is where it lands.
        ghost.style.opacity = zone?.dataset.ghost === 'hide' ? '0' : '';
        if (zone) zone.dispatchEvent(new CustomEvent('a-dragover', { bubbles: true, detail: { id, y: e.clientY, grabY } }));
      };

      const up = (e: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (!ghost) return;
        if (over) delete over.dataset.over;
        delete card.dataset.dragging;
        delete document.documentElement.dataset.dragging;
        ghost.remove();
        suppress.current = true;
        window.setTimeout(() => (suppress.current = false), 0);
        if (e.type === 'pointerup') onDrop(id, { zone: zoneAt(e.clientX, e.clientY), x: e.clientX, y: e.clientY, grabY });
      };

      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [onDrop],
  );

  /** Wrap click handlers so the click that ends a drag does nothing. */
  const guard = useCallback((handler: () => void) => () => !suppress.current && handler(), []);

  return { onPointerDown, guard };
}
