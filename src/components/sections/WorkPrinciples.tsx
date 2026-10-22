import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { site } from '../../config/site.ts';

const CYCLE_MS = 6500;

/** One line drawing per principle; every stroke draws itself when its panel opens. */
const ART: string[][] = [
  // Бережливость: cupped hands holding a sprout
  ['M18 72c10 20 28 28 42 28s32-8 42-28', 'M18 72c5-5 12-4 16 2l8 10', 'M102 72c-5-5-12-4-16 2l-8 10', 'M60 86V48', 'M60 62c-13 0-19-8-19-19 13 0 19 8 19 19Z', 'M60 55c11 0 17-7 17-17-11 0-17 7-17 17Z'],
  // Ответственность: an anchor — holding steady
  ['M60 36v58', 'M60 20a8 8 0 1 1 0 16a8 8 0 1 1 0-16', 'M44 46h32', 'M28 72c4 15 17 24 32 24s28-9 32-24', 'M28 72l-7 7M28 72l9 4', 'M92 72l7 7M92 72l-9 4'],
  // Внимательность: an open eye
  ['M12 60c12-20 29-31 48-31s36 11 48 31c-12 20-29 31-48 31S24 80 12 60Z', 'M60 45a15 15 0 1 1 0 30a15 15 0 1 1 0-30', 'M60 54a6 6 0 1 1 0 12a6 6 0 1 1 0-12'],
  // Профессионализм: an open book
  ['M60 34v58', 'M60 34c-11-8-27-10-43-6v58c16-4 32-2 43 6', 'M60 34c11-8 27-10 43-6v58c-16-4-32-2-43 6', 'M27 46c8-1 16 0 23 3M27 58c8-1 16 0 23 3M27 70c8-1 16 0 23 3', 'M70 49c7-3 15-4 23-3M70 61c7-3 15-4 23-3M70 73c7-3 15-4 23-3'],
  // Эффективность: a target with an arrow in its centre
  ['M54 26a40 40 0 1 1 0 80a40 40 0 1 1 0-80', 'M54 40a26 26 0 1 1 0 52a26 26 0 1 1 0-52', 'M54 54a12 12 0 1 1 0 24a12 12 0 1 1 0-24', 'M54 66 100 20', 'M100 20H86M100 20v14'],
];

/**
 * «Принципы моей работы»: five panels side by side. The open one widens, draws its picture and
 * shows Ivan's text; the others stay as narrow spines with a number and a vertical title.
 * Panels advance on their own while on screen, until the reader picks one. On phones — an accordion.
 */
export function WorkPrinciples() {
  const { principles } = site;
  const total = principles.items.length;
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 850px)').matches) setAuto(false);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!auto || !visible) return;
    const t = window.setTimeout(() => setActive(a => (a + 1) % total), CYCLE_MS);
    return () => window.clearTimeout(t);
  }, [auto, visible, active, total]);

  const pick = (i: number) => { setAuto(false); setActive(i); };

  return <section id="principles" className="section wprinciples">
    <div className="wrap">
      <div className="heading-row"><div><p className="eyebrow">Как я работаю</p><h2>{principles.title}</h2></div><p>Пять опор, на которых строится каждая встреча. Нажмите на любую.</p></div>
      <div className="wp-panels" ref={root} data-auto={auto && visible} style={{ '--cycle': `${CYCLE_MS}ms` } as CSSProperties}>
        {principles.items.map((p, i) => <div key={p.title} className="wp-panel" data-active={active === i || undefined} style={{ '--i': i } as CSSProperties}>
          <button type="button" className="wp-panel__hit" aria-expanded={active === i} aria-controls={`wp-text-${i}`} onClick={() => pick(i)} onMouseEnter={() => { if (!auto) setActive(i); }}>
            <span className="wp-panel__num">0{i + 1}</span>
            <span className="wp-panel__spine">{p.title}</span>
          </button>
          <div className="wp-panel__body" id={`wp-text-${i}`} inert={active !== i}>
            <svg className="wp-panel__art" viewBox="0 0 120 120" aria-hidden="true">{ART[i % ART.length].map((d, k) => <path key={k} d={d} pathLength={1} style={{ '--k': k } as CSSProperties} />)}</svg>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </div>
          {active === i && <span className="wp-panel__timer" aria-hidden="true" key={`${active}-${auto}`} />}
        </div>)}
      </div>
    </div>
  </section>;
}
