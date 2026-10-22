import { lazy, Suspense, useEffect, useState, type MouseEvent } from 'react';
import { serverUrl } from '../../lib/paths.ts';
import { hasAdminHint } from '../../lib/api.ts';

// The editor downloads only for the signed-in reader, never for visitors.
const AdminBar = lazy(() => import('../../site-admin/AdminBar.tsx').then((m) => ({ default: m.AdminBar })));

const OPEN_EVENT = 'psy-admin-open';
const HIDDEN_KEY = 'psy-admin-hidden';

/**
 * The quiet key in the footer (as in ICG). For visitors it leads to the panel's login;
 * for the signed-in reader it brings back a hidden toolbar.
 */
export function AdminKey() {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!hasAdminHint()) return;
    event.preventDefault();
    window.dispatchEvent(new Event(OPEN_EVENT));
  };
  return (
    <a className="admin-key" href={serverUrl('/admin')} onClick={onClick} aria-label="Вход для специалиста" title="Вход для специалиста">
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="7" cy="10" r="3.25" />
        <path d="M10.25 10h7M14.5 10v2.5M16.75 10v1.75" />
      </svg>
    </a>
  );
}

type State = 'visitor' | 'admin' | 'hidden';

/** Mounted on every page; renders nothing for visitors. */
export function AdminHost() {
  const [state, setState] = useState<State>('visitor');

  // Restore the toolbar after a reload while the session is valid.
  useEffect(() => {
    if (!hasAdminHint()) return;
    let cancelled = false;
    fetch(serverUrl('/api/admin/session'), { cache: 'no-store' })
      .then((r) => r.json())
      .then((session: { admin: boolean }) => {
        if (cancelled || !session.admin) return;
        const hidden = sessionStorage.getItem(HIDDEN_KEY) && !new URLSearchParams(location.search).has('edit');
        setState(hidden ? 'hidden' : 'admin');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const open = () => {
      sessionStorage.removeItem(HIDDEN_KEY);
      setState((current) => (current === 'visitor' ? (hasAdminHint() ? 'admin' : current) : 'admin'));
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  if (state !== 'admin') return null;
  return (
    <Suspense fallback={null}>
      <AdminBar
        onHide={() => {
          sessionStorage.setItem(HIDDEN_KEY, '1');
          setState('hidden');
        }}
        onLogout={() => setState('visitor')}
      />
    </Suspense>
  );
}
