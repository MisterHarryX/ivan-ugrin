import { useEffect, type RefObject } from 'react';

/**
 * Soft light that trails the mouse across the dark page. Desktop pointers only,
 * off for reduced motion; positions are eased on animation frames and written
 * to CSS variables on a single fixed element.
 */
export function useCursorGlow() {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = document.getElementById('cursor-glow');
    if (!fine || reduced || !el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    let tx = x;
    let ty = y;
    let frame = 0;

    const tick = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (event: PointerEvent) => {
      tx = event.clientX;
      ty = event.clientY;
      el.dataset.active = 'true';
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      el.dataset.active = 'false';
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);
}

/**
 * Spring-driven pointer parallax. Children marked `data-depth="x,y"` drift by
 * that many pixels at the screen edges. A small spring (stiffness 170,
 * damping 26) gives the motion weight instead of sticking to the cursor, and
 * each layer's `translate` is written directly so no parent variable forces a
 * style recalculation of the whole subtree.
 */
export function useParallax(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!root || !fine || reduced) return;

    const layers = [...root.querySelectorAll<HTMLElement>('[data-depth]')].map((el) => {
      const [dx, dy] = (el.dataset.depth ?? '0,0').split(',').map(Number);
      return { el, dx, dy };
    });
    const STIFFNESS = 170;
    const DAMPING = 26;
    const pos = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let frame = 0;
    let last = 0;

    const step = (now: number) => {
      const dt = Math.min((now - (last || now)) / 1000, 1 / 30);
      last = now;
      for (const axis of ['x', 'y'] as const) {
        const force = (target[axis] - pos[axis]) * STIFFNESS - vel[axis] * DAMPING;
        vel[axis] += force * dt;
        pos[axis] += vel[axis] * dt;
      }
      for (const { el, dx, dy } of layers) {
        el.style.translate = `${(pos.x * dx).toFixed(2)}px ${(pos.y * dy).toFixed(2)}px`;
      }
      const settled =
        Math.abs(target.x - pos.x) < 0.001 && Math.abs(target.y - pos.y) < 0.001 && Math.abs(vel.x) < 0.001 && Math.abs(vel.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(step);
      if (settled) last = 0;
    };

    const onMove = (event: PointerEvent) => {
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = (event.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(step);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, [ref]);
}
