import { useState } from 'react';
import { site } from '../../config/site.ts';

const CHANNEL_ICON: Record<string, string> = {
  telegram: 'M21 4 3 11l6 2 2 6 3-4 5 4 2-15ZM9 13l9-6-6.5 7.5',
  dzen: 'M12 3c.3 4.9 4.1 8.7 9 9-4.9.3-8.7 4.1-9 9-.3-4.9-4.1-8.7-9-9 4.9-.3 8.7-4.1 9-9Z',
  youtube: 'M3 8.5C3 6.6 4.6 5 6.5 5h11C19.4 5 21 6.6 21 8.5v7c0 1.9-1.6 3.5-3.5 3.5h-11C4.6 19 3 17.4 3 15.5zM10 9v6l5-3z',
};

/**
 * The project «Протри Внутри» — kept apart from the personal booking contacts, as Ivan asked.
 * Channels first; then a small player: the thumbnail is a plain image, and the YouTube player
 * (privacy-enhanced domain) loads only when someone presses play.
 */
export function Project() {
  const { project } = site;
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const v = project.videos[active];
  const pick = (i: number) => { setActive(i); setPlaying(false); };
  return <section id="project" className="section project">
    <div className="project__waves" aria-hidden="true"><i /><i /><i /></div>
    <div className="wrap project__grid">
      <div className="project__copy">
        <p className="eyebrow">Проект · подкаст и беседы</p>
        <p className="project__name">«{project.name}»</p>
        <h2>{project.title}</h2>
        <p className="section-lead">{project.lead}</p>
        <p className="project__motto">{project.motto}</p>
        <ul className="project__channels">{project.channels.map(c => <li key={c.kind}>
          <a className={`pchannel pchannel--${c.kind}`} href={c.url} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={CHANNEL_ICON[c.kind]} /></svg>
            <span><strong>{c.label}</strong><small>{c.hint}</small></span><i aria-hidden="true">↗</i>
          </a>
        </li>)}</ul>
      </div>
      <div className="player">
        <div className="player__screen">
          {playing
            ? <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            : <button type="button" className="player__poster" onClick={() => setPlaying(true)} aria-label={`Смотреть: ${v.title}`}>
              <img key={v.id} src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" width="480" height="360" />
              <span className="player__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
              <span className="player__meta"><small>{v.kind} · {v.date}</small><strong>{v.title}</strong></span>
            </button>}
        </div>
        <ol className="player__list" aria-label="Выпуски">{project.videos.map((ep, i) => <li key={ep.id}>
          <button aria-current={i === active || undefined} onClick={() => pick(i)}>
            <span className="player__thumb"><img src={`https://i.ytimg.com/vi/${ep.id}/mqdefault.jpg`} alt="" loading="lazy" width="160" height="90" /></span>
            <span className="player__ep"><small>{ep.kind}</small><span>{ep.title}</span></span>
          </button>
        </li>)}</ol>
      </div>
    </div>
  </section>;
}
