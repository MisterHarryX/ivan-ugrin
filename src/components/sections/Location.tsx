import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { site } from '../../config/site.ts';
import { BookingLink } from '../ui/BookingLink.tsx';

/* A drawn scheme of central Moscow, not to scale: the Kremlin, the river, the Boulevard and Garden
   rings, and the brown Koltsevaya line with the station near Ivan's room. */
const C = { x: 300, y: 265 };
const RING = 175;
const onRing = (deg: number) => ({ x: C.x + RING * Math.cos((deg * Math.PI) / 180), y: C.y + RING * Math.sin((deg * Math.PI) / 180) });
const SPOTS: Record<string, { x: number; y: number }> = { taganka: onRing(28) };
const RING_PATH = `M${C.x - RING} ${C.y}a${RING} ${RING} 0 1 1 ${RING * 2} 0a${RING} ${RING} 0 1 1 ${-RING * 2} 0`;
const RIVER = 'M-20 318C60 290 110 372 190 352S262 300 318 322S404 418 470 398S560 330 640 352';
const BLOCKS = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 97) % 600, y = (i * 61) % 520, w = 24 + (i * 13) % 30, h = 16 + (i * 7) % 22;
  return { x, y, w, h };
});
const CITIES = [[-60, -18], [52, -30], [70, 12], [-30, 40], [10, -55]];

/** Small line drawings for the place cards: the Kotelnicheskaya tower by the river, a video call. */
const PLACE_ART: Record<string, string[]> = {
  taganka: ['M6 92c10-4 20 4 30 0s20-4 30 0 20 4 30 0 20-4 30 0 20 4 28 0', 'M22 80H138', 'M70 80V42H90V80', 'M74 42V30H86V42', 'M78 30V20H82V30', 'M80 20V6', 'M44 80V58H70M90 58H116V80', 'M30 80V68H44M116 68H130V80', 'M76 50H84M76 58H84M76 66H84', 'M52 66v8M60 66v8M100 66v8M108 66v8'],
  online: ['M38 26h84a4 4 0 0 1 4 4v44H34V30a4 4 0 0 1 4-4Z', 'M22 74h116l-7 9H29Z', 'M80 32v36', 'M57 40a6 6 0 1 1 0 12a6 6 0 1 1 0-12', 'M45 66c2-7 7-10 12-10s10 3 12 10', 'M103 40a6 6 0 1 1 0 12a6 6 0 1 1 0-12', 'M91 66c2-7 7-10 12-10s10 3 12 10', 'M70 14c6-5 14-5 20 0', 'M74 19c3-2.5 9-2.5 12 0'],
};
function PlaceArt({ id }: { id: string }) {
  return <svg className="place__art" viewBox="0 0 160 96" aria-hidden="true">{(PLACE_ART[id] ?? []).map((d, k) => <path key={k} d={d} pathLength={1} style={{ '--k': k } as CSSProperties} />)}</svg>;
}

/**
 * «Где проходят встречи»: the scheme zooms to the chosen station with a pulsing pin; a small train
 * runs the ring line; the river flows. «Онлайн» swaps the map for a turning globe with links.
 */
export function Location() {
  const { location } = site;
  const [tab, setTab] = useState<string>(location.places[0]?.id ?? 'online');
  const [zoomed, setZoomed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  // On first sight the whole centre shows for a moment, then the camera glides to the station.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      window.setTimeout(() => setZoomed(true), 900);
      io.disconnect();
    }, { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const place = location.places.find(p => p.id === tab);
  const spot = place ? SPOTS[place.id] : null;
  const cam = spot && zoomed ? `translate(${C.x + 40}px, ${C.y - 70}px) scale(1.75) translate(${-spot.x}px, ${-spot.y}px)` : 'none';
  const select = (id: string) => { setTab(id); setZoomed(true); };

  return <section id="location" className="section location">
    <div className="wrap location__grid">
      <div className="location__copy">
        <p className="eyebrow">Очно и онлайн</p>
        <h2>{location.title}</h2>
        <p className="section-lead">{location.lead}</p>
        <div className="places" role="tablist" aria-label="Где встретиться">
          {location.places.map(pl => <button key={pl.id} role="tab" className="place" aria-selected={tab === pl.id} onClick={() => select(pl.id)}>
            <PlaceArt id={pl.id} />
            <strong>{pl.metro}</strong>
            <span className="place__lines" title={pl.line}>{pl.lines.map(l => <i key={l.name} style={{ '--line': l.color } as CSSProperties} aria-hidden="true" />)}<small>метро</small></span>
          </button>)}
          <button role="tab" className="place" aria-selected={tab === 'online'} onClick={() => select('online')}>
            <PlaceArt id="online" />
            <strong>Онлайн</strong>
            <span className="place__lines"><small>из любой точки мира</small></span>
          </button>
        </div>
        <p className="location__hint">{place ? place.line : location.online}</p>
      </div>

      <div className="lmap" ref={stage} data-mode={tab === 'online' ? 'online' : 'city'} data-zoomed={zoomed || undefined}>
        <svg className="lmap__svg" viewBox="0 0 600 520" role="img" aria-label={place ? `Схема центра Москвы, метро ${place.metro}` : 'Онлайн-консультации'}>
          <defs>
            <radialGradient id="lmap-vignette" cx="50%" cy="50%" r="65%"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".55" /></radialGradient>
            <path id="lmap-ring" d={RING_PATH} />
          </defs>
          <g className="lmap__cam" style={{ transform: cam }}>
            <g className="lmap__blocks">{BLOCKS.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="3" />)}</g>
            <path className="lmap__park" d="M300 40c40-18 90-6 104 22s-10 52-50 50-80-8-88-34 10-30 34-38Z" />
            <path className="lmap__park" d="M470 420c30-8 64 6 66 30s-30 40-60 32-40-54-6-62Z" />
            <path className="lmap__park" d="M120 150c26-12 60-2 62 22s-28 34-52 28-34-38-10-50Z" />
            <path className="lmap__river-bank" d={RIVER} />
            <path className="lmap__river" d={RIVER} />
            <text className="lmap__label lmap__label--river"><textPath href="#lmap-river-text" startOffset="8%">Москва-река</textPath></text>
            <path id="lmap-river-text" d={RIVER} fill="none" stroke="none" />
            <path className="lmap__road lmap__road--major" d="M340 128 360 -10" />
            <path className="lmap__road lmap__road--major" d="M440 330 620 392" />
            <path className="lmap__road" d="M300 265 300 -10M300 265-10 210M300 265 120 520M300 265 620 200" />
            <ellipse className="lmap__garden" cx="298" cy="268" rx="150" ry="140" />
            <path className="lmap__boulevard" d="M228 322A86 86 0 1 1 372 322" />
            <path className="lmap__metro" d={RING_PATH} pathLength={1} />
            <circle className="lmap__train" r="5"><animateMotion dur="22s" repeatCount="indefinite" rotate="auto"><mpath href="#lmap-ring" /></animateMotion></circle>
            <g className="lmap__kremlin" transform="translate(288 286)"><path d="M-14 8h28l-4-14-6 4-4-10-4 10-6-4z" /><text y="26" textAnchor="middle">Кремль</text></g>
            <text className="lmap__label" x="500" y="372">Таганская ул.</text>
            {location.places.map(pl => {
              const s = SPOTS[pl.id];
              if (!s) return null;
              const on = tab === pl.id;
              return <g key={pl.id} className="lmap__pin" data-on={on || undefined} transform={`translate(${s.x} ${s.y})`} role="button" tabIndex={0} aria-label={`Метро ${pl.metro}`}
                onClick={() => select(pl.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(pl.id); } }}>
                <circle className="lmap__pulse" r="16" /><circle className="lmap__pulse lmap__pulse--2" r="16" />
                <circle className="lmap__dot" r="11" /><text className="lmap__m" y="4.5" textAnchor="middle">М</text>
                <g className="lmap__tag" transform="translate(0 -26)"><rect x={-pl.metro.length * 4.2 - 12} y="-15" width={pl.metro.length * 8.4 + 24} height="24" rx="12" /><text y="1.5" textAnchor="middle">{pl.metro}</text></g>
              </g>;
            })}
          </g>
          <rect className="lmap__vignette" width="600" height="520" fill="url(#lmap-vignette)" />
          <g className="lmap__globe" transform="translate(300 250)">
            <circle className="lmap__sphere" r="150" />
            {[0, 1, 2, 3].map(i => <ellipse key={i} className="lmap__meridian" rx="150" ry="150" style={{ '--m': i } as CSSProperties} />)}
            <ellipse className="lmap__parallel" rx="150" ry="52" /><ellipse className="lmap__parallel" rx="132" ry="44" cy="-70" /><ellipse className="lmap__parallel" rx="132" ry="44" cy="70" />
            {CITIES.map(([x, y], i) => <g key={i}>
              <path className="lmap__arc" d={`M-6-36Q${(x - 6) / 2} ${Math.min(-36, y) - 60} ${x * 2} ${y * 2}`} pathLength={1} style={{ '--i': i } as CSSProperties} />
              <circle className="lmap__city" cx={x * 2} cy={y * 2} r="5" style={{ '--i': i } as CSSProperties} />
            </g>)}
            <circle className="lmap__home" cx="-6" cy="-36" r="8" />
          </g>
        </svg>
        <div className="lmap__card" key={tab}>
          {place ? <>
            <p className="eyebrow">м. {place.metro}</p>
            <p>{place.text}</p>
            <small>{location.note}</small>
            <BookingLink serviceId="office" variant="primary">Записаться очно <span>↗</span></BookingLink>
          </> : <>
            <p className="eyebrow">Онлайн</p>
            <p>{location.online}</p>
            <BookingLink serviceId="online" variant="primary">Записаться онлайн <span>↗</span></BookingLink>
          </>}
        </div>
        {place && <button type="button" className="lmap__zoom" onClick={() => setZoomed(z => !z)}>{zoomed ? 'Весь центр' : 'Приблизить'}</button>}
      </div>
    </div>
  </section>;
}
