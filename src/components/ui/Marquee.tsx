import { useEffect, useRef, useState, type ReactNode } from 'react';

const SPEED = 38; // px per second while drifting
const EASE = 6; // how quickly speed settles towards its target (1/s)

/**
 * A slow line of words that always keeps moving: hover only slows it down,
 * drag moves it by hand and lets go with momentum, the pause button stops it for good.
 * Position is written straight to the track's transform: one element, no style recalculation.
 */
export function Marquee({ label, children }: { label: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const wakeRef = useRef<() => void>(() => {});
  pausedRef.current = paused;

  useEffect(() => {
    const el = root.current;
    const line = track.current;
    if (!el || !line) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) setPaused(true);

    let x = 0;
    let speed = reduced ? 0 : SPEED;
    let hover = false;
    let drag: { id: number; last: number; t: number; v: number } | null = null;
    let frame = 0;
    let last = 0;
    let visible = true;

    const width = () => line.scrollWidth / 2;
    const wrap = () => { const w = width(); if (w > 0) { x %= w; if (x > 0) x -= w; } };
    const paint = () => { line.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`; };

    // Scrolling the page pushes the line along, in the direction of the scroll; the push fades quickly.
    let boost = 0;
    let lastY = window.scrollY;
    const onScroll = () => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      if (hover || pausedRef.current || reduced) return;
      boost = Math.max(-900, Math.min(900, boost + dy * 4));
      wake();
    };

    const tick = (now: number) => {
      const dt = Math.min((now - (last || now)) / 1000, 1 / 20);
      last = now;
      boost *= Math.exp(-3 * dt);
      if (!drag) {
        // Under the mouse the line slows to a third so it can be read, but never stops on its own.
        const target = pausedRef.current ? 0 : hover ? -SPEED / 3 : -SPEED - boost;
        speed += (target - speed) * (1 - Math.exp(-EASE * dt));
        x += speed * dt;
        wrap();
        paint();
      }
      const settled = !drag && Math.abs(speed) < 0.5 && Math.abs(boost) < 1 && pausedRef.current;
      frame = visible && !settled ? requestAnimationFrame(tick) : 0;
      if (!frame) last = 0;
    };
    const wake = () => { if (!frame && visible) frame = requestAnimationFrame(tick); };
    wakeRef.current = wake;

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); });
    io.observe(el);

    const onEnter = (e: PointerEvent) => { if (e.pointerType === 'mouse') { hover = true; wake(); } };
    const onLeave = (e: PointerEvent) => { if (e.pointerType === 'mouse') { hover = false; wake(); } };
    const onDown = (e: PointerEvent) => {
      if (drag || e.button !== 0) return; // one pointer at a time
      drag = { id: e.pointerId, last: e.clientX, t: performance.now(), v: 0 };
      el.setPointerCapture(e.pointerId);
      el.dataset.dragging = '';
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const now = performance.now();
      const dx = e.clientX - drag.last;
      drag.v = dx / Math.max((now - drag.t) / 1000, 1 / 120);
      drag.last = e.clientX;
      drag.t = now;
      x += dx;
      wrap();
      paint();
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      speed = Math.max(-1600, Math.min(1600, drag.v)); // flick carries on, then eases back to drift
      drag = null;
      delete el.dataset.dragging;
      wake();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    paint();
    wake();
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // The loop sleeps once settled; a change of the pause button wakes it to ease in or out.
  useEffect(() => { wakeRef.current(); }, [paused]);

  return <div className="marquee" role="region" aria-label={label}>
    <div className="marquee__viewport" ref={root}>
      <div className="marquee__track" ref={track}><div className="marquee__row">{children}</div><div className="marquee__row" aria-hidden="true">{children}</div></div>
    </div>
    <button className="marquee__toggle" aria-pressed={paused} aria-label={paused ? 'Продолжить движение строки' : 'Остановить строку'} onClick={() => setPaused(p => !p)}>
      {paused ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z" /></svg> : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5h2v9H5zM9 3.5h2v9H9z" /></svg>}
    </button>
  </div>;
}
