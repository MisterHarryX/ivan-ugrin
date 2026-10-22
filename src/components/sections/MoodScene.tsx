import { useRef } from 'react';
import { useParallax } from '../../hooks/useCursorGlow.ts';

/** Inner weather for each answer; `calm` is the quiet evening before anything is chosen. */
export const WEATHER = ['calm', 'storm', 'sunset', 'fog', 'dawn'] as const;
export type Weather = (typeof WEATHER)[number];
export const WEATHER_NAME: Record<Weather, string> = { calm: 'тихий вечер', storm: 'ветер и облака', sunset: 'тёплый закат', fog: 'утренний туман', dawn: 'рассвет' };

const STARS = [[60, 70, 1.4], [130, 40, 1], [200, 95, 1.2], [270, 50, 0.9], [345, 85, 1.5], [420, 35, 1], [490, 75, 1.2], [545, 120, 0.9], [95, 140, 0.8], [385, 140, 0.9], [235, 150, 1], [470, 160, 0.8], [30, 190, 1], [570, 50, 1.1]];
const RAIN = Array.from({ length: 26 }, (_, i) => [((i * 97) % 600) + 8, ((i * 53) % 180) + 120]);
const REEDS = [[48, 0], [62, 1], [74, 0.5], [530, 0.3], [545, 1], [560, 0]];

/**
 * A drawn landscape that changes its weather with the visitor's answer.
 * Every change is a CSS transition on the scene (sky colours, sun height, cloud cover, fog),
 * so a new answer mid-change simply retargets instead of restarting. Layers drift with the
 * pointer on a spring through `data-depth`.
 */
export function MoodScene({ weather }: { weather: Weather }) {
  const root = useRef<HTMLDivElement>(null);
  useParallax(root);
  return <div className="scene" data-weather={weather} ref={root} aria-hidden="true">
    <svg viewBox="0 0 600 640" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop className="sky-top" offset="0" /><stop className="sky-mid" offset=".55" /><stop className="sky-low" offset="1" /></linearGradient>
        <radialGradient id="sun-glow"><stop offset="0" stopColor="#fff2d4" stopOpacity=".9" /><stop offset=".35" className="glow-mid" stopOpacity=".45" /><stop offset="1" className="glow-mid" stopOpacity="0" /></radialGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop className="water-top" offset="0" /><stop className="water-low" offset="1" /></linearGradient>
        <mask id="moon-mask" maskUnits="userSpaceOnUse" x="-130" y="-130" width="260" height="260"><rect x="-130" y="-130" width="260" height="260" fill="#fff" /><circle className="moon-cut" r="31" cx="14" cy="-8" fill="#000" /></mask>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" /></filter>
        <filter id="softer" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="28" /></filter>
      </defs>
      <rect className="sky" width="600" height="640" fill="url(#sky)" />
      <g className="stars" data-depth="4,3">{STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={{ animationDelay: `${(i % 5) * 0.7}s` }} />)}</g>
      <g className="sun-wrap" data-depth="10,6"><g className="sun"><circle r="120" fill="url(#sun-glow)" /><circle className="sun-disc" r="34" mask="url(#moon-mask)" /></g></g>
      <g className="clouds clouds--far" data-depth="14,4" filter="url(#soft)"><ellipse cx="120" cy="150" rx="110" ry="26" /><ellipse cx="420" cy="120" rx="140" ry="30" /><ellipse cx="300" cy="200" rx="160" ry="24" /></g>
      <g className="clouds clouds--near" data-depth="22,6"><g className="cloud cloud--a"><path d="M40 210c0-22 22-34 42-26 8-20 40-26 56-6 20-6 40 6 38 28 0 14-12 22-26 22H66c-16 0-26-8-26-18Z" /></g><g className="cloud cloud--b"><path d="M330 160c0-20 20-30 38-22 8-18 36-24 52-6 18-6 36 6 34 26 0 12-10 20-24 20h-76c-14 0-24-8-24-18Z" /></g><g className="cloud cloud--c"><path d="M440 250c0-16 16-24 30-18 6-14 30-18 42-4 14-4 28 4 27 20 0 10-8 16-19 16h-60c-12 0-20-6-20-14Z" /></g></g>
      <g className="rain" data-depth="18,8">{RAIN.map(([x, y], i) => <path key={i} d={`M${x} ${y}l-10 26`} style={{ animationDelay: `${(i % 7) * -0.17}s` }} />)}</g>
      <g className="birds" data-depth="26,10"><path className="bird bird--a" d="M0 0q8-8 16 0q8-8 16 0" /><path className="bird bird--b" d="M0 0q6-6 12 0q6-6 12 0" /><path className="bird bird--c" d="M0 0q5-5 10 0q5-5 10 0" /></g>
      <path className="hill hill--far" data-depth="6,2" d="M0 400 C80 350 140 360 210 330 C290 296 350 330 420 310 C500 290 560 330 600 320 V640 H0Z" />
      <path className="hill hill--mid" data-depth="12,3" d="M0 430 C70 410 130 380 200 400 C280 424 330 380 410 392 C490 404 540 420 600 400 V640 H0Z" />
      <g className="pines" data-depth="16,4">{[[30, 420, 1], [70, 432, .8], [500, 410, 1.1], [540, 428, .85], [575, 418, .7]].map(([x, y, k], i) => <path key={i} d={`M${x} ${y - 70 * k} l${-16 * k} ${34 * k} h${8 * k} l${-14 * k} ${26 * k} h${10 * k} l${-12 * k} ${22 * k} h${48 * k} l${-12 * k} ${-22 * k} h${10 * k} l${-14 * k} ${-26 * k} h${8 * k}Z`} />)}</g>
      <rect className="lake" y="452" width="600" height="188" fill="url(#water)" data-depth="8,2" />
      <g className="reflection" data-depth="8,2"><ellipse className="sun-path" cx="0" cy="0" rx="46" ry="5" /><ellipse className="sun-path" cx="0" cy="18" rx="30" ry="3.5" /><ellipse className="sun-path" cx="0" cy="34" rx="18" ry="2.5" /></g>
      <g className="ripples" data-depth="8,2"><path d="M80 500h60M220 520h90M400 498h70M140 560h50M330 580h110M60 610h80" /></g>
      <g className="reeds" data-depth="30,6">{REEDS.map(([x, d], i) => <g key={i} style={{ animationDelay: `${-d * 2}s` }} className="reed"><path d={`M${x} 640 C${x - 2} 600 ${x + 4} 570 ${x + 2} ${540 - d * 20}`} /><ellipse cx={x + 2} cy={548 - d * 20} rx="3" ry="11" /></g>)}</g>
      <g className="fog" filter="url(#softer)"><rect className="fog-band fog-band--a" x="-100" y="330" width="800" height="70" /><rect className="fog-band fog-band--b" x="-100" y="420" width="800" height="90" /><rect className="fog-band fog-band--c" x="-100" y="230" width="800" height="60" /></g>
    </svg>
  </div>;
}
