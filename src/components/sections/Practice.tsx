import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { site } from '../../config/site.ts';
import { formatPrice } from '../../lib/format.ts';
import { useParallax } from '../../hooks/useCursorGlow.ts';
import { Marquee } from '../ui/Marquee.tsx';
import { HeroFilm } from '../ui/HeroFilm.tsx';
import { BookingLink } from '../ui/BookingLink.tsx';
import { Modal } from '../ui/Modal.tsx';
import { TopicGlyph } from '../ui/Glyphs.tsx';
import { PrincipleArt, ServiceSketch, StepSketch } from '../ui/Sketches.tsx';
import { Anahata } from '../ui/Anahata.tsx';
import { asset } from '../../lib/paths.ts';

/** Motes of dust drifting through the window light; positions are fixed so the render is stable. */
const MOTES = [[12, 18, 9], [24, 62, 14], [38, 30, 11], [52, 74, 17], [61, 22, 10], [70, 55, 13], [82, 35, 16], [90, 70, 12], [46, 12, 15], [8, 80, 18], [30, 88, 13], [76, 8, 11]];

type HeroBreath = 'idle' | 'in' | 'out' | 'done';

/** One slow breath with the page: the arch light swells for four seconds and settles for six. */
function useHeroBreath() {
  const [phase, setPhase] = useState<HeroBreath>('idle');
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (phase !== 'in' && phase !== 'out') return;
    const secs = phase === 'in' ? 4 : 6;
    const start = performance.now();
    setLeft(secs);
    const tick = window.setInterval(() => setLeft(Math.max(1, secs - Math.floor((performance.now() - start) / 1000))), 200);
    const next = window.setTimeout(() => setPhase(phase === 'in' ? 'out' : 'done'), secs * 1000);
    return () => { window.clearInterval(tick); window.clearTimeout(next); };
  }, [phase]);
  return { phase, left, start: () => setPhase('in') };
}

/** Steps through the hero phrases while the first screen is visible: in, hold, out, next. */
function useAccentCycle(count: number) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  useEffect(() => {
    if (count < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setTimeout(() => {
      if (phase === 'in') setPhase('out');
      else { setIndex(i => (i + 1) % count); setPhase('in'); }
    }, phase === 'in' ? 4200 : 520);
    return () => window.clearTimeout(t);
  }, [phase, count]);
  return { index, phase };
}

/** The changing second line: letters arrive out of a blur, then a gold marker sweeps under them. */
function HeroAccent({ words, index, phase }: { words: string[]; index: number; phase: 'in' | 'out' }) {
  const word = words[index] ?? '';
  // Long phrases shrink to fit the column instead of wrapping onto a second line.
  return <em className="hero-accent" key={index} data-phase={phase} aria-live="polite" style={{ '--n': Math.max(word.length, 12) } as CSSProperties}>
    <span className="hero-accent__marker" aria-hidden="true" />
    <span className="visually-hidden">{word}</span>
    <span className="hero-accent__letters" aria-hidden="true">{[...word].map((ch, i) => <span key={i} style={{ '--i': i } as CSSProperties}>{ch === ' ' ? ' ' : ch}</span>)}</span>
  </em>;
}

/** Counts up once, a moment after the portrait has opened. */
function HeroCount({ to, delay }: { to: number; delay: number }) {
  const [n, setN] = useState(to);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    setN(0);
    const timer = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1600);
        setN(Math.round(to * (1 - Math.pow(1 - p, 4))));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [to, delay]);
  // The final number, invisible, keeps the line from twitching while the digits grow.
  return <><span aria-hidden="true">{to}</span><span>{n}</span></>;
}

export function Hero() {
  const { hero } = site;
  const visual = useRef<HTMLDivElement>(null);
  useParallax(visual);
  const breath = useHeroBreath();
  const accent = useAccentCycle(hero.accents.length);
  const chip = breath.phase === 'in' ? <>Вдох… <b>{breath.left}</b></> : breath.phase === 'out' ? <>Выдох… <b>{breath.left}</b></> : breath.phase === 'done' ? 'Спасибо. Ещё раз?' : 'Сделайте медленный вдох';
  return <section id="hero" className="hero">
    <div className="sunlight" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="motes" aria-hidden="true">{MOTES.map(([x, y, d], i) => <span key={i} style={{ '--x': `${x}%`, '--y': `${y}%`, '--d': `${d}s`, '--delay': `${-i * 1.7}s` } as CSSProperties} />)}</div>
    <div className="wrap hero__grid">
      <div className="hero__copy">
        <h1><span className="line"><span>{hero.headline}</span></span><span className="line line--accent"><HeroAccent words={hero.accents} index={accent.index} phase={accent.phase} /></span></h1>
        <svg className="hero__underline" viewBox="0 0 320 18" aria-hidden="true"><path d="M4 12C60 4 120 4 170 9s110 6 146-2" pathLength={1} /></svg>
        <p className="hero__lead">{hero.lead}</p>
        <div className="hero__actions"><BookingLink>{hero.primaryAction}<span className="btn__arrow">↗</span></BookingLink><a className="quiet-link" href="#method">{hero.secondaryAction}<span>↓</span></a></div>
        <ul className="hero__trust" aria-label="Форматы работы">{hero.formats.map(f => <li key={f.title}><a href={f.href}>
          <b>{f.title}{f.accent && <em>{f.accent}</em>}</b>
          {f.place && <small>{f.place}</small>}
          {f.lines.map(line => <span key={line}>{line}</span>)}
        </a></li>)}</ul>
      </div>
      <div className="hero__visual" data-breath={breath.phase}>
        <div className="hero__stage" ref={visual}>
          <div className="hero__halo" aria-hidden="true" data-depth="-10,-8" />
          <Anahata level={5} spin className="hero__sign" />
          <div className="hero__frame" data-depth="-6,-5">
            <svg className="hero__outline" viewBox="-24 -24 488 488" aria-hidden="true"><path d="M220 -6a226 226 0 1 1 0 452a226 226 0 1 1 0-452" pathLength={1} /><path className="hero__outline--far" d="M220 -18a238 238 0 1 0 0 476a238 238 0 1 0 0-476" pathLength={1} /></svg>
            <div className="hero__arch">
              <img className="hero__photo" src={asset('/photos/ivan-painted-960.webp')} srcSet={`${asset('/photos/ivan-painted-640.webp')} 640w, ${asset('/photos/ivan-painted-960.webp')} 960w`} sizes="(max-width: 850px) 78vw, 440px" alt={hero.imageAlt} fetchPriority="high" width="960" height="1280" />
              <HeroFilm src={asset('/photos/ivan-painted-960.jpg')} />
              <span className="hero__shine" aria-hidden="true" />
            </div>
          </div>
          <svg className="hero__ring" viewBox="0 0 200 200" aria-hidden="true" data-depth="10,8">
            <defs><path id="ring-path" d="M100 100m-78 0a78 78 0 1 1 156 0a78 78 0 1 1-156 0" /></defs>
            <text><textPath href="#ring-path">{hero.ring}</textPath></text>
            <circle cx="100" cy="100" r="5" />
          </svg>
        </div>
        <ul className="hero__facts">{hero.facts.map((f, i) => <li key={f.after} style={{ '--i': i } as CSSProperties}>
          <span>{f.before}</span> <b><HeroCount to={f.value} delay={1500 + i * 220} /></b> <span>{f.after}</span>
        </li>)}</ul>
        {/* Below the facts, so nothing covers the face or the shoulders. */}
        <button type="button" className="hero__chip" data-phase={breath.phase} onClick={breath.start} disabled={breath.phase === 'in' || breath.phase === 'out'} aria-live="polite"><span className="breath-dot" aria-hidden="true" /><span>{chip}</span></button>
      </div>
    </div>
    
  </section>;
}

export function Principles() {
  const words = ['Возможно всё', 'Путь начинается с первого шага', 'Ты хозяин своего счастья'];
  return <Marquee label="Девизы">{words.map(w => <span key={w} className="motto">{w}<i aria-hidden="true">✦</i></span>)}</Marquee>;
}

export function Topics() {
  const { topics } = site;
  const [selected, setSelected] = useState<number | null>(null);
  const topic = selected === null ? null : topics.items[selected];
  return <section id="topics" className="section wrap">
    <div className="section-top"><p className="eyebrow">Ваш запрос</p></div>
    <div className="heading-row"><h2>{topics.title}</h2><p>{topics.lead}</p></div>
    <div className="topics-grid">{topics.items.map((item, i) => <button className="topic-card" data-tone={i % 6} key={item.id} onClick={() => setSelected(i)} aria-haspopup="dialog">
      <div className="topic-card__top"><span className="topic-card__index">0{i + 1}</span><TopicGlyph index={i} /></div>
      <h3>{item.title}</h3><p>{item.text}</p><span className="topic-card__more">Подробнее <span className="topic-card__arrow">↗</span></span>
    </button>)}</div>
    <p className="section-footnote">{topics.closingNote} <BookingLink variant="link">Записаться на знакомство ↗</BookingLink></p>
    {topic && <Modal title={topic.title} onClose={() => setSelected(null)}><p className="eyebrow">С этим можно прийти</p><h2>{topic.title}</h2><p>{topic.detail}</p><blockquote>{topic.prompt}</blockquote><BookingLink onNavigate={() => setSelected(null)}>Обсудить на встрече <span>↗</span></BookingLink></Modal>}
  </section>;
}

/** Cycles the highlighted principle while the block is on screen, until the reader picks one. */
function useAutoFocus(count: number, ref: RefObject<HTMLElement | null>) {
  const [focus, setFocus] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  useEffect(() => {
    if (!auto || !visible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setFocus(f => (f + 1) % count), 3600);
    return () => window.clearInterval(t);
  }, [auto, visible, count]);
  return { focus, auto, pick: (i: number) => { setAuto(false); setFocus(i); } };
}

export function About() {
  const { practitioner: p } = site;
  const hasPortrait = Boolean(p.portrait.src);
  const root = useRef<HTMLElement>(null);
  const { focus, auto, pick } = useAutoFocus(p.approach.length, root);
  return <section id="about" className="section about" ref={root} data-picked={!auto || undefined}><div className="wrap">
    <div className="about-top">
      <figure className="about-photo">
        <div className="about-photo__frame"><img data-media-slot="about-photo" src={asset('/photos/ivan-namaste-1084.webp')} srcSet={`${asset('/photos/ivan-namaste-640.webp')} 640w, ${asset('/photos/ivan-namaste-1084.webp')} 1084w`} sizes="(max-width: 850px) 90vw, 460px" alt="Иван Угрин в белой рубашке на фоне зелёной листвы, ладони сложены в приветствии" loading="lazy" width="1084" height="1280" /></div>
        <Anahata level={5} className="about-photo__sign" />
        <figcaption><span>Намасте —</span> «божественное во мне приветствует божественное в тебе»</figcaption>
      </figure>
      <div className="about-main">
        <div className="about-head"><p className="eyebrow">Обо мне</p><h2>{p.aboutTitle}</h2></div>
        <div className="about-intro">{p.intro.map((text, i) => <p key={i}>{text}</p>)}</div>
        {p.credentials.length > 0 && <dl className="credentials">{p.credentials.map(c => <div key={c.label}><dt>{c.label}</dt><dd>{c.value}</dd></div>)}</dl>}
      </div>
    </div>
    <p className="about-credo eyebrow">Моё профессиональное кредо</p>
    <div className="about-tiles" role="group" aria-label="Профессиональное кредо">{p.approach.map((item, i) => <button type="button" key={item.lead} className="about-tile" aria-pressed={focus === i} onMouseEnter={() => pick(i)} onFocus={() => pick(i)} onClick={() => pick(i)}>
      <PrincipleArt index={[0, 2, 1][i] ?? i} active={focus === i} />
      <span className="about-tile__num" aria-hidden="true">0{i + 1}</span>
      <strong>{item.lead}</strong><span className="about-tile__text">{item.text}</span>
      <i className="about-tile__timer" aria-hidden="true" />
    </button>)}</div>
    <div className="about-sign">
      <div className="about-person">
        <figure className="about__portrait" data-empty={!hasPortrait || undefined}>{hasPortrait ? <img data-media-slot="portrait" src={asset(p.portrait.src!)} alt={p.portrait.alt} loading="lazy" width="240" height="240" /> : <div data-media-slot="portrait" className="about__slot" aria-hidden="true" />}</figure>
        <svg className="stamp" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="stamp-path" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0" /></defs><text><textPath href="#stamp-path">жизнь — за человека · жизнь — за человека · </textPath></text><path className="stamp__heart" d="M60 72c-9-6-14-11-14-17a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 6-5 11-14 17Z" /></svg>
        <div className="about-name"><h3>{p.name}</h3><span>{p.role}</span>{p.sample && <small>Демонстрационный профиль</small>}<svg className="signature" viewBox="0 0 220 40" aria-hidden="true"><path d="M4 28c14-20 26-22 30-12s-10 18-4 18 18-26 28-24-6 22 2 20 14-16 22-14 2 12 10 10 16-10 26-8 20 6 40-4 30-8 52-6" pathLength={1} /></svg></div>
      </div>
      <blockquote className="about-quote"><span aria-hidden="true">“</span>{p.quote}</blockquote>
      <BookingLink variant="secondary" className="about-cta">Записаться на первую встречу <span>↗</span></BookingLink>
    </div>
  </div></section>;
}

const STEP_MS = 7000;

export function Process() {
  const { process } = site;
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const step = process.steps[active];
  const total = process.steps.length;

  // Steps turn on their own while the block is on screen, until the reader takes over.
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setAuto(false); return; }
    const io = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting), { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!auto || paused) return;
    const t = window.setTimeout(() => setActive(a => (a + 1) % total), STEP_MS);
    return () => window.clearTimeout(t);
  }, [auto, paused, active, total]);

  const choose = (i: number) => { setAuto(false); setActive(i); };
  return <section id="process" className="section wrap"><p className="eyebrow">Первые шаги</p><div className="heading-row"><h2>{process.title}</h2><p>{process.lead}</p></div>
    <div className="process-grid" ref={root} data-auto={auto && !paused} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} style={{ '--step-ms': `${STEP_MS}ms`, '--progress': (active + 1) / total } as CSSProperties}>
      <div className="process-steps" aria-label="Шаги к первой встрече"><span className="process-rail" aria-hidden="true"><i /></span>{process.steps.map((s, i) => <button key={s.title} data-done={i < active} aria-expanded={active === i} aria-controls="step-detail" onClick={() => choose(i)}><span className="process-dot" aria-hidden="true">{i < active ? '✓' : `0${i + 1}`}</span><h3>{s.title}</h3>{active === i && <span className="process-timer" aria-hidden="true" key={`${active}-${auto}`} />}</button>)}</div>
      <div id="step-detail" className="step-detail" aria-live="polite"><StepSketch step={active} /><div className="step-number" aria-hidden="true"><span key={active}>0{active + 1}</span><small> / 0{total}</small></div><div key={active} className="step-copy"><p className="eyebrow">{step.note}</p><h3>{step.title}</h3><p>{step.text}</p></div><div className="step-navigation"><span>Дерзайте — я помогу</span><div><button aria-label="Предыдущий шаг" onClick={() => choose((active - 1 + total) % total)}>←</button><button aria-label="Следующий шаг" onClick={() => choose((active + 1) % total)}>→</button></div></div></div>
    </div>
  </section>;
}

const rub = (amount: number) => formatPrice({ amount, currency: '₽' });

export function Services() {
  const { services } = site;
  const byId = (id: string) => services.items.find(s => s.id === id);
  const pack = services.packages;
  return <section id="services" className="section services"><div className="wrap"><p className="eyebrow">Форматы</p><div className="heading-row"><h2>{services.title}</h2><p>{services.lead}</p></div><div className="services-grid">
    {services.formats.map((f, i) => <article className="service" key={f.id}>
      <div className="service__top"><span>0{i + 1}</span>{f.badge && <span className="service__badge">{f.badge}</span>}</div>
      <ServiceSketch index={i} /><p className="service__duration">{f.place}</p><h3>{f.title}</h3><p className="service__summary">{f.summary}</p>
      <ul className="service__options">{f.options.map(o => {
        const s = byId(o.id);
        if (!s) return null;
        return <li key={o.id}><BookingLink serviceId={s.id} variant="link" className="svc-option" ariaLabel={`Записаться: ${s.title}, ${s.duration}, ${formatPrice(s.price)}`}>
          <span className="svc-option__name"><strong>{o.label}</strong><small>{s.duration}</small></span>
          <b className="svc-option__price">{formatPrice(s.price)}</b>
          <span className="svc-option__go" aria-hidden="true">Записаться ↗</span>
        </BookingLink></li>;
      })}</ul>
    </article>)}
    <article id="packages" className="service service--package" data-featured="true">
      <div className="service__top"><span>0{services.formats.length + 1}</span><span className="service__badge">Выгодно</span></div>
      <div className="package__head"><ServiceSketch index={2} /><p className="package__saving"><span>{pack.saving}</span></p></div>
      <p className="service__duration">Онлайн или очно</p><h3>{pack.title}</h3><p className="service__summary">{pack.text}</p>
      <table className="package__table">
        <thead><tr><th scope="col"><span className="visually-hidden">Пакет</span></th><th scope="col">Онлайн</th><th scope="col">Очно</th></tr></thead>
        <tbody>{pack.rows.map(r => <tr key={r.title}><th scope="row">{r.title}</th><td>{rub(r.online)}</td><td>{rub(r.office)}</td></tr>)}</tbody>
      </table>
      <BookingLink serviceId="package" variant="primary">Выбрать пакет <span>↗</span></BookingLink>
    </article>
  </div>
    <div className="group-card"><Anahata level={5} spin className="group-card__sign" /><div><p className="eyebrow">Группа · 12 встреч</p><h3>{services.group.title}</h3><p>{services.group.text}</p><small>{services.group.meta}</small></div><BookingLink variant="secondary">Узнать о наборе <span>↗</span></BookingLink></div>
    <p className="services__note">{services.note}</p></div></section>;
}

export function Interlude() {
  return <section id="gallery" className="interlude"><div className="interlude__image"><img src={asset('/photos/ivan-studio-1200.webp')} srcSet={`${asset('/photos/ivan-studio-600.webp')} 600w, ${asset('/photos/ivan-studio-1200.webp')} 1200w`} sizes="(max-width: 850px) 100vw, 55vw" alt="Иван Угрин в студии подкаста «Протри Внутри»" loading="lazy" width="1200" height="1200" /></div><div className="interlude__copy"><p className="eyebrow">Подлинное «Я»</p><h2>{site.gallery.title}</h2><p>{site.gallery.lead}</p><span>{site.gallery.caption}<i aria-hidden="true">✦</i></span></div></section>;
}
