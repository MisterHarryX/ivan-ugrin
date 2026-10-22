import { site } from './config/site.ts';
import { BookingProvider } from './lib/BookingContext.tsx';
import { AdminHost, AdminKey } from './components/layout/AdminShortcut.tsx';
import { FloatingCta, Header, Mark } from './components/layout/Header.tsx';
import { About, Hero, Interlude, Principles, Process, Services, Topics } from './components/sections/Practice.tsx';
import { Breathe, Reflection } from './components/sections/Explore.tsx';
import { Method } from './components/sections/Method.tsx';
import { Reviews } from './components/sections/Reviews.tsx';
import { WorkPrinciples } from './components/sections/WorkPrinciples.tsx';
import { Location } from './components/sections/Location.tsx';
import { Project } from './components/sections/Project.tsx';
import { Faq } from './components/sections/Faq.tsx';
import { Booking } from './components/sections/Booking.tsx';
import { contactHref, isExternal } from './lib/contacts.ts';
import { FooterWord } from './components/layout/FooterWord.tsx';
import { useScrollReveal } from './hooks/useScrollReveal.ts';
import { useCursorGlow } from './hooks/useCursorGlow.ts';

export function App() {
  useScrollReveal();
  useCursorGlow();
  const { sections } = site;
  return <BookingProvider><a className="skip-link" href="#main">Перейти к содержанию</a><div id="cursor-glow" className="cursor-glow" aria-hidden="true" /><Header /><main id="main" tabIndex={-1}>
    <Hero /><Principles />
    {sections.topics && <Topics />}{sections.about && <About />}{sections.principles && <WorkPrinciples />}{sections.method && <Method />}{sections.process && <Process />}{sections.services && <Services />}{sections.gallery && <Interlude />}{sections.reviews && <Reviews />}{sections.reflection && <><Reflection /><Breathe /></>}{sections.location && <Location />}{sections.faq && <Faq />}<Booking />{sections.project && <Project />}
  </main><footer className="site-footer scope-night"><div className="wrap"><FooterWord text="Возможно всё" /><div className="footer-top"><a className="brand" href="#hero"><Mark /><span>{site.meta.brand}<small>{site.meta.tagline}</small></span></a><nav className="footer-links" aria-label="Связь">{site.contacts.map(c => <a key={c.kind} href={contactHref(c)} {...(isExternal(c) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{c.label ?? c.kind}</a>)}<a href="#booking">Записаться</a></nav><a href="#hero" className="back-top">Наверх ↑</a></div><div className="footer-bottom"><figure className="footer-quote"><blockquote>{site.footer.quote}</blockquote><figcaption>— {site.footer.author}</figcaption></figure><div className="footer-meta"><span>© {new Date().getFullYear()} · {site.meta.brand} · {site.footer.note}</span><AdminKey /></div></div><p className="made-by">Концепт сайта — <a href="https://icg-xi.ru" target="_blank" rel="noopener">ICG <span aria-hidden="true">↗</span></a></p></div></footer><FloatingCta /><AdminHost /></BookingProvider>;
}
