import { useEffect, useRef, type MutableRefObject } from 'react';

/** What the orb should do right now; written by the breathing section, read every frame. */
export interface BreathDrive {
  mode: 'idle' | 'guided' | 'free';
  /** Guided: scale at the start and end of the current phase, its start time and length (ms). */
  from: number; to: number; start: number; dur: number;
  /** Free rhythm: the visitor is holding (inhaling). */
  holding: boolean; holdStart: number;
}

const TAU = Math.PI * 2;
const easeInOut = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

/**
 * Canvas orb: an organic, slowly wobbling sphere of warm light with motes orbiting it.
 * Its size follows the breathing phase exactly in guided mode and eases after the
 * visitor's hold in free mode. Motes gather close on the inhale and drift out on the exhale,
 * and lean a little towards the pointer. Draws only while on screen.
 */
export function BreathOrb({ drive, scaleOut }: { drive: MutableRefObject<BreathDrive>; scaleOut: MutableRefObject<number> }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motes = Array.from({ length: 64 }, (_, i) => ({ a: (i / 64) * TAU + Math.random(), r: 1.18 + Math.random() * 0.8, sp: (0.06 + Math.random() * 0.12) * (i % 2 ? 1 : -1), size: 0.6 + Math.random() * 1.6, ph: Math.random() * TAU }));
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let size = 0;
    let dpr = 1;
    let scale = 0.8;
    let frame = 0;
    let last = 0;
    let visible = false;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = rect.width;
      el.width = Math.round(rect.width * dpr);
      el.height = Math.round(rect.height * dpr);
    };

    const draw = (now: number) => {
      const dt = Math.min((now - (last || now)) / 1000, 1 / 20);
      last = now;
      const d = drive.current;
      const time = still ? 0 : now / 1000;
      let progress = -1;

      if (d.mode === 'guided') {
        const t = Math.min(1, Math.max(0, (now - d.start) / d.dur));
        scale = d.from + (d.to - d.from) * easeInOut(t);
        progress = t;
      } else if (d.mode === 'free') {
        const target = d.holding ? 1 : 0.55;
        scale += (target - scale) * (1 - Math.exp(-dt / (d.holding ? 1.25 : 1.6)));
        if (d.holding) progress = Math.min(1, (now - d.holdStart) / 6000);
      } else {
        const idle = 0.8 + (still ? 0 : Math.sin(now / 1000 * 0.9) * 0.035);
        scale += (idle - scale) * (1 - Math.exp(-dt / 0.6));
      }
      scaleOut.current = scale;

      pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 4));
      pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 4));

      const w = size;
      const c = w / 2;
      const base = w * 0.3;
      const R = base * scale;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, w);

      // Guide rings
      ctx.lineWidth = 1;
      for (const [k, a] of [[0.47, 0.1], [0.4, 0.07], [0.33, 0.05]]) {
        ctx.strokeStyle = `rgba(242,236,225,${a})`;
        ctx.beginPath(); ctx.arc(c, c, w * k, 0, TAU); ctx.stroke();
      }
      ctx.save();
      ctx.setLineDash([2, 7]);
      ctx.strokeStyle = 'rgba(226,194,144,.22)';
      ctx.beginPath(); ctx.arc(c, c, w * 0.435, time * 0.05, time * 0.05 + TAU); ctx.stroke();
      ctx.restore();

      // Phase progress on the outer ring
      if (progress >= 0) {
        ctx.strokeStyle = 'rgba(226,194,144,.95)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(c, c, w * 0.47, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(progress, 0.002)); ctx.stroke();
      }

      // Halo
      const halo = ctx.createRadialGradient(c, c, R * 0.6, c, c, R * 2);
      halo.addColorStop(0, `rgba(240,200,143,${0.28 + 0.12 * scale})`);
      halo.addColorStop(1, 'rgba(240,200,143,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(c, c, R * 2, 0, TAU); ctx.fill();

      // Organic body
      const ox = pointer.x * w * 0.012;
      const oy = pointer.y * w * 0.012;
      ctx.beginPath();
      for (let i = 0; i <= 96; i++) {
        const th = (i / 96) * TAU;
        const wob = 1 + 0.016 * Math.sin(3 * th + time * 0.8) + 0.01 * Math.sin(5 * th - time * 1.1) + 0.006 * Math.sin(8 * th + time * 0.6);
        const x = c + ox + Math.cos(th) * R * wob;
        const y = c + oy + Math.sin(th) * R * wob;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      const body = ctx.createRadialGradient(c - R * 0.35 + ox, c - R * 0.4 + oy, R * 0.05, c + ox, c + oy, R * 1.05);
      body.addColorStop(0, '#fff4de');
      body.addColorStop(0.35, '#f1c98f');
      body.addColorStop(0.72, '#d48c64');
      body.addColorStop(1, '#8f5340');
      ctx.fillStyle = body;
      ctx.fill();

      // Motes: close on the inhale, spread on the exhale, leaning towards the pointer
      const spread = 1.35 - 0.45 * scale;
      for (const m of motes) {
        if (!still) m.a += m.sp * dt * (d.mode === 'idle' ? 1 : 1.6);
        const r = base * m.r * spread * (1 + 0.04 * Math.sin(time * 1.3 + m.ph)) + R * 0.35;
        const x = c + Math.cos(m.a) * r + pointer.x * w * 0.03;
        const y = c + Math.sin(m.a) * r + pointer.y * w * 0.03;
        const alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(time * 2 + m.ph));
        ctx.fillStyle = `rgba(255,226,170,${alpha})`;
        ctx.beginPath(); ctx.arc(x, y, m.size, 0, TAU); ctx.fill();
      }

      frame = visible ? requestAnimationFrame(draw) : 0;
      if (!frame) last = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(draw);
    });
    io.observe(el);
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const rect = el.getBoundingClientRect();
      pointer.tx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
      pointer.ty = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { cancelAnimationFrame(frame); ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMove); };
  }, [drive, scaleOut]);

  return <canvas ref={canvas} className="breathe__canvas" aria-hidden="true" />;
}
