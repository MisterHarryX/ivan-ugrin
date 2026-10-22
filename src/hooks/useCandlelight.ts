import { useEffect, useMemo, useRef, type RefObject } from 'react';

/** Where the flame rests when nobody holds it, as fractions of the stage. */
const REST = { x: 0.52, y: 0.44 };
/** Heavy and slightly underdamped: a flame carried by hand, not glued to the cursor. */
const STIFFNESS = 60;
const DAMPING = 12;
const DUST = 26;

interface Mote {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

/**
 * Candlelight over a dark photograph. Moves `.candle` (a pre-painted pool of light in a
 * sea of darkness) with a spring, so only `transform` and `opacity` change per frame,
 * and draws dust that is visible only inside the light. Mouse pointers carry the
 * flame; otherwise it sways on its own. Runs only while `active`; with reduced motion
 * the light stays still and there is no dust.
 *
 * Returns `origin()`: the flame's position as a CSS `<position>`, so the next photo
 * can spread outward from wherever the light is.
 */
export function useCandlelight(stageRef: RefObject<HTMLElement | null>, active: boolean) {
  const pos = useRef({ ...REST });

  useEffect(() => {
    const stage = stageRef.current;
    const flame = stage?.querySelector<HTMLElement>('.candle');
    const glow = stage?.querySelector<HTMLElement>('.candle__glow');
    const canvas = stage?.querySelector<HTMLCanvasElement>('.candle__dust');
    if (!stage || !flame || !glow || !canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const ctx = canvas.getContext('2d');

    let w = 0;
    let h = 0;
    let radius = 0;
    const p = pos.current;
    const place = (scale = 1) => {
      flame.style.transform = `translate3d(${(p.x * w).toFixed(1)}px, ${(p.y * h).toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
    };
    const resize = () => {
      w = stage.clientWidth;
      h = stage.clientHeight;
      radius = Math.max(w, h) * 0.46;
      // Large enough that darkness still covers the far corner wherever the flame is.
      const size = Math.ceil(Math.hypot(w, h) * 2.2);
      flame.style.width = flame.style.height = `${size}px`;
      flame.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
      flame.style.setProperty('--r', `${radius.toFixed(0)}px`);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      place();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    if (reduced || !active) return () => observer.disconnect();

    const motes: Mote[] = Array.from({ length: DUST }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 1.3,
      speed: 0.008 + Math.random() * 0.018,
      phase: Math.random() * Math.PI * 2,
    }));
    const vel = { x: 0, y: 0 };
    let held: { x: number; y: number } | null = null;
    let frame = 0;
    let last = 0;
    let flutter = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - (last || now)) / 1000, 1 / 30);
      last = now;
      const t = now / 1000;

      // Unheld, the flame drifts in a slow figure, as if someone breathed near it.
      const target = held ?? {
        x: REST.x + 0.08 * Math.sin(t * 0.5) + 0.03 * Math.sin(t * 1.3 + 1),
        y: REST.y + 0.05 * Math.sin(t * 0.37 + 2) + 0.02 * Math.sin(t * 1.7),
      };
      for (const axis of ['x', 'y'] as const) {
        vel[axis] += ((target[axis] - p[axis]) * STIFFNESS - vel[axis] * DAMPING) * dt;
        p[axis] += vel[axis] * dt;
      }

      // Flicker: two steady wobbles plus a smoothed random gust. Fast movement makes it flare.
      flutter += ((Math.random() - 0.5) * 2 - flutter) * Math.min(dt * 9, 1);
      const gust = Math.min(Math.hypot(vel.x, vel.y) * 0.08, 0.04);
      const flicker = 0.014 * Math.sin(t * 9.1) + 0.009 * Math.sin(t * 23.7 + 1.3) + 0.012 * flutter;
      place(1 + flicker - gust);
      glow.style.opacity = (0.82 + flicker * 9 - gust * 3).toFixed(3);

      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        const lx = p.x * w;
        const ly = p.y * h;
        for (const m of motes) {
          m.y -= m.speed * dt;
          if (m.y < -0.05) {
            m.y = 1.05;
            m.x = Math.random();
          }
          const x = (m.x + 0.012 * Math.sin(t * 0.7 + m.phase)) * w;
          const y = m.y * h;
          const lit = 1 - Math.hypot(x - lx, y - ly) / (radius * 0.85);
          if (lit <= 0) continue;
          const alpha = lit * lit * (0.55 + 0.45 * Math.sin(t * 2.3 + m.phase));
          ctx.fillStyle = `rgba(255, 216, 168, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !fine) return;
      const rect = stage.getBoundingClientRect();
      held = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
      stage.dataset.held = 'true';
    };
    const onLeave = () => {
      held = null;
      delete stage.dataset.held;
    };

    stage.addEventListener('pointermove', onMove, { passive: true });
    stage.addEventListener('pointerleave', onLeave);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      delete stage.dataset.held;
    };
  }, [stageRef, active]);

  return useMemo(
    () => ({ origin: () => `${(pos.current.x * 100).toFixed(1)}% ${(pos.current.y * 100).toFixed(1)}%` }),
    [],
  );
}
