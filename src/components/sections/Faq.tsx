import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { site } from '../../config/site.ts';
import { BookingLink } from '../ui/BookingLink.tsx';
import { FaqPlant } from '../ui/Sketches.tsx';

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Wraps matches of the query in <mark>. Only while searching, so at rest every text stays one node. */
function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const at = norm(text).indexOf(norm(query));
  if (at < 0) return text;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + query.length)}</mark>{text.slice(at + query.length)}</>;
}

export function Faq() {
  const { faq } = site;
  const [open, setOpenRaw] = useState<number | null>(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const setOpen = (i: number | null) => { setOpenRaw(i); if (i !== null) setSeen(prev => prev.has(i) ? prev : new Set(prev).add(i)); };
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const tags = useMemo(() => [...new Set(faq.items.map(f => f.tag).filter((t): t is string => Boolean(t)))], [faq.items]);
  const q = query.trim();
  const shown = faq.items.map((f, i) => ({ f, i })).filter(({ f }) => (!tag || f.tag === tag) && (!q || norm(f.question + ' ' + f.answer).includes(norm(q))));

  // Arrow keys move between questions, as in a native accordion.
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, pos: number) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = shown[(pos + step + shown.length) % shown.length];
    buttons.current[next.i]?.focus();
  };

  return <section id="faq" className="section wrap faq-grid">
    <div className="faq-side">
      <p className="eyebrow">Вопросы и ответы</p><h2>{faq.title}</h2><p className="section-lead">{faq.lead}</p>
      <label className="faq-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="m13.2 13.2 3.8 3.8" /></svg><span className="visually-hidden">Поиск по вопросам</span><input type="search" value={query} placeholder="Найти вопрос…" onChange={(e) => { setQuery(e.target.value); setOpen(null); }} />{query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery('')}>×</button>}</label>
      {tags.length > 1 && <div className="faq-tags" role="group" aria-label="Темы вопросов">
        <button aria-pressed={tag === null} onClick={() => setTag(null)}>Все <small>{faq.items.length}</small></button>
        {tags.map(t => <button key={t} aria-pressed={tag === t} onClick={() => { setTag(tag === t ? null : t); setOpen(null); }}>{t} <small>{faq.items.filter(f => f.tag === t).length}</small></button>)}
      </div>}
      <FaqPlant seen={seen} total={faq.items.length} onLeaf={(i) => { setQuery(''); setTag(null); setOpen(i); requestAnimationFrame(() => buttons.current[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' })); }} />
      <div className="faq-ask"><p>Не нашли свой вопрос?</p><span>Задайте его в заявке — отвечу лично.</span><BookingLink variant="link">Спросить ↗</BookingLink></div>
    </div>
    <div className="faq-list" aria-live="polite">
      {shown.map(({ f, i }, pos) => <div className="faq-item" data-open={open === i} key={i}>
        <h3><button ref={(el) => { buttons.current[i] = el; }} aria-expanded={open === i} aria-controls={`faq-answer-${i}`} onClick={() => setOpen(open === i ? null : i)} onKeyDown={(e) => onKey(e, pos)}>
          <span className="faq-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><span className="faq-q">{highlight(f.question, q)}</span><span className="faq-icon" aria-hidden="true" />
        </button></h3>
        <div id={`faq-answer-${i}`} className="faq-answer" role="region" inert={open !== i}><div><p>{highlight(f.answer, q)}</p>{f.tag && <span className="faq-tag">{f.tag}</span>}</div></div>
      </div>)}
      {shown.length === 0 && <div className="faq-empty"><p>Такого вопроса здесь пока нет.</p><span>Это нормально — его можно задать напрямую.</span><BookingLink>Задать свой вопрос <span>↗</span></BookingLink></div>}
    </div>
  </section>;
}
