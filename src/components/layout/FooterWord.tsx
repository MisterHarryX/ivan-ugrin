import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

/**
 * «Возможно всё» in the footer: letters rise one by one when it comes into view, a slow gold
 * shine runs across the words, and the letters nearest the pointer light up and lift a little.
 */
export function FooterWord({ text }: { text: string }) {
  const root = useRef<HTMLParagraphElement>(null);
  const letters = useRef<(HTMLSpanElement | null)[]>([]);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onMove = (e: PointerEvent<HTMLParagraphElement>) => {
    if (e.pointerType !== 'mouse') return;
    for (const span of letters.current) {
      if (!span) continue;
      const r = span.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      span.style.setProperty('--near', Math.max(0, 1 - d / 220).toFixed(3));
    }
  };
  const onLeave = () => letters.current.forEach(s => s?.style.setProperty('--near', '0'));

  return <p className="footer-word" ref={root} data-shown={shown || undefined} onPointerMove={onMove} onPointerLeave={onLeave} aria-label={text}>
    <span className="footer-word__text" aria-hidden="true">{[...text].map((ch, i) => ch === ' '
      ? <span key={i} className="footer-word__gap"> </span>
      : <span key={i} ref={(el) => { letters.current[i] = el; }} className="footer-word__ch" style={{ '--i': i } as CSSProperties}>{ch}</span>)}</span>
    <span className="footer-word__star" aria-hidden="true">✦</span>
  </p>;
}
