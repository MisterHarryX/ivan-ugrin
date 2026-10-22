import { useEffect, useRef, useState } from 'react';
import { site } from '../../config/site.ts';
import { BookingLink } from '../ui/BookingLink.tsx';

/** Small harmony sign: six-pointed star inside a ring of petals. */
export function Mark() {
  return <svg viewBox="-24 -24 48 48" fill="none" stroke="currentColor" strokeLinejoin="round" aria-hidden="true"><path d="M0.00 -10.50 L9.09 5.25 L-9.09 5.25 ZM0.00 10.50 L-9.09 -5.25 L9.09 -5.25 Z" /><circle r="14" /><path d="M-2.67 -13.74 L-2.38 -19.35 L0.00 -22.50 L2.38 -19.35 L2.67 -13.74M4.56 -13.24 L7.62 -17.95 L11.25 -19.49 L11.74 -15.57 L9.18 -10.57M10.57 -9.18 L15.57 -11.74 L19.49 -11.25 L17.95 -7.62 L13.24 -4.56M13.74 -2.67 L19.35 -2.38 L22.50 0.00 L19.35 2.38 L13.74 2.67M13.24 4.56 L17.95 7.62 L19.49 11.25 L15.57 11.74 L10.57 9.18M9.18 10.57 L11.74 15.57 L11.25 19.49 L7.62 17.95 L4.56 13.24M2.67 13.74 L2.38 19.35 L0.00 22.50 L-2.38 19.35 L-2.67 13.74M-4.56 13.24 L-7.62 17.95 L-11.25 19.49 L-11.74 15.57 L-9.18 10.57M-10.57 9.18 L-15.57 11.74 L-19.49 11.25 L-17.95 7.62 L-13.24 4.56M-13.74 2.67 L-19.35 2.38 L-22.50 0.00 L-19.35 -2.38 L-13.74 -2.67M-13.24 -4.56 L-17.95 -7.62 L-19.49 -11.25 L-15.57 -11.74 L-10.57 -9.18M-9.18 -10.57 L-11.74 -15.57 L-11.25 -19.49 L-7.62 -17.95 L-4.56 -13.24" /></svg>;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState('');
  const menu = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const links = [
    site.sections.about && ['about', 'Обо мне'],
    site.sections.method && ['method', 'Метод'],
    site.sections.services && ['services', 'Цены'],
    site.sections.reviews && ['reviews', 'Отзывы'],
    site.sections.location && ['location', 'Где принимаю'],
    site.sections.project && ['project', 'Подкаст'],
  ].filter((x): x is string[] => Boolean(x));
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', scroll, { passive: true });
    scroll();
    return () => window.removeEventListener('scroll', scroll);
  }, []);
  // Highlights the menu item of the section being read.
  useEffect(() => {
    const targets = links.map(([id]) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(el => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // One pill glides to the current item instead of each link fading its own background.
  useEffect(() => {
    const place = () => {
      const link = nav.current?.querySelector<HTMLElement>(`a[data-current=true]`);
      const el = pill.current;
      if (!el) return;
      if (!link || !link.offsetWidth) { el.style.opacity = '0'; return; }
      el.style.opacity = '1';
      el.style.width = `${link.offsetWidth}px`;
      el.style.transform = `translateX(${link.offsetLeft}px)`;
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [current]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); menu.current?.focus(); } };
    const pointer = (e: PointerEvent) => { if (!(e.target as Element).closest('.site-header')) setOpen(false); };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', pointer);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', pointer); };
  }, [open]);
  return <header className="site-header" data-scrolled={scrolled}>
    <div className="wrap header-inner">
      <a className="brand" href="#hero" aria-label={`${site.meta.brand} — в начало`}><Mark /><span>{site.meta.brand}<small>{site.meta.tagline}</small></span></a>
      <nav id="navigation" ref={nav} aria-label="Основная навигация" data-open={open}>
        <span className="nav-pill" ref={pill} aria-hidden="true" />
        {links.map(([id, label]) => <a href={`#${id}`} key={id} data-current={current === id} aria-current={current === id ? 'location' : undefined} onClick={() => setOpen(false)}>{label}</a>)}
        <BookingLink className="mobile-booking" onNavigate={() => setOpen(false)}>Записаться ↗</BookingLink>
      </nav>
      <BookingLink className="header-booking" variant="secondary">Записаться <span>↗</span></BookingLink>
      <button ref={menu} className="menu-button" aria-expanded={open} aria-controls="navigation" aria-label={open ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setOpen(!open)}><i /><i /></button>
    </div>
    <div className="read-progress" aria-hidden="true"><span /></div>
  </header>;
}

/** A quiet booking button for phones: appears after the first screen, steps aside near the form and the breathing pause. */
export function FloatingCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('hero');
    const quiet = ['booking', 'breathe', 'project'].map(id => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    const visible = new Set<Element>();
    let pastHero = false;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) pastHero = !e.isIntersecting;
        else if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      setShow(pastHero && visible.size === 0);
    });
    if (hero) io.observe(hero);
    quiet.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
  return <div className="float-cta" data-show={show} inert={!show}><BookingLink>Записаться <span>↗</span></BookingLink></div>;
}
