import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { site } from '../../config/site.ts';
import { BookingLink } from '../ui/BookingLink.tsx';
import { BreathOrb, type BreathDrive } from './BreathOrb.tsx';
import { MoodScene, WEATHER, WEATHER_NAME, type Weather } from './MoodScene.tsx';

const SWATCH = ['#8e9aa6', '#e59a6c', '#c3c9bf', '#f0c27f'];

export function Reflection() {
  const { reflection } = site;
  const [active, setActive] = useState<number | null>(null);
  const answer = active === null ? null : reflection.options[active];
  const weather: Weather = active === null ? 'calm' : WEATHER[(active % 4) + 1];
  return <section id="reflection" className="section reflection"><div className="wrap reflection-grid">
    <div className="reflection__ask"><p className="eyebrow">Минута для себя</p><h2>{reflection.title}</h2><p className="section-lead">{reflection.lead}</p>
      <div className="reflection-options" role="group" aria-label="Что сейчас откликается">{reflection.options.map((o, i) => <button key={i} aria-pressed={active === i} onClick={() => setActive(active === i ? null : i)} style={{ '--swatch': SWATCH[i % SWATCH.length] } as CSSProperties}><i className="swatch" aria-hidden="true" /><span>{o.label}</span></button>)}</div>
      <p className="reflection-disclaimer">{reflection.disclaimer}</p>
    </div>
    <div className="reflection-visual">
      <div className="reflection-card">
        <MoodScene weather={weather} />
        <p className="scene-caption" aria-hidden="true"><span>Погода внутри</span><b key={weather}>{WEATHER_NAME[weather]}</b></p>
      </div>
      <div className="reflection-panel" aria-live="polite" aria-atomic="true">
        {answer ? <div className="reflection-answer" key={active}><h3>{answer.title}</h3><p>{answer.text}</p><blockquote>{answer.question}</blockquote><BookingLink variant="link">Обсудить на консультации ↗</BookingLink></div>
          : <div className="reflection-answer reflection-answer--empty"><h3>Любая точка — <em>начало пути.</em></h3><p>Выберите то, что ближе, — и пейзаж изменится вместе с вами.</p></div>}
      </div>
    </div>
  </div></section>;
}

type Phase = { label: string; secs: number; scale: number };
const PATTERNS: { id: string; name: string; hint: string; phases: Phase[] }[] = [
  { id: 'calm', name: 'Спокойное', hint: 'вдох 4 · выдох 6', phases: [{ label: 'Вдох', secs: 4, scale: 1 }, { label: 'Выдох', secs: 6, scale: 0.55 }] },
  { id: 'square', name: 'Квадрат', hint: '4 · 4 · 4 · 4', phases: [{ label: 'Вдох', secs: 4, scale: 1 }, { label: 'Пауза', secs: 4, scale: 1 }, { label: 'Выдох', secs: 4, scale: 0.55 }, { label: 'Пауза', secs: 4, scale: 0.55 }] },
  { id: 'deep', name: 'Глубокое', hint: 'вдох 4 · пауза 7 · выдох 8', phases: [{ label: 'Вдох', secs: 4, scale: 1 }, { label: 'Пауза', secs: 7, scale: 1 }, { label: 'Выдох', secs: 8, scale: 0.55 }] },
];
const FREE = PATTERNS.length;
const CYCLES = 5;
const secs = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');

export function Breathe() {
  const { breathe } = site.reflection;
  const [pattern, setPattern] = useState(0);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [done, setDone] = useState(false);
  const [holding, setHolding] = useState(false);
  const [held, setHeld] = useState(0);
  const [breaths, setBreaths] = useState<{ inhale: number; exhale: number }[]>([]);
  const drive = useRef<BreathDrive>({ mode: 'idle', from: 0.8, to: 0.8, start: 0, dur: 1, holding: false, holdStart: 0 });
  const scale = useRef(0.8);
  const lastRelease = useRef(0);
  const free = pattern === FREE;
  const phases = free ? [] : PATTERNS[pattern].phases;
  const current = phases[phase];

  // Guided rhythm: each phase hands the orb its start and end size; the orb eases between them.
  useEffect(() => {
    if (!running || free || !current) return;
    const start = performance.now();
    drive.current = { ...drive.current, mode: 'guided', from: scale.current, to: current.scale, start, dur: current.secs * 1000 };
    setLeft(current.secs);
    const tick = window.setInterval(() => setLeft(Math.max(1, current.secs - Math.floor((performance.now() - start) / 1000))), 200);
    const next = window.setTimeout(() => {
      const last = phase === phases.length - 1;
      if (last && cycle + 1 >= CYCLES) { setRunning(false); setDone(true); setPhase(0); setCycle(0); return; }
      if (last) setCycle(c => c + 1);
      setPhase((phase + 1) % phases.length);
    }, current.secs * 1000);
    return () => { window.clearInterval(tick); window.clearTimeout(next); };
  }, [running, free, phase, cycle, current, phases.length]);

  useEffect(() => { if (!running && !free) drive.current = { ...drive.current, mode: 'idle' }; }, [running, free]);

  // Free rhythm: a live counter while the visitor holds.
  useEffect(() => {
    if (!holding) return;
    const t = window.setInterval(() => setHeld(performance.now() - drive.current.holdStart), 100);
    return () => window.clearInterval(t);
  }, [holding]);

  const start = () => { setDone(false); setPhase(0); setCycle(0); setRunning(true); };
  const stop = () => { setRunning(false); setPhase(0); setCycle(0); };
  const pick = (i: number) => {
    setPattern(i); setRunning(false); setPhase(0); setCycle(0); setDone(false); setBreaths([]); setHolding(false);
    lastRelease.current = 0;
    drive.current = { ...drive.current, mode: i === FREE ? 'free' : 'idle', holding: false };
  };
  const press = useCallback(() => {
    if (drive.current.holding) return;
    const now = performance.now();
    drive.current = { ...drive.current, mode: 'free', holding: true, holdStart: now };
    setHolding(true); setHeld(0);
    if (lastRelease.current) {
      const exhale = now - lastRelease.current;
      setBreaths(b => b.length && !b[b.length - 1].exhale ? [...b.slice(0, -1), { ...b[b.length - 1], exhale }] : b);
    }
  }, []);
  const release = useCallback(() => {
    if (!drive.current.holding) return;
    const now = performance.now();
    const inhale = now - drive.current.holdStart;
    drive.current = { ...drive.current, holding: false };
    setHolding(false);
    lastRelease.current = now;
    if (inhale > 600) setBreaths(b => [...b.slice(-5), { inhale, exhale: 0 }]);
  }, []);
  const onHoldKey = (e: KeyboardEvent, down: boolean) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (e.repeat) return;
    if (down) press(); else release();
  };

  const last = breaths[breaths.length - 1];
  const label = free
    ? holding ? <><strong>Вдох</strong><span>{secs(held)}</span></> : breaths.length ? <><strong>Выдох</strong><span className="breathe__small">медленно, сколько хочется</span></> : <><strong>Удерживайте</strong><span className="breathe__small">круг или пробел — это вдох</span></>
    : running ? <><strong>{current.label}</strong><span>{left}</span></> : done ? <><strong>Как вы?</strong><span className="breathe__small">Пять циклов позади</span></> : <><strong>Готовы?</strong><span className="breathe__small">{CYCLES} циклов · около минуты</span></>;

  return <section id="breathe" className="section breathe scope-night"><div className="breathe__sky" aria-hidden="true"><i /><i /><i /></div>
    <div className="wrap breathe-grid">
      <div className="breathe__copy"><p className="eyebrow">Дыхательная пауза</p><h2>{breathe.title}</h2><p className="section-lead">{breathe.lead}</p>
        <div className="breathe__patterns" role="radiogroup" aria-label="Ритм дыхания">
          {PATTERNS.map((p, i) => <button key={p.id} role="radio" aria-checked={pattern === i} onClick={() => pick(i)}><span>{p.name}</span><small>{p.hint}</small></button>)}
          <button role="radio" aria-checked={free} onClick={() => pick(FREE)}><span>Свой ритм</span><small>удерживайте круг</small></button>
        </div>
        <p className="breathe__note">{breathe.note}</p>
      </div>
      <div className="breathe__stage" data-mode={free ? 'free' : running ? 'guided' : 'idle'} data-holding={holding}>
        <BreathOrb drive={drive} scaleOut={scale} />
        {free ? <button className="breathe__hold" aria-label="Удерживайте для вдоха, отпустите для выдоха" onPointerDown={(e: PointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture(e.pointerId); press(); }} onPointerUp={release} onPointerCancel={release} onKeyDown={(e) => onHoldKey(e, true)} onKeyUp={(e) => onHoldKey(e, false)} onContextMenu={(e) => e.preventDefault()}><span className="breathe__label">{label}</span></button>
          : <div className="breathe__label" aria-live="polite">{label}</div>}
        <div className="breathe__controls">
          {free ? <p className="breathe__stats" aria-live="polite">{last ? <>Вдох {secs(last.inhale)} с{last.exhale ? <> · выдох {secs(last.exhale)} с</> : null} · вдохов: {breaths.length}</> : 'Дышите в своём темпе — круг повторит за вами'}</p>
            : <>
              {running ? <button className="btn btn--secondary" onClick={stop}>Остановить</button> : <button className="btn btn--primary" onClick={start}>{done ? 'Ещё раз' : 'Начать'} <span>○</span></button>}
              <div className="breathe__dots" role="img" aria-label={running ? `Цикл ${cycle + 1} из ${CYCLES}` : `${CYCLES} циклов`}>{Array.from({ length: CYCLES }, (_, i) => <i key={i} data-state={done ? 'done' : running && i < cycle ? 'done' : running && i === cycle ? 'now' : 'todo'} />)}</div>
              {done && <BookingLink variant="link">Поговорить об этом ↗</BookingLink>}
            </>}
        </div>
      </div>
    </div>
  </section>;
}
