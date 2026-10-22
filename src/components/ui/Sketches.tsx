import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

/*
 * Hand-drawn line illustrations. Every stroke has pathLength=1, so one CSS rule can draw
 * any of them in; colour and small motions come from the stylesheet.
 */

/**
 * Drawings for the three principles: hands holding a sprout, two chairs in conversation,
 * a clock over a slow wave. The active one comes alive (leaves fill, chairs lean in and a
 * bubble appears, the pendulum swings); the others rest in a muted line.
 */
export function PrincipleArt({ index, active }: { index: number; active: boolean }) {
  const art = [
    <g key="care" className="pa pa--care"><path d="M34 98c12 20 42 28 66 28s54-8 66-28" pathLength={1} /><path d="M34 98c-7-11-4-22 7-24 9-2 15 6 17 17" pathLength={1} /><path d="M166 98c7-11 4-22-7-24-9-2-15 6-17 17" pathLength={1} /><path className="pa__stem" d="M100 106V58" pathLength={1} /><path className="pa__leaf" d="M100 80c-17-2-27-13-27-26 15 0 27 11 27 26Z" pathLength={1} /><path className="pa__leaf pa__leaf--b" d="M100 70c15-4 25-15 25-28-15 2-25 13-25 28Z" pathLength={1} /><path className="pa__spark" d="M138 30v10M133 35h10M62 40v8M58 44h8" /></g>,
    <g key="talk" className="pa pa--talk"><g className="pa__chair pa__chair--l"><path d="M30 118V84a14 14 0 0 1 14-14h14a14 14 0 0 1 14 14v34" pathLength={1} /><path d="M22 104h58v14H22Z" pathLength={1} /><path d="M26 118v14M76 118v14" pathLength={1} /></g><g className="pa__chair pa__chair--r"><path d="M128 118V84a14 14 0 0 1 14-14h14a14 14 0 0 1 14 14v34" pathLength={1} /><path d="M120 104h58v14h-58Z" pathLength={1} /><path d="M124 118v14M174 118v14" pathLength={1} /></g><g className="pa__bubble"><path d="M84 22h32a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8h-10l-8 8v-8H84a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8Z" /><circle cx="90" cy="36" r="2" /><circle cx="100" cy="36" r="2" /><circle cx="110" cy="36" r="2" /></g></g>,
    <g key="rhythm" className="pa pa--rhythm"><circle cx="100" cy="46" r="30" pathLength={1} /><path className="pa__hand" d="M100 46V28" /><path d="M100 46l12 6" /><g className="pa__pendulum"><path d="M100 76v24" /><circle cx="100" cy="106" r="6" /></g><path className="pa__wave" d="M20 128c15-12 30-12 45 0s30 12 45 0 30-12 45 0 30 12 25 4" /></g>,
  ];
  return <svg className="principle-art" data-on={active} viewBox="0 0 200 140" fill="none" aria-hidden="true">{art[index % art.length]}</svg>;
}

const PROCESS_ART = [
  ['M44 18h56l20 20v66H44Z', 'M100 18v20h20', 'M56 56h48M56 70h48M56 84h30', 'M116 98l26-26 7 7-26 26-9 2Z'],
  ['M28 30h96v70H28Z', 'M28 50h96', 'M50 22v16M102 22v16', 'M58 74l10 10 20-20'],
  ['M18 26h66a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H50l-14 12V68H18a8 8 0 0 1-8-8V34a8 8 0 0 1 8-8Z', 'M76 56h58a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8h-8v12l-14-12H76a8 8 0 0 1-8-8V64a8 8 0 0 1 8-8Z', 'M34 47h2M48 47h2M62 47h2'],
  ['M80 114V70', 'M80 70C80 48 52 42 40 16', 'M80 70C80 48 108 42 120 16', 'M80 58h28l7 7-7 7H80'],
];

/** One drawing per step of the first meeting; it redraws each time the step changes. */
export function StepSketch({ step }: { step: number }) {
  return <svg className="step-sketch" key={step} viewBox="0 0 160 120" fill="none" aria-hidden="true">{PROCESS_ART[step % PROCESS_ART.length].map((d, i) => <path key={i} d={d} pathLength={1} style={{ animationDelay: `${i * 110}ms` }} />)}</svg>;
}

const SERVICE_ART = [
  ['M12 30h22v10a11 11 0 0 1-22 0Z', 'M34 32a4 4 0 0 1 0 8', 'M46 30h22v10a11 11 0 0 1-22 0Z', 'M68 32a4 4 0 0 1 0 8', 'M19 24c-3-5 3-8 0-13M57 24c-3-5 3-8 0-13'],
  ['M24 40V22a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8v18', 'M14 40h52a4 4 0 0 1 4 4v6H10v-6a4 4 0 0 1 4-4Z', 'M16 50v8M64 50v8'],
  ['M12 14h56v42H12Z', 'M12 25h56', 'M24 8v10M56 8v10', 'M31 42a9 9 0 1 0 9-9', 'M37 29l4 4-4 4'],
];

export function ServiceSketch({ index }: { index: number }) {
  return <svg className="service-sketch" viewBox="0 0 80 62" fill="none" aria-hidden="true">{SERVICE_ART[index % SERVICE_ART.length].map((d, i) => <path key={i} d={d} pathLength={1} style={{ animationDelay: `${i * 90}ms` }} />)}</svg>;
}

const LEAVES = [
  'M99 150c-22-2-34-14-36-28 18 0 32 10 36 28Z',
  'M101 132c20-6 34-2 40 10-16 8-32 4-40-10Z',
  'M98 112c-20-8-26-22-24-34 16 6 24 18 24 34Z',
  'M99 94c18-10 32-8 40 2-14 10-30 10-40-2Z',
  'M97 74c-16-10-20-22-16-32 12 8 18 18 16 32Z',
  'M99 56c14-12 26-12 34-4-10 12-24 14-34 4Z',
];

/** A sprout that grows a leaf for every answer read; all of them open a flower. Leaves open their question. */
export function FaqPlant({ seen, total, onLeaf }: { seen: Set<number>; total: number; onLeaf: (i: number) => void }) {
  const count = Math.min(total, LEAVES.length);
  const read = [...seen].filter(i => i < count).length;
  const bloom = read === count;
  const key = (e: KeyboardEvent, i: number) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLeaf(i); } };
  return <div className="faq-plant" data-bloom={bloom}>
    <svg viewBox="0 0 200 244" fill="none">
      <g className="plant__sway">
        <path className="plant__stem" d="M100 176C98 144 104 114 98 84 95 64 100 46 100 32" pathLength={1} />
        {LEAVES.slice(0, count).map((d, i) => <g key={i} className="plant__leaf" data-grown={seen.has(i)} role="button" tabIndex={0} aria-label={`Вопрос ${i + 1}${seen.has(i) ? ', уже прочитан' : ''}`} onClick={() => onLeaf(i)} onKeyDown={(e) => key(e, i)}><path d={d} pathLength={1} /></g>)}
        <g className="plant__flower" aria-hidden="true">{[0, 72, 144, 216, 288].map(r => <ellipse key={r} cx="100" cy="20" rx="6" ry="11" transform={`rotate(${r} 100 30)`} />)}<circle cx="100" cy="30" r="5" /></g>
      </g>
      <path className="plant__pot" d="M64 240l-8-52h88l-8 52Z" pathLength={1} />
      <path className="plant__pot" d="M50 188h100v-12H50Z" pathLength={1} />
    </svg>
    <p aria-live="polite">{bloom ? <>Все ответы прочитаны — <em>и цветок раскрылся.</em></> : <>Каждый открытый ответ — новый лист. <b>{read} из {count}</b></>}</p>
  </div>;
}

interface LetterState { name: string; format: string; contact: string; message: number; ready: boolean; writing: boolean; sent: boolean }
const EMPTY: LetterState = { name: '', format: '', contact: '', message: 0, ready: false, writing: false, sent: false };

/**
 * A paper letter beside the booking form that writes itself as the visitor fills it in:
 * the name, the chosen format, the way to reach them, a few lines for the message,
 * and a wax seal once the request can be sent. On sending it folds away.
 */
export function LetterSketch() {
  const [s, setS] = useState<LetterState>(EMPTY);
  const writingTimer = useRef(0);

  useEffect(() => {
    const composer = document.querySelector<HTMLElement>('#booking .composer');
    if (!composer) return;
    const chosen = (i: number) => composer.querySelectorAll('.composer__formats')[i]?.querySelector('input:checked')?.closest('label')?.textContent?.trim() ?? '';
    const read = (writing: boolean) => {
      const name = composer.querySelector<HTMLInputElement>('input[autocomplete="given-name"]')?.value.trim() ?? '';
      const phone = composer.querySelector<HTMLInputElement>('input[type="tel"]')?.value.replace(/\D/g, '') ?? '';
      const message = composer.querySelector('textarea')?.value.length ?? 0;
      setS({ name: name.length > 18 ? `${name.slice(0, 17)}…` : name, format: chosen(0), contact: chosen(1), message: Math.min(1, message / 140), ready: Boolean(name) && phone.length >= 11, writing, sent: composer.dataset.state === 'sent' });
    };
    const onInput = () => {
      read(true);
      window.clearTimeout(writingTimer.current);
      writingTimer.current = window.setTimeout(() => setS(prev => ({ ...prev, writing: false })), 700);
    };
    read(false);
    composer.addEventListener('input', onInput);
    composer.addEventListener('change', onInput);
    const mo = new MutationObserver(() => read(false));
    mo.observe(composer, { attributes: true, attributeFilter: ['data-state'], childList: true });
    return () => { composer.removeEventListener('input', onInput); composer.removeEventListener('change', onInput); mo.disconnect(); window.clearTimeout(writingTimer.current); };
  }, []);

  return <figure className="letter" data-ready={s.ready} data-writing={s.writing} data-sent={s.sent} aria-hidden="true">
    <svg viewBox="0 0 360 270" fill="none">
      <g className="letter__paper">
        <rect x="34" y="22" width="262" height="216" rx="6" />
        {[66, 104, 136, 168, 198, 222].map(y => <path key={y} className="letter__rule" d={`M56 ${y}h218`} />)}
        <text className="letter__hello" x="56" y="58">Здравствуйте!</text>
        <text className="letter__line" data-on={Boolean(s.name)} x="56" y="98">Меня зовут {s.name}</text>
        <text className="letter__line" data-on={Boolean(s.format)} x="56" y="130">Формат: {s.format}</text>
        <text className="letter__line" data-on={Boolean(s.contact && s.name)} x="56" y="162">Связь: {s.contact}</text>
        <path className="letter__scribble" d="M56 192c14-6 22 4 36-2s22-6 36 0 22 4 36-2 22-6 36 0 22 4 36-2 14-2 22 0" pathLength={1} style={{ strokeDashoffset: 1 - Math.min(1, s.message * 2) }} />
        <path className="letter__scribble" d="M56 216c14-6 22 4 36-2s22-6 36 0 22 4 36-2 14-2 22 0" pathLength={1} style={{ strokeDashoffset: 1 - Math.max(0, s.message * 2 - 1) }} />
        <g className="letter__seal"><circle cx="262" cy="56" r="19" /><path d="M262 66c-7-4-11-8-11-12a5 5 0 0 1 11-2 5 5 0 0 1 11 2c0 4-4 8-11 12Z" /></g>
      </g>
      <g className="letter__pen"><path d="M318 236l26-92 8 2-26 92-9 6Z" /><path d="M342 150l8 2" /></g>
      <g className="letter__done"><path d="M140 128l18 18 36-40" pathLength={1} /><text x="167" y="186">Письмо в пути</text></g>
    </svg>
    <figcaption>Можно начать с простого <em>«Здравствуйте».</em></figcaption>
  </figure>;
}
