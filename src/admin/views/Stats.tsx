import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { RANGES, type RangeId, type Row, type Stats, type Totals } from '../../../shared/analytics.ts';
import { Unauthorized, adminApi, type LoginEntry } from '../api.ts';
import { ago, money } from '../format.ts';
import { useAdmin } from '../store.tsx';

const regionNames = new Intl.DisplayNames(['ru'], { type: 'region' });
const countryName = (code: string) => {
  if (!code) return 'Не определено';
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
};

const SECTION_NAMES: Record<string, string> = {
  hero: 'Первый экран',
  topics: 'С чем прийти',
  about: 'Обо мне',
  principles: 'Принципы работы',
  method: 'Метод',
  process: 'Первые шаги',
  services: 'Цены',
  gallery: 'Кадр из подкаста',
  reviews: 'Отзывы',
  reflection: 'Минута для себя',
  breathe: 'Дыхание',
  location: 'Где принимаю',
  faq: 'Вопросы',
  booking: 'Запись',
  project: 'Проект «Протри Внутри»',
  footer: 'Подвал',
};
const DEVICE_NAMES = { desktop: 'Компьютер', mobile: 'Телефон', tablet: 'Планшет' } as const;
const EVENT_NAMES: Record<string, string> = {
  pageview: 'Открыл сайт',
  telegram: 'Написал в Telegram',
  max: 'Max или звонок',
  b17: 'Открыл профиль на B17',
  channel: 'Перешёл в канал «Протри Внутри»',
  request: 'Оставил заявку',
};

const number = new Intl.NumberFormat('ru-RU');
const duration = (seconds: number) => {
  if (!seconds) return '—';
  const s = Math.round(seconds);
  return s < 60 ? `${s} с` : `${Math.floor(s / 60)} мин ${String(s % 60).padStart(2, '0')} с`;
};
const percent = (value: number) => `${(value * 100).toFixed(value > 0 && value < 0.1 ? 1 : 0)}%`;

function delta(current: number, previous: number) {
  if (!previous) return null;
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.005) return { text: 'как раньше', tone: 'flat' };
  return { text: `${change > 0 ? '↑' : '↓'} ${Math.abs(Math.round(change * 100))}%`, tone: change > 0 ? 'up' : 'down' };
}

/** "Москва, Россия", or a note when the place is unknown (local network, no geo headers). */
function place(city?: string, country?: string) {
  const parts = [city, country ? countryName(country) : ''].filter(Boolean);
  return parts.join(', ');
}

const DEVICE_ICONS = {
  desktop: 'M3 5h18v11H3ZM9 20h6M12 16v4',
  mobile: 'M8 2.5h8v19H8ZM11 18.5h2',
  tablet: 'M5 3h14v18H5ZM11 18h2',
} as const;

/** Every sign-in to the panel: when, from what device, browser and city, and whether it worked. */
function Logins() {
  const { fmt, now } = useAdmin();
  const [items, setItems] = useState<LoginEntry[] | null>(null);
  useEffect(() => {
    adminApi
      .logins()
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, []);
  const failed = items?.filter((i) => !i.ok && now - i.ts < 7 * 86_400_000).length ?? 0;
  return (
    <section className="a-panel a-panel--wide">
      <h3 className="a-block__title">
        Входы в панель
        {failed > 0 && <span className="a-legend a-legend--warn">{failed} неудачных за неделю</span>}
      </h3>
      {items === null ? (
        <div className="a-skeleton" />
      ) : items.length === 0 ? (
        <p className="a-empty a-empty--sm">Входов пока нет.</p>
      ) : (
        <div className="a-logins" role="table" aria-label="Входы в панель">
          <div className="a-logins__row a-logins__row--head" role="row">
            <span role="columnheader">Когда</span>
            <span role="columnheader">Устройство</span>
            <span role="columnheader">Браузер</span>
            <span role="columnheader">Откуда</span>
            <span role="columnheader">Результат</span>
          </div>
          {items.slice(0, 25).map((entry, i) => (
            <div key={`${entry.ts}-${i}`} className="a-logins__row" role="row" data-ok={entry.ok} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
              <span role="cell">
                {fmt.when(entry.ts, now)}
                <small>{ago(entry.ts, now)}</small>
              </span>
              <span role="cell" className="a-logins__device">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={DEVICE_ICONS[entry.device]} />
                </svg>
                <span>
                  {DEVICE_NAMES[entry.device]}
                  <small>{entry.os}</small>
                </span>
              </span>
              <span role="cell">{entry.browser}</span>
              <span role="cell">
                {place(entry.city, entry.country) || 'Город не определён'}
                <small>IP {entry.ip}</small>
              </span>
              <span role="cell" className="a-logins__result">
                {entry.ok ? 'Вход' : 'Неверный пароль'}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="a-meta">Город и страна определяются на хостинге (Vercel). При запуске на своём компьютере вход виден как «локальная сеть».</p>
    </section>
  );
}

function Kpi({ label, value, current, previous, hint }: { label: string; value: string; current: number; previous: number; hint?: string }) {
  const d = delta(current, previous);
  return (
    <div className="a-kpi">
      <span>{label}</span>
      <b>{value}</b>
      {d ? <small data-tone={d.tone}>{d.text}</small> : hint ? <small>{hint}</small> : null}
    </div>
  );
}

function Bars({ rows, total, names }: { rows: Row[]; total?: number; names?: (name: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="a-empty a-empty--sm">Пока пусто</p>;
  return (
    <ul className="a-bars">
      {rows.map((r, i) => (
        <li key={r.name} style={{ '--w': r.value / max, '--i': i } as CSSProperties}>
          <span className="a-bars__name">{names ? names(r.name) : r.name}</span>
          <span className="a-bars__value">
            {number.format(r.value)}
            {total ? <small>{percent(r.value / total)}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Visitors as bars, leads (requests and messenger clicks) as gold points above them. */
function Chart({ series }: { series: Stats['series'] }) {
  const max = Math.max(1, ...series.map((s) => s.visitors));
  const W = 720;
  const H = 180;
  const step = W / series.length;
  const label = series.length > 14 ? Math.ceil(series.length / 10) : series.length > 24 ? 3 : 1;
  return (
    <svg className="a-chart" viewBox={`0 0 ${W} ${H + 24}`} role="img" aria-label="Посетители и обращения по дням">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1="0" x2={W} y1={H - f * H} y2={H - f * H} className="a-chart__grid" />
      ))}
      {series.map((s, i) => {
        const h = (s.visitors / max) * (H - 10);
        return (
          <g key={s.key} style={{ '--i': i } as CSSProperties}>
            <rect className="a-chart__bar" x={i * step + step * 0.18} y={H - h} width={step * 0.64} height={Math.max(h, s.visitors ? 2 : 0)} rx="1">
              <title>{`${s.label}: ${s.visitors} посетителей, ${s.pageviews} просмотров, ${s.leads} обращений`}</title>
            </rect>
            {s.leads > 0 && <circle className="a-chart__lead" cx={i * step + step / 2} cy={H - h - 9} r={Math.min(3 + s.leads, 7)} />}
            {i % label === 0 && (
              <text x={i * step + step / 2} y={H + 17} className="a-chart__label">
                {s.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function StatsView() {
  const { status, requests, now } = useAdmin();
  const [range, setRange] = useState<RangeId>('7d');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    adminApi
      .stats(range)
      .then((s) => !cancelled && setStats(s))
      .catch((cause) => !cancelled && setError(cause instanceof Unauthorized ? 'Сессия закончилась — войдите снова.' : 'Не получилось загрузить статистику.'));
    return () => {
      cancelled = true;
    };
  }, [range]);

  // Business side of the same period, from the requests themselves.
  const business = useMemo(() => {
    const from = stats?.from ?? now - RANGES[range].days * 86_400_000;
    const fresh = requests.filter((r) => r.createdAt >= from);
    const done = requests.filter((r) => r.status === 'done' && (r.completedAt ?? 0) >= from);
    return {
      fresh: fresh.length,
      fromSite: fresh.filter((r) => r.source === 'site').length,
      done: done.length,
      revenue: done.reduce((s, r) => s + (r.paid ? (r.price ?? 0) : 0), 0),
    };
  }, [requests, stats, range, now]);

  if (!status.analytics) {
    return <p className="a-empty">Статистика собирается, когда подключено хранилище. Подробности — в «Настройках».</p>;
  }

  const t: Totals | undefined = stats?.totals;
  const p: Totals | undefined = stats?.previous;

  return (
    <div className="a-stats" data-loading={!stats}>
      <div className="a-toolbar">
        <div className="a-segment" role="group" aria-label="Период">
          {(Object.keys(RANGES) as RangeId[]).map((id) => (
            <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}>
              {RANGES[id].label}
            </button>
          ))}
        </div>
        {error && <p className="a-warn">{error}</p>}
      </div>

      <div className="a-kpis">
        <Kpi label="Посетители" value={t ? number.format(t.visitors) : '…'} current={t?.visitors ?? 0} previous={p?.visitors ?? 0} />
        <Kpi label="Заявки с сайта" value={t ? number.format(t.requests) : '…'} current={t?.requests ?? 0} previous={p?.requests ?? 0} />
        <Kpi label="Переходы в мессенджеры" value={t ? number.format(t.channels) : '…'} current={t?.channels ?? 0} previous={p?.channels ?? 0} />
        <Kpi label="Конверсия" value={t ? percent(t.conversion) : '…'} current={t?.conversion ?? 0} previous={p?.conversion ?? 0} hint="обратились / пришли" />
        <Kpi label="Время на сайте" value={t ? duration(t.avgDuration) : '…'} current={t?.avgDuration ?? 0} previous={p?.avgDuration ?? 0} />
      </div>

      <div className="a-kpis a-kpis--quiet">
        <div className="a-kpi">
          <span>Новых заявок</span>
          <b>{business.fresh}</b>
          <small>{business.fromSite} с сайта</small>
        </div>
        <div className="a-kpi">
          <span>Проведено встреч</span>
          <b>{business.done}</b>
        </div>
        <div className="a-kpi">
          <span>Получено</span>
          <b>{money(business.revenue)}</b>
        </div>
      </div>

      <Logins />

      {stats && !stats.hasData && <p className="a-empty">За этот период посещений ещё нет. Данные появятся, когда кто-нибудь откроет сайт.</p>}

      {stats && stats.hasData && (
        <>
          <section className="a-panel a-panel--wide">
            <h3 className="a-block__title">
              Посетители <span className="a-legend a-legend--lead">● обращения</span>
            </h3>
            <Chart series={stats.series} />
          </section>

          <div className="a-panels">
            <section className="a-panel">
              <h3 className="a-block__title">Откуда пришли</h3>
              <Bars rows={stats.sources} total={t?.visitors} />
            </section>
            <section className="a-panel">
              <h3 className="a-block__title">Как обращались</h3>
              <Bars rows={stats.channels} />
            </section>
            <section className="a-panel">
              <h3 className="a-block__title">До чего дочитали</h3>
              <Bars rows={stats.funnel.map((f) => ({ name: f.id, value: f.value }))} total={stats.funnelBase} names={(id) => SECTION_NAMES[id] ?? id} />
            </section>
            <section className="a-panel">
              <h3 className="a-block__title">Устройства</h3>
              <Bars rows={stats.devices.filter((d) => d.value > 0).map((d) => ({ name: d.name, value: d.value }))} total={t?.visitors} names={(n) => DEVICE_NAMES[n as keyof typeof DEVICE_NAMES] ?? n} />
              <h4 className="a-panel__sub">Браузеры</h4>
              <Bars rows={stats.browsers} />
            </section>
            <section className="a-panel">
              <h3 className="a-block__title">География</h3>
              <Bars rows={stats.countries.slice(0, 8).map((c) => ({ name: c.code, value: c.value }))} total={t?.visitors} names={countryName} />
              {stats.countries[0]?.cities.length ? (
                <>
                  <h4 className="a-panel__sub">Города · {countryName(stats.countries[0].code)}</h4>
                  <Bars rows={stats.countries[0].cities.slice(0, 6).map((c) => ({ ...c, name: c.name || 'Не определён' }))} />
                </>
              ) : null}
            </section>
            <section className="a-panel">
              <h3 className="a-block__title">Только что</h3>
              <ol className="a-feed">
                {stats.recent.slice(0, 12).map((e, i) => (
                  <li key={`${e.ts}-${i}`} data-type={e.type}>
                    <span>{EVENT_NAMES[e.type] ?? e.type}</span>
                    <small>
                      {[place(e.city, e.country), DEVICE_NAMES[e.device], e.os, e.browser, e.source].filter(Boolean).join(' · ')} · {ago(e.ts, now)}
                    </small>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
