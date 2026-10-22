import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { site } from '../../config/site.ts';
import { Anahata } from '../ui/Anahata.tsx';

const STAGE_MS = 6500;

/**
 * «Преображение»: the vital circle (consciousness → feelings → thoughts → desires → actions)
 * around Ivan's harmony sign. Each of the five stages adds a layer to the sign, so by the fifth
 * the ornament is whole — the method's own promise of integrity, shown rather than told.
 * Stages advance on their own while on screen, until the reader picks one; any point of the
 * circle can be opened to see how work may start there.
 */
export function Method() {
  const { method } = site;
  const total = method.stages.length;
  const [stage, setStage] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(true);
  const [entry, setEntry] = useState(0);
  const [tool, setTool] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setAuto(false); setStage(total - 1); return; }
    const io = new IntersectionObserver(([e]) => setPaused(!e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [total]);
  useEffect(() => {
    if (!auto || paused) return;
    const t = window.setTimeout(() => setStage(s => (s + 1) % total), STAGE_MS);
    return () => window.clearTimeout(t);
  }, [auto, paused, stage, total]);

  const choose = (i: number) => { setAuto(false); setStage(i); };
  const s = method.stages[stage];
  const point = method.circle[entry];

  return <section id="method" className="section method">
    <div className="method__aura" aria-hidden="true" />
    <div className="wrap">
      <div className="section-top"><p className="eyebrow">Авторский метод</p></div>
      <div className="heading-row"><h2 className="method__title"><span className="method__name">«{method.name}»</span><span className="method__subtitle">{method.subtitle}</span></h2><p>{method.lead}</p></div>

      <div className="method-grid" ref={root} data-auto={auto && !paused} style={{ '--stage-ms': `${STAGE_MS}ms`, '--progress': (stage + 1) / total } as CSSProperties}>
        <div className="wheel-col">
          <div className="wheel" data-stage={stage + 1}>
            <svg className="wheel__track" viewBox="0 0 400 400" aria-hidden="true">
              <circle cx="200" cy="200" r="168" className="wheel__base" />
              <circle cx="200" cy="200" r="168" className="wheel__fill" pathLength={1} />
              <circle cx="200" cy="200" r="190" className="wheel__dash" />
            </svg>
            <span className="wheel__orbit" aria-hidden="true"><i /></span>
            <Anahata level={stage + 1} className="wheel__sign" />
            <p className="wheel__caption" aria-hidden="true"><b key={stage}>{stage === total - 1 ? 'Целостность' : s.title}</b><span>этап {stage + 1} из {total}</span></p>
            <div className="wheel__nodes" role="tablist" aria-label="Витальный круг: с чего можно начать">
              {method.circle.map((c, i) => {
                const a = -90 + i * (360 / method.circle.length);
                return <button key={c.id} role="tab" aria-selected={entry === i} aria-controls="wheel-entry" className="wheel__node" style={{ '--x': Math.cos((a * Math.PI) / 180).toFixed(4), '--y': Math.sin((a * Math.PI) / 180).toFixed(4) } as CSSProperties} onClick={() => setEntry(i)}>
                  <span className="wheel__dot" aria-hidden="true" /><span className="wheel__label">{c.label}</span>
                </button>;
              })}
            </div>
          </div>
          <div id="wheel-entry" className="wheel-entry" role="tabpanel" aria-live="polite">
            <p className="eyebrow">Начать можно {point.entry}</p>
            <p key={entry} className="wheel-entry__text"><strong>{point.label}.</strong> {point.text}</p>
          </div>
        </div>

        <div className="stages">
          <p className="stages__intro">{method.intro}</p>
          <ol className="stages__list" aria-label="Пять этапов преображения">
            <span className="stages__rail" aria-hidden="true"><i /></span>
            {method.stages.map((st, i) => <li key={st.title}>
              <button aria-expanded={stage === i} aria-controls="stage-detail" data-done={i < stage} onClick={() => choose(i)}>
                <span className="stages__num" aria-hidden="true">{i < stage ? '✓' : `0${i + 1}`}</span>
                <span className="stages__name"><strong>{st.title}</strong><small>{st.short}</small></span>
                {stage === i && <span className="stages__timer" aria-hidden="true" key={`${stage}-${auto}`} />}
              </button>
            </li>)}
          </ol>
          <div id="stage-detail" className="stage-card" aria-live="polite">
            <div key={stage} className="stage-card__body">
              <p className="stage-card__kicker">Этап {stage + 1} · {s.short}</p>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <blockquote>{s.question}</blockquote>
            </div>
            <div className="stage-card__nav">
              <button aria-label="Предыдущий этап" onClick={() => choose((stage - 1 + total) % total)}>←</button>
              <button aria-label="Следующий этап" onClick={() => choose((stage + 1) % total)}>→</button>
            </div>
          </div>
        </div>
      </div>

      <div className="tools">
        <div className="tools__head"><p className="eyebrow">Опорные методы</p><p>Конкретные методы подбираются индивидуально и обсуждаются на первой консультации.</p></div>
        <ul className="tools__list">{method.tools.map((t, i) => <li key={t.title}>
          <button className="tool" aria-expanded={tool === i} onClick={() => setTool(tool === i ? null : i)} onMouseEnter={() => setTool(i)} onMouseLeave={() => setTool(null)} style={{ '--i': i } as CSSProperties}>
            <span className="tool__num" aria-hidden="true">0{i + 1}</span><strong>{t.title}</strong><span className="tool__text">{t.text}</span>
          </button>
        </li>)}</ul>
      </div>

    </div>
  </section>;
}
