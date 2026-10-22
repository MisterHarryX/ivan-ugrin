import type { CSSProperties } from 'react';

/*
 * The harmony sign Ivan sent: a twelve-petal lotus around a six-pointed star.
 * Drawn as lines (pathLength=1) so each layer can be drawn in on its own.
 * `level` lights the layers one by one — the five stages of «Преображение»:
 * 1 the inner circle, 2 the downward triangle, 3 the upward one, 4 the petals, 5 everything glows.
 */
const R = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) => `${(r * Math.cos(R(deg))).toFixed(2)} ${(r * Math.sin(R(deg))).toFixed(2)}`;

const tri = (start: number, r: number) => `M${pt(r, start)} L${pt(r, start + 120)} L${pt(r, start + 240)} Z`;
const UP = tri(-90, 50);
const DOWN = tri(90, 50);

/** One lotus petal: rises from the ring, bends outward into a small hooked tip, as in the drawing. */
function petal(a: number) {
  const w = 13;
  return `M${pt(60, a - w)} C${pt(80, a - w - 2)} ${pt(86, a - 9)} ${pt(90, a - 4)} L${pt(96, a)} L${pt(90, a + 4)} C${pt(86, a + 9)} ${pt(80, a + w + 2)} ${pt(60, a + w)}`;
}
const PETALS = Array.from({ length: 12 }, (_, i) => petal(i * 30 - 90));
/** Short broken strokes between star and lotus — the "gaps" of the original ornament. */
const TICKS = Array.from({ length: 6 }, (_, i) => {
  const a = i * 60 - 60;
  return `M${pt(40, a - 14)} L${pt(52, a - 7)} M${pt(52, a + 7)} L${pt(40, a + 14)}`;
});

function shapes(level: number) {
  return <>
    <circle className="anahata__layer anahata__ring" data-on={level >= 1} r="30" pathLength={1} />
    <circle className="anahata__layer anahata__ring anahata__ring--outer" data-on={level >= 1} r="60" pathLength={1} />
    <path className="anahata__layer anahata__tri" data-on={level >= 2} d={DOWN} pathLength={1} />
    <path className="anahata__layer anahata__tri anahata__tri--up" data-on={level >= 3} d={UP} pathLength={1} />
    {TICKS.map((d, i) => <path key={`t${i}`} className="anahata__layer anahata__tick" data-on={level >= 3} d={d} pathLength={1} />)}
    {PETALS.map((d, i) => <path key={`p${i}`} className="anahata__layer anahata__petal" data-on={level >= 4} d={d} pathLength={1} style={{ '--i': i } as CSSProperties} />)}
  </>;
}

export function Anahata({ level = 5, className = '', spin = false, style }: { level?: number; className?: string; spin?: boolean; style?: CSSProperties }) {
  return (
    <svg className={`anahata ${className}`} viewBox="-110 -110 220 220" data-level={level} data-spin={spin || undefined} style={style} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="anahata-glow">
          <stop offset="0" style={{ stopColor: "var(--c-gold)", stopOpacity: .55 }} />
          <stop offset=".6" style={{ stopColor: "var(--c-amethyst)", stopOpacity: .18 }} />
          <stop offset="1" style={{ stopColor: "var(--c-amethyst)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <circle className="anahata__glow" r="104" fill="url(#anahata-glow)" />
      <g className="anahata__rotor">
        <g className="anahata__ghost">{shapes(0)}</g>
        <g className="anahata__live">{shapes(level)}</g>
      </g>
      <circle className="anahata__core" data-on={level >= 5} r="7" />
    </svg>
  );
}
