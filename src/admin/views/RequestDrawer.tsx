import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CONTACT_PREFS,
  CONTACT_PREF_LABELS,
  STATUSES,
  STATUS_LABELS,
  formatPhone,
  normalizePhone,
  type BookingRequest,
  type ContactPref,
  type RequestPatch,
} from '../../../shared/booking.ts';
import { dayKey, timeKey, zonedTime } from '../../../shared/time.ts';
import { money } from '../format.ts';
import { AdminIcon } from '../icons.tsx';
import { useAdmin } from '../store.tsx';

const DURATIONS = [30, 45, 60, 75, 90, 120];

/** Debounced autosave for text fields: typing never waits for the network. */
function useAutosave(save: (patch: RequestPatch) => void, delay = 600) {
  const pending = useRef<RequestPatch>({});
  const timer = useRef(0);
  const flush = () => {
    window.clearTimeout(timer.current);
    if (Object.keys(pending.current).length) save(pending.current);
    pending.current = {};
  };
  const queue = (patch: RequestPatch) => {
    pending.current = { ...pending.current, ...patch };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, delay);
  };
  return { queue, flush };
}

/**
 * Side sheet to view and edit one request (or add one by hand when `openId` is "new").
 * Opens a little slower than it closes; Escape and the backdrop close it.
 */
export function RequestDrawer() {
  const { openId, open, requests } = useAdmin();
  const dialog = useRef<HTMLDialogElement>(null);
  const isOpen = openId !== null;
  const request = requests.find((r) => r.id === openId) ?? null;
  // Keep the last content on screen while the sheet slides out.
  const [shown, setShown] = useState<{ id: string; request: BookingRequest | null } | null>(null);
  if (openId && (shown?.id !== openId || (request && shown.request !== request))) setShown({ id: openId, request });

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      className="a-drawer"
      aria-label={shown?.request ? `Заявка: ${shown.request.name}` : 'Новая заявка'}
      onCancel={(e) => {
        e.preventDefault();
        open(null);
      }}
      onClick={(e) => e.target === e.currentTarget && open(null)}
    >
      {shown && (shown.id === 'new' ? <CreateForm key="new" /> : shown.request ? <Editor key={shown.id} request={shown.request} /> : null)}
    </dialog>
  );
}

function Editor({ request: r }: { request: BookingRequest }) {
  const { patch, remove, open, fmt, status, services, requests, now } = useAdmin();
  const tz = status.tz;
  const [draft, setDraft] = useState({ name: r.name, phone: formatPhone(r.phone), question: r.question, notes: r.notes, price: r.price === null ? '' : String(r.price) });
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const service = services.find((s) => s.id === r.serviceId);

  const save = async (change: RequestPatch, animate = false) => {
    // A finished session without a price takes the format's price, so the archive adds up.
    if (change.status === 'done' && r.price === null && service) change = { ...change, price: service.price.amount };
    setSaved('saving');
    await patch(r.id, change, { animate });
    setSaved('saved');
  };
  const auto = useAutosave((change) => void save(change));
  // Unsaved typing is sent when the sheet closes.
  useEffect(() => () => auto.flush(), []);

  // Opening a request marks it read.
  useEffect(() => {
    if (!r.seen) void patch(r.id, { seen: true });
  }, [r.id]);

  const digits = r.phone.replace(/\D/g, '');
  const conflicts = useMemo(() => {
    if (!r.scheduledAt) return [];
    const end = r.scheduledAt + r.durationMin * 60_000;
    return requests.filter(
      (o) => o.id !== r.id && o.scheduledAt && o.status !== 'cancelled' && o.status !== 'done' && o.scheduledAt < end && o.scheduledAt + o.durationMin * 60_000 > r.scheduledAt!,
    );
  }, [requests, r]);

  const setSchedule = (date: string, time: string) => {
    if (!date || !time) return;
    const at = zonedTime(date, time, tz);
    void save({ scheduledAt: at, ...(r.status === 'new' || r.status === 'in_progress' ? { status: 'scheduled' } : {}) }, true);
  };

  const scheduledDate = r.scheduledAt ? dayKey(r.scheduledAt, tz) : '';
  const scheduledTime = r.scheduledAt ? timeKey(r.scheduledAt, tz) : '';

  return (
    <div className="a-drawer__panel">
      <header className="a-drawer__head">
        <div>
          <p className="a-eyebrow">
            {r.source === 'site' ? 'С сайта' : 'Добавлена вручную'} · {fmt.full(r.createdAt)}
          </p>
          <input
            className="a-drawer__name"
            value={draft.name}
            aria-label="Имя"
            onChange={(e) => {
              setDraft({ ...draft, name: e.target.value });
              auto.queue({ name: e.target.value });
            }}
            onBlur={auto.flush}
          />
        </div>
        <span className="a-saved" data-state={saved} aria-live="polite">
          {saved === 'saving' ? 'Сохраняю…' : saved === 'saved' ? 'Сохранено' : ''}
        </span>
        <button type="button" className="a-icon-btn" onClick={() => open(null)} aria-label="Закрыть">
          <AdminIcon name="close" />
        </button>
      </header>

      <div className="a-drawer__body">
        <div className="a-steps" role="group" aria-label="Статус">
          {STATUSES.map((s) => (
            <button key={s} type="button" data-status={s} aria-pressed={r.status === s} onClick={() => r.status !== s && void save({ status: s }, true)}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <section className="a-block">
          <h3 className="a-block__title">Связаться</h3>
          <div className="a-contact">
            <input
              className="a-input a-contact__phone"
              value={draft.phone}
              aria-label="Телефон"
              inputMode="tel"
              onChange={(e) => {
                setDraft({ ...draft, phone: e.target.value });
                auto.queue({ phone: e.target.value });
              }}
              onBlur={() => {
                auto.flush();
                const clean = normalizePhone(draft.phone);
                if (clean) setDraft((d) => ({ ...d, phone: formatPhone(clean) }));
              }}
            />
            <a className="a-btn a-btn--primary a-btn--sm" href={`tel:${r.phone}`}>
              <AdminIcon name="phone" size={15} /> Позвонить
            </a>
            <a className="a-btn a-btn--ghost a-btn--sm" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a className="a-btn a-btn--ghost a-btn--sm" href={`https://t.me/+${digits}`} target="_blank" rel="noopener noreferrer">
              Telegram
            </a>
            <button type="button" className="a-icon-btn" aria-label="Скопировать номер" onClick={() => navigator.clipboard?.writeText(formatPhone(r.phone)).catch(() => {})}>
              <AdminIcon name="copy" size={16} />
            </button>
          </div>
          <div className="a-chips" role="group" aria-label="Как удобнее связаться">
            {CONTACT_PREFS.map((p) => (
              <button key={p} type="button" aria-pressed={r.contactPref === p} onClick={() => void save({ contactPref: p as ContactPref })}>
                {CONTACT_PREF_LABELS[p]}
              </button>
            ))}
          </div>
        </section>

        <section className="a-block">
          <h3 className="a-block__title">Встреча</h3>
          {r.preferredAt && (
            <p className="a-prefer">
              Клиент просит: <strong>{fmt.full(r.preferredAt)}</strong>
              {r.scheduledAt !== r.preferredAt && (
                <button type="button" className="a-link" onClick={() => setSchedule(dayKey(r.preferredAt!, tz), timeKey(r.preferredAt!, tz))}>
                  Назначить на это время
                </button>
              )}
            </p>
          )}
          <div className="a-grid3">
            <label className="a-field">
              <span>День</span>
              <input type="date" className="a-input" value={scheduledDate} onChange={(e) => setSchedule(e.target.value, scheduledTime || '12:00')} />
            </label>
            <label className="a-field">
              <span>Время</span>
              <input type="time" className="a-input" step={900} value={scheduledTime} onChange={(e) => setSchedule(scheduledDate || dayKey(now, tz), e.target.value)} />
            </label>
            <label className="a-field">
              <span>Длительность</span>
              <select className="a-input" value={r.durationMin} onChange={(e) => void save({ durationMin: Number(e.target.value) })}>
                {[...new Set([...DURATIONS, r.durationMin])].sort((a, b) => a - b).map((m) => (
                  <option key={m} value={m}>
                    {m} мин
                  </option>
                ))}
              </select>
            </label>
          </div>
          {r.scheduledAt && (
            <p className="a-meta">
              {fmt.when(r.scheduledAt, now)} – {fmt.time(r.scheduledAt + r.durationMin * 60_000)}
              <button type="button" className="a-link" onClick={() => void save({ scheduledAt: null, ...(r.status === 'scheduled' ? { status: 'in_progress' } : {}) }, true)}>
                Снять время
              </button>
            </p>
          )}
          {conflicts.length > 0 && (
            <p className="a-warn">
              Накладывается на: {conflicts.map((c) => `${c.name} (${fmt.time(c.scheduledAt!)})`).join(', ')}
            </p>
          )}
        </section>

        <section className="a-block">
          <h3 className="a-block__title">Формат и оплата</h3>
          <div className="a-grid3">
            <label className="a-field a-field--wide">
              <span>Формат</span>
              <select
                className="a-input"
                value={r.serviceId ?? ''}
                onChange={(e) => {
                  const s = services.find((x) => x.id === e.target.value);
                  void save({
                    serviceId: s?.id ?? null,
                    serviceTitle: s?.title ?? null,
                    ...(s?.minutes ? { durationMin: s.minutes } : {}),
                    ...(r.price === null && s ? { price: s.price.amount } : {}),
                  });
                }}
              >
                <option value="">Не выбран</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · {money(s.price.amount)}
                  </option>
                ))}
              </select>
            </label>
            <label className="a-field">
              <span>Цена, ₽</span>
              <input
                className="a-input"
                inputMode="numeric"
                placeholder={service ? String(service.price.amount) : '—'}
                value={draft.price}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setDraft({ ...draft, price: value });
                  auto.queue({ price: value ? Number(value) : null });
                }}
                onBlur={auto.flush}
              />
            </label>
          </div>
          <label className="a-switch">
            <input type="checkbox" checked={r.paid} onChange={(e) => void save({ paid: e.target.checked })} />
            <span className="a-switch__track" aria-hidden="true" />
            Оплачено
          </label>
        </section>

        <section className="a-block">
          <h3 className="a-block__title">Вопрос клиента</h3>
          <textarea
            className="a-input a-textarea"
            rows={3}
            value={draft.question}
            onChange={(e) => {
              setDraft({ ...draft, question: e.target.value });
              auto.queue({ question: e.target.value });
            }}
            onBlur={auto.flush}
          />
        </section>

        <section className="a-block">
          <h3 className="a-block__title">Мои заметки</h3>
          <textarea
            className="a-input a-textarea"
            rows={4}
            placeholder="Что выпало, о чём договорились, что важно помнить к следующей встрече"
            value={draft.notes}
            onChange={(e) => {
              setDraft({ ...draft, notes: e.target.value });
              auto.queue({ notes: e.target.value });
            }}
            onBlur={auto.flush}
          />
        </section>

        <section className="a-block">
          <h3 className="a-block__title">История</h3>
          <ol className="a-history">
            {[...r.history].reverse().map((h, i) => (
              <li key={`${h.ts}-${i}`} data-status={h.status}>
                <span>{STATUS_LABELS[h.status]}</span>
                <time>{fmt.full(h.ts)}</time>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="a-drawer__foot">
        {confirmDelete ? (
          <>
            <span className="a-warn">Удалить заявку насовсем?</span>
            <button type="button" className="a-btn a-btn--danger a-btn--sm" onClick={() => void remove(r.id)}>
              Удалить
            </button>
            <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setConfirmDelete(false)}>
              Не надо
            </button>
          </>
        ) : (
          <>
            <button type="button" className="a-icon-btn" onClick={() => setConfirmDelete(true)} aria-label="Удалить заявку">
              <AdminIcon name="trash" size={16} />
            </button>
            {r.status !== 'done' && r.status !== 'cancelled' && (
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => void save({ status: 'cancelled' }, true)}>
                Отменить
              </button>
            )}
            {r.status === 'scheduled' && (
              <button type="button" className="a-btn a-btn--primary a-btn--sm" onClick={() => void save({ status: 'done' }, true)}>
                <AdminIcon name="check" size={15} /> Встреча прошла
              </button>
            )}
            {(r.status === 'done' || r.status === 'cancelled') && (
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => void save({ status: 'in_progress' }, true)}>
                Вернуть в работу
              </button>
            )}
          </>
        )}
      </footer>
    </div>
  );
}

/** A request taken by phone or in a chat, added by hand. */
function CreateForm() {
  const { create, open, services, status, now, prefill } = useAdmin();
  const [form, setForm] = useState({ name: '', phone: '', serviceId: '', date: prefill?.date ?? '', time: prefill?.time ?? '', question: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const submit = async () => {
    if (!form.name.trim() || busy) return;
    setBusy(true);
    const s = services.find((x) => x.id === form.serviceId);
    const item = await create({
      name: form.name,
      phone: form.phone,
      serviceId: s?.id ?? null,
      serviceTitle: s?.title ?? null,
      durationMin: s?.minutes ?? 60,
      price: s?.price.amount ?? null,
      question: form.question,
      notes: form.notes,
      scheduledAt: form.date && form.time ? zonedTime(form.date, form.time, status.tz) : null,
    });
    setBusy(false);
    if (item) open(item.id);
  };

  return (
    <div className="a-drawer__panel">
      <header className="a-drawer__head">
        <div>
          <p className="a-eyebrow">Вручную · звонок, переписка, знакомые</p>
          <h2 className="a-drawer__title">Новая заявка</h2>
        </div>
        <button type="button" className="a-icon-btn" onClick={() => open(null)} aria-label="Закрыть">
          <AdminIcon name="close" />
        </button>
      </header>
      <div className="a-drawer__body">
        <div className="a-grid2">
          <label className="a-field">
            <span>Имя</span>
            <input className="a-input" value={form.name} onChange={set('name')} autoFocus />
          </label>
          <label className="a-field">
            <span>Телефон</span>
            <input className="a-input" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="+7…" />
          </label>
        </div>
        <label className="a-field">
          <span>Формат</span>
          <select className="a-input" value={form.serviceId} onChange={set('serviceId')}>
            <option value="">Не выбран</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <div className="a-grid2">
          <label className="a-field">
            <span>День</span>
            <input type="date" className="a-input" value={form.date} min={dayKey(now, status.tz)} onChange={set('date')} />
          </label>
          <label className="a-field">
            <span>Время</span>
            <input type="time" className="a-input" step={900} value={form.time} onChange={set('time')} />
          </label>
        </div>
        <label className="a-field">
          <span>Вопрос</span>
          <textarea className="a-input a-textarea" rows={3} value={form.question} onChange={set('question')} />
        </label>
        <label className="a-field">
          <span>Заметки</span>
          <textarea className="a-input a-textarea" rows={3} value={form.notes} onChange={set('notes')} />
        </label>
      </div>
      <footer className="a-drawer__foot">
        <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => open(null)}>
          Отмена
        </button>
        <button type="button" className="a-btn a-btn--primary a-btn--sm" disabled={!form.name.trim() || busy} onClick={submit}>
          {busy ? 'Сохраняю…' : 'Добавить'}
        </button>
      </footer>
    </div>
  );
}
