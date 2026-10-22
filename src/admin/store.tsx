import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { BookingRequest, RequestPatch } from '../../shared/booking.ts';
import { EMPTY_OVERRIDES, type ContentOverrides } from '../../shared/content.ts';
import { site } from '../config/site.ts';
import { applyOverrides } from '../lib/overrides.ts';
import { ERROR_TEXT, Unauthorized, adminApi, type Status } from './api.ts';
import { formatters, type Formatters } from './format.ts';

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'new';
  action?: { label: string; run: () => void };
}

interface AdminState {
  status: Status;
  fmt: Formatters;
  requests: BookingRequest[];
  loaded: boolean;
  now: number;
  patch: (id: string, patch: RequestPatch, options?: { animate?: boolean }) => Promise<void>;
  create: (data: Record<string, unknown>) => Promise<BookingRequest | null>;
  remove: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  openId: string | null;
  open: (id: string | null) => void;
  /** Opens "new request" with a day and time already filled in (from a calendar slot). */
  openNew: (prefill: { date: string; time: string }) => void;
  prefill: { date: string; time: string } | null;
  overrides: ContentOverrides;
  saveOverrides: (next: ContentOverrides) => Promise<boolean>;
  services: typeof site.services.items;
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  toasts: Toast[];
  dismiss: (id: number) => void;
  notifications: boolean;
  setNotifications: (on: boolean) => void;
}

const Ctx = createContext<AdminState | null>(null);
export const useAdmin = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdmin outside AdminProvider');
  return ctx;
};

const POLL_MS = 15_000;

/** Runs a state change inside a view transition, so cards glide between columns. */
export function transition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    doc.startViewTransition(() => flushSync(update));
  } else update();
}

function readNotifications() {
  try {
    return localStorage.getItem('psy-notify') === '1';
  } catch {
    return false;
  }
}

export function AdminProvider({ status, onSignedOut, children }: { status: Status; onSignedOut: () => void; children: ReactNode }) {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [openId, setOpenId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ date: string; time: string } | null>(null);
  const [overrides, setOverrides] = useState<ContentOverrides>(EMPTY_OVERRIDES);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotificationsState] = useState(readNotifications);
  const known = useRef<Set<string> | null>(null);
  const toastId = useRef(0);
  const fmt = useMemo(() => formatters(status.tz), [status.tz]);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (text: string, tone: Toast['tone'] = 'ok', action?: Toast['action']) => {
      const id = ++toastId.current;
      setToasts((list) => [...list.slice(-3), { id, text, tone, action }]);
      window.setTimeout(() => dismiss(id), tone === 'new' ? 9000 : 4200);
    },
    [dismiss],
  );

  const fail = useCallback(
    (cause: unknown) => {
      if (cause instanceof Unauthorized) return onSignedOut();
      const code = cause instanceof Error ? cause.message : '';
      toast(ERROR_TEXT[code] ?? 'Не получилось сохранить. Проверьте связь и попробуйте ещё раз.', 'error');
    },
    [onSignedOut, toast],
  );

  const reload = useCallback(async () => {
    try {
      const data = await adminApi.requests();
      setNow(data.now);
      // New requests since the last look: a toast, a browser notification if allowed.
      if (known.current) {
        const fresh = data.items.filter((r) => !known.current!.has(r.id) && r.source === 'site');
        for (const r of fresh) {
          toast(`Новая заявка: ${r.name}${r.serviceTitle ? ` · ${r.serviceTitle}` : ''}`, 'new', { label: 'Открыть', run: () => setOpenId(r.id) });
          if (readNotifications() && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Новая заявка', { body: `${r.name}${r.serviceTitle ? ` — ${r.serviceTitle}` : ''}`, icon: '/favicon.svg' });
          }
        }
      }
      known.current = new Set(data.items.map((r) => r.id));
      setRequests(data.items);
      setLoaded(true);
    } catch (cause) {
      if (cause instanceof Unauthorized) onSignedOut();
      else setLoaded(true);
    }
  }, [onSignedOut, toast]);

  useEffect(() => {
    void reload();
    adminApi.content().then(setOverrides).catch(() => {});
    let timer = window.setInterval(() => document.visibilityState === 'visible' && void reload(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void reload();
      window.clearInterval(timer);
      timer = window.setInterval(() => document.visibilityState === 'visible' && void reload(), POLL_MS);
    };
    document.addEventListener('visibilitychange', onVisible);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  // Unread count in the tab title, so the panel can sit in a background tab.
  useEffect(() => {
    const fresh = requests.filter((r) => r.status === 'new').length;
    document.title = `${fresh ? `(${fresh}) ` : ''}Панель · ${site.meta.brand}`;
  }, [requests]);

  const patch = useCallback<AdminState['patch']>(
    async (id, change, options) => {
      const before = requests.find((r) => r.id === id);
      if (!before) return;
      const apply = () => setRequests((list) => list.map((r) => (r.id === id ? { ...r, ...change, updatedAt: Date.now() } : r)));
      if (options?.animate) transition(apply);
      else apply();
      try {
        const { item } = await adminApi.patch(id, change);
        setRequests((list) => list.map((r) => (r.id === id ? item : r)));
      } catch (cause) {
        setRequests((list) => list.map((r) => (r.id === id ? before : r)));
        fail(cause);
      }
    },
    [requests, fail],
  );

  const create = useCallback<AdminState['create']>(
    async (data) => {
      try {
        const { item } = await adminApi.create(data);
        known.current?.add(item.id);
        transition(() => setRequests((list) => [item, ...list]));
        return item;
      } catch (cause) {
        fail(cause);
        return null;
      }
    },
    [fail],
  );

  const remove = useCallback<AdminState['remove']>(
    async (id) => {
      const before = requests;
      transition(() => setRequests((list) => list.filter((r) => r.id !== id)));
      setOpenId((current) => (current === id ? null : current));
      try {
        await adminApi.remove(id);
        toast('Заявка удалена');
      } catch (cause) {
        setRequests(before);
        fail(cause);
      }
    },
    [requests, fail, toast],
  );

  const saveOverrides = useCallback<AdminState['saveOverrides']>(
    async (next) => {
      try {
        setOverrides(await adminApi.saveContent(next));
        return true;
      } catch (cause) {
        fail(cause);
        return false;
      }
    },
    [fail],
  );

  // Services as the site shows them: config defaults with published edits on top.
  const services = useMemo(() => {
    const copy = structuredClone(site);
    applyOverrides(copy, overrides);
    return copy.services.items;
  }, [overrides]);

  const setNotifications = useCallback((on: boolean) => {
    setNotificationsState(on);
    try {
      localStorage.setItem('psy-notify', on ? '1' : '0');
    } catch {
      // Private mode: the switch just will not be remembered.
    }
  }, []);

  const value: AdminState = {
    status,
    fmt,
    requests,
    loaded,
    now,
    patch,
    create,
    remove,
    reload,
    openId,
    open: (id) => {
      if (id !== 'new') setPrefill(null);
      setOpenId(id);
    },
    openNew: (fill) => {
      setPrefill(fill);
      setOpenId('new');
    },
    prefill,
    overrides,
    saveOverrides,
    services,
    toast,
    toasts,
    dismiss,
    notifications,
    setNotifications,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
