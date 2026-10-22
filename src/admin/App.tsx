import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { site } from '../config/site.ts';
import { ERROR_TEXT, adminApi, type Status } from './api.ts';
import { AdminIcon, type IconName } from './icons.tsx';
import { AdminProvider, useAdmin } from './store.tsx';
import { Archive } from './views/Archive.tsx';
import { Board } from './views/Board.tsx';
import { RequestDrawer } from './views/RequestDrawer.tsx';
import { Schedule } from './views/Schedule.tsx';
import { Settings } from './views/Settings.tsx';
import { StatsView } from './views/Stats.tsx';

type Phase = { kind: 'loading' } | { kind: 'login'; configured: boolean } | { kind: 'in'; status: Status };

/** Gate: checks the session, shows the login, then the panel. */
export function AdminApp() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  const enter = useCallback(async () => {
    try {
      setPhase({ kind: 'in', status: await adminApi.status() });
    } catch {
      setPhase({ kind: 'login', configured: true });
    }
  }, []);

  useEffect(() => {
    adminApi
      .session()
      .then((s) => (s.admin ? enter() : setPhase({ kind: 'login', configured: s.configured })))
      .catch(() => setPhase({ kind: 'login', configured: true }));
  }, [enter]);

  if (phase.kind === 'loading') return <div className="a-splash" aria-busy="true"><span className="a-splash__moon" /></div>;
  if (phase.kind === 'login') return <Login configured={phase.configured} onSuccess={enter} />;
  return (
    <AdminProvider status={phase.status} onSignedOut={() => setPhase({ kind: 'login', configured: true })}>
      <Shell onLogout={() => setPhase({ kind: 'login', configured: true })} />
    </AdminProvider>
  );
}

function Login({ configured, onSuccess }: { configured: boolean; onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(configured ? '' : ERROR_TEXT['not-configured']);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await adminApi.login(password);
      onSuccess();
    } catch (cause) {
      setError(ERROR_TEXT[cause instanceof Error ? cause.message : ''] ?? 'Не получилось войти. Попробуйте ещё раз.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="a-login">
      <form className="a-login__card" onSubmit={submit} data-error={Boolean(error)}>
        <span className="a-login__moon" aria-hidden="true" />
        <p className="a-eyebrow">{site.meta.brand}</p>
        <h1 className="a-login__title">Кабинет психолога</h1>
        <label className="a-field">
          <span>Пароль</span>
          <input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} disabled={!configured} />
        </label>
        <p className="a-login__error" role="alert">
          {error}
        </p>
        <button type="submit" className="a-btn a-btn--primary" disabled={!password || busy || !configured}>
          {busy ? 'Проверяю…' : 'Войти'}
        </button>
        <a className="a-login__back" href="/">
          ← Вернуться на сайт
        </a>
      </form>
    </main>
  );
}

const VIEWS: { id: string; label: string; icon: IconName }[] = [
  { id: 'requests', label: 'Заявки', icon: 'requests' },
  { id: 'schedule', label: 'Расписание', icon: 'schedule' },
  { id: 'archive', label: 'Архив', icon: 'archive' },
  { id: 'stats', label: 'Статистика', icon: 'stats' },
  { id: 'settings', label: 'Настройки', icon: 'settings' },
];

const viewFromHash = () => {
  const id = location.hash.slice(1);
  return VIEWS.some((v) => v.id === id) ? id : 'requests';
};

function Shell({ onLogout }: { onLogout: () => void }) {
  const { requests, open, toasts, dismiss } = useAdmin();
  const [view, setView] = useState(viewFromHash);
  const [live, setLive] = useState<number | null>(null);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const load = () => adminApi.live().then((d) => setLive(d.live)).catch(() => {});
    load();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && load(), 20_000);
    return () => window.clearInterval(timer);
  }, []);

  const fresh = requests.filter((r) => r.status === 'new').length;
  const today = requests.filter((r) => r.status === 'scheduled').length;
  const current = VIEWS.find((v) => v.id === view)!;

  const logout = async () => {
    await adminApi.logout().catch(() => {});
    onLogout();
  };

  return (
    <div className="a-shell">
      <aside className="a-side">
        <a className="a-brand" href="/" title="Открыть сайт">
          <span className="a-brand__moon" aria-hidden="true" />
          <span>
            {site.meta.brand}
            <small>панель</small>
          </span>
        </a>
        <nav className="a-nav" aria-label="Разделы панели">
          {VIEWS.map((v) => (
            <a key={v.id} href={`#${v.id}`} className="a-nav__item" aria-current={view === v.id ? 'page' : undefined}>
              <AdminIcon name={v.icon} />
              <span>{v.label}</span>
              {v.id === 'requests' && fresh > 0 && <span className="a-nav__badge">{fresh}</span>}
              {v.id === 'schedule' && today > 0 && <span className="a-nav__count">{today}</span>}
            </a>
          ))}
        </nav>
        <button type="button" className="a-side__logout" onClick={logout}>
          <AdminIcon name="logout" />
          <span>Выйти</span>
        </button>
      </aside>

      <div className="a-main">
        <header className="a-top">
          <h1 className="a-top__title" key={view}>
            {current.label}
          </h1>
          <div className="a-top__tools">
            {live !== null && (
              <span className="a-live" title="Посетители за последние пять минут">
                <span className="a-live__dot" data-on={live > 0} aria-hidden="true" />
                {live} на сайте
              </span>
            )}
            <button type="button" className="a-btn a-btn--primary a-btn--sm" onClick={() => open('new')}>
              <AdminIcon name="plus" size={16} /> Заявка
            </button>
            <a className="a-btn a-btn--ghost a-btn--sm" href="/?edit" title="Открыть сайт в режиме правки: клик по любому тексту">
              <AdminIcon name="content" size={15} /> Редактировать сайт
            </a>
          </div>
        </header>

        <main className="a-view" key={view}>
          {view === 'requests' && <Board />}
          {view === 'schedule' && <Schedule />}
          {view === 'archive' && <Archive />}
          {view === 'stats' && <StatsView />}
          {view === 'settings' && <Settings onLogout={logout} />}
        </main>
      </div>

      <RequestDrawer />

      <div className="a-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="a-toast" data-tone={t.tone}>
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                className="a-link"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="a-toast__close" onClick={() => dismiss(t.id)} aria-label="Скрыть">
              <AdminIcon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
