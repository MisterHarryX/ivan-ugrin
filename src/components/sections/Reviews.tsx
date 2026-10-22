import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { site } from '../../config/site.ts';
import type { Review } from '../../config/types.ts';
import { useInView } from '../../hooks/useInView.ts';
import { useReducedMotion } from '../../hooks/useReducedMotion.ts';
import { BookingLink } from '../ui/BookingLink.tsx';

const number = new Intl.NumberFormat('ru-RU');
const THROW_MS = 340;

/** Counts up once when the section is first seen; a plain number with reduced motion. */
function CountUp({ to, run }: { to: number; run: boolean }) {
  const [n, setN] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!run) return;
    if (reduced) { setN(to); return; }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1500);
      setN(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, to, reduced]);
  return <>{number.format(n)}</>;
}

/** The review text with its key phrase wrapped in a marker that sweeps in once the card is on top. */
function ReviewText({ review }: { review: Review }) {
  return <>{review.text.split('\n').filter(Boolean).map((line, i) => {
    const at = review.highlight ? line.indexOf(review.highlight) : -1;
    let content: ReactNode = line;
    if (at >= 0 && review.highlight) content = <>{line.slice(0, at)}<mark className="rv-mark">{review.highlight}</mark>{line.slice(at + review.highlight.length)}</>;
    return <p key={i}>{content}</p>;
  })}</>;
}

/**
 * Reviews from B17 as a deck of cards. The top card can be dragged aside (or flicked, or moved
 * with the arrows and the keyboard); the next one rises from the stack. Topics filter the deck.
 * Each review keeps its author's words; one phrase is lit with a gold marker.
 */
export function Reviews() {
  const { reviews } = site;
  const sectionRef = useRef<HTMLElement>(null);
  const seen = useInView(sectionRef, '-20% 0px');
  const [counted, setCounted] = useState(false);
  if (seen && !counted) setCounted(true);
  const [topic, setTopic] = useState<string | null>(null);
  const deck = useMemo(() => reviews.items.filter(r => !topic || r.tags.includes(topic)), [reviews.items, topic]);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [thrown, setThrown] = useState<0 | 1 | -1>(0);
  const [entering, setEntering] = useState<0 | 1 | -1>(0);
  const start = useRef<{ x: number; t: number; id: number } | null>(null);

  const total = deck.length;
  const at = (k: number) => deck[((index + k) % total + total) % total];

  const go = (dir: 1 | -1) => {
    if (thrown || total < 2) return;
    setThrown(dir);
    window.setTimeout(() => { setIndex(i => (i + dir + total) % total); setThrown(0); setDrag(0); setEntering(dir); }, THROW_MS);
  };
  const choose = (t: string | null) => { setTopic(t); setIndex(0); setDrag(0); setThrown(0); setEntering(1); };

  const onDown = (e: PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    start.current = { x: e.clientX, t: performance.now(), id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLElement>) => { if (start.current?.id === e.pointerId) setDrag(e.clientX - start.current.x); };
  const onUp = (e: PointerEvent<HTMLElement>) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const v = Math.abs(dx) / Math.max(1, performance.now() - s.t);
    if (Math.abs(dx) > 110 || (Math.abs(dx) > 30 && v > 0.5)) go(dx < 0 ? 1 : -1);
    else setDrag(0);
  };

  const top = total ? at(0) : null;

  return <section ref={sectionRef} id="reviews" className="section reviews" data-seen={counted || undefined} aria-labelledby="reviews-title">
    <div className="reviews__glow" aria-hidden="true" />
    <div className="wrap reviews__grid">
      <div className="reviews__side">
        <p className="eyebrow">Отзывы</p>
        <h2 id="reviews-title">{reviews.title}</h2>
        <p className="section-lead">{reviews.lead}</p>
        <div className="rv-topics" role="group" aria-label="Темы отзывов">
          <button type="button" aria-pressed={topic === null} onClick={() => choose(null)}>Все <small>{reviews.items.length}</small></button>
          {reviews.topics.map(t => <button type="button" key={t} aria-pressed={topic === t} onClick={() => choose(topic === t ? null : t)}>{t} <small>{reviews.items.filter(r => r.tags.includes(t)).length}</small></button>)}
        </div>
        <dl className="rv-facts">{reviews.facts.map((f, i) => <div key={f.label} style={{ '--i': i } as CSSProperties}><dd><CountUp to={f.value} run={counted} /></dd><dt>{f.label}</dt></div>)}</dl>
        <p className="rv-award"><span aria-hidden="true">✦</span>{reviews.award}</p>
      </div>

      <div className="rv-stage" role="region" aria-roledescription="колода отзывов" aria-label="Отзывы клиентов" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } }}>
        <div className="rv-deck">
          {total > 2 && <article className="rv-card rv-card--back" style={{ '--d': 2 } as CSSProperties} aria-hidden="true" key={`b2-${at(2).name}`} />}
          {total > 1 && <article className="rv-card rv-card--back" style={{ '--d': 1 } as CSSProperties} aria-hidden="true" key={`b1-${at(1).name}`}><header className="rv-card__head"><strong>{at(1).name}</strong></header></article>}
          {top && <article key={`${topic}-${index}`} className="rv-card rv-card--top" data-thrown={thrown || undefined} data-enter={entering || undefined} data-dragging={drag !== 0 || undefined}
            style={{ '--dx': `${drag}px`, '--rot': `${drag / 22}deg` } as CSSProperties}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { start.current = null; setDrag(0); }}
            aria-live="polite">
            <header className="rv-card__head">
              <div><strong>{top.name}</strong><span>{top.context ? `${top.context} · ` : ''}{top.date}</span></div>
              <span className="rv-card__source">{reviews.source}</span>
            </header>
            <div className="rv-card__tags">{top.tags.map(t => <span key={t}>{t}</span>)}</div>
            <div className="rv-card__text"><ReviewText review={top} /></div>
            <span className="rv-card__hint" aria-hidden="true">← потяните карточку →</span>
          </article>}
        </div>
        <div className="rv-controls">
          <button type="button" className="rv-arrow" onClick={() => go(-1)} aria-label="Предыдущий отзыв" disabled={total < 2}>←</button>
          <span className="rv-count"><b key={index}>{String(index + 1).padStart(2, '0')}</b> / {String(total).padStart(2, '0')}</span>
          <span className="rv-dots" aria-hidden="true">{deck.map((r, i) => <i key={r.name + i} data-on={i === index || undefined} />)}</span>
          <button type="button" className="rv-arrow" onClick={() => go(1)} aria-label="Следующий отзыв" disabled={total < 2}>→</button>
        </div>
        <div className="rv-foot">
          <a className="text-link" href={reviews.url} target="_blank" rel="noopener noreferrer">Все {reviews.total} ↗</a>
          <BookingLink variant="link">Записаться на консультацию ↗</BookingLink>
        </div>
      </div>
    </div>
  </section>;
}
