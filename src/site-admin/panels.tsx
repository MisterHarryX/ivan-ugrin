import { useMemo, useState, type ReactNode } from 'react';
import { SECTION_LABELS, pathLabel, sectionLabel } from './dom.ts';

export function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div data-site-admin role="dialog" aria-label={title} className="sa-panel" onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <div className="sa-panel__head">
        <h2>{title}</h2>
        <button type="button" className="sa-icon" onClick={onClose} aria-label="Закрыть">
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <div className="sa-panel__body">{children}</div>
    </div>
  );
}

/** Every editable text in one searchable list, for what is hard to click (the headline, prices). */
export function TextsPanel({
  values,
  original,
  changed,
  onApply,
  onClose,
}: {
  values: Record<string, string>;
  original: Record<string, string>;
  changed: Set<string>;
  onApply: (path: string, value: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(values).filter(([path, text]) => {
      if (section === 'changed' && !changed.has(path)) return false;
      if (section !== 'all' && section !== 'changed' && path.split('.')[0] !== section) return false;
      return !q || text.toLowerCase().includes(q) || pathLabel(path).includes(q);
    });
  }, [values, query, section, changed]);

  return (
    <Panel title="Все тексты" onClose={onClose}>
      <div className="sa-panel__tools">
        <input type="search" className="sa-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти текст…" aria-label="Поиск по текстам" />
        <div className="sa-tabs">
          {[['all', 'Все'], ['changed', `Изменённые · ${changed.size}`], ...Object.entries(SECTION_LABELS)].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="sa-list">
        {rows.map(([path, text]) => {
          const price = path.endsWith('price.amount');
          return (
            <li key={path}>
              {open === path ? (
                <div className="sa-list__edit">
                  <p>
                    {sectionLabel(path)} · {pathLabel(path)}
                  </p>
                  <textarea
                    autoFocus
                    className="sa-input"
                    value={draft}
                    inputMode={price ? 'numeric' : undefined}
                    onChange={(e) => setDraft(price ? e.target.value.replace(/\D/g, '') : e.target.value)}
                    rows={Math.min(6, Math.max(price ? 1 : 2, Math.ceil(draft.length / 46)))}
                  />
                  {path === 'hero.headline' && <p className="sa-note">Новая строка — перенос. Слова в *звёздочках* — золотой акцент.</p>}
                  <div className="sa-pop__actions">
                    {draft !== original[path] && (
                      <button type="button" className="sa-btn sa-btn--quiet" onClick={() => setDraft(original[path])}>
                        Исходный
                      </button>
                    )}
                    <span className="sa-spacer" />
                    <button type="button" className="sa-btn sa-btn--quiet" onClick={() => setOpen(null)}>
                      Отмена
                    </button>
                    <button
                      type="button"
                      className="sa-btn sa-btn--gold"
                      onClick={() => {
                        if (draft.trim()) onApply(path, draft);
                        setOpen(null);
                      }}
                    >
                      Применить
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="sa-list__row"
                  onClick={() => {
                    setOpen(path);
                    setDraft(text);
                  }}
                >
                  <span>
                    <span className="sa-list__text">{price ? `${text} ₽` : text}</span>
                    <small>
                      {sectionLabel(path)} · {pathLabel(path)}
                    </small>
                  </span>
                  {changed.has(path) && <span className="sa-dot" aria-label="изменено" />}
                </button>
              )}
            </li>
          );
        })}
        {rows.length === 0 && <li className="sa-empty">Ничего не найдено</li>}
      </ul>
    </Panel>
  );
}

export type ContactValues = { telegram: string; max: string };

const phoneDigits = (v: string) => v.replace(/\D/g, '');
const looksLikePhone = (v: string) => /^[+\d][\d\s()-]*$/.test(v.trim()) && phoneDigits(v).length >= 10 && phoneDigits(v).length <= 15;

/** Where the messenger buttons lead; validated so a typo cannot break the links. */
export function ContactsPanel({ value, onApply, onClose }: { value: ContactValues; onApply: (next: ContactValues) => void; onClose: () => void }) {
  const [telegram, setTelegram] = useState(value.telegram && !looksLikePhone(value.telegram) ? `@${value.telegram.replace(/^@/, '')}` : value.telegram);
  const [max, setMax] = useState(value.max);
  const tgRaw = telegram.trim();
  const tgPhone = looksLikePhone(tgRaw);
  const tgName = tgPhone ? tgRaw : tgRaw.replace(/^@|^https?:\/\/t\.me\//, '');
  const tgOk = !tgRaw || tgPhone || /^[A-Za-z0-9_]{4,32}$/.test(tgName);
  const maxRaw = max.trim();
  const maxLink = /^https:\/\/(www\.)?max\.ru\/\S+$/.test(maxRaw);
  const maxOk = !maxRaw || maxLink || looksLikePhone(maxRaw);

  return (
    <Panel title="Контакты" onClose={onClose}>
      <form
        className="sa-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!tgOk || !maxOk) return;
          onApply({ telegram: tgName, max: maxRaw });
          onClose();
        }}
      >
        <label className="sa-field">
          <span>Telegram</span>
          <input className="sa-input" data-bad={!tgOk} value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username или +7 900 000-00-00" autoComplete="off" spellCheck={false} />
          <small data-bad={!tgOk}>{tgOk ? (tgName ? `Ссылка: t.me/${tgPhone ? '+' + phoneDigits(tgName).replace(/^8(?=\d{10}$)/, '7') : tgName}` : 'Пусто — как в коде сайта') : 'Имя пользователя (4–32 латинские буквы, цифры, _) или номер телефона'}</small>
        </label>
        <label className="sa-field">
          <span>Max</span>
          <input className="sa-input" data-bad={!maxOk} value={max} onChange={(e) => setMax(e.target.value)} placeholder="+7 900 000-00-00 или https://max.ru/…" inputMode="text" autoComplete="off" spellCheck={false} />
          <small data-bad={!maxOk}>{maxOk ? (maxLink ? 'Кнопка откроет чат в Max' : maxRaw ? 'По номеру: кнопка позвонит и скопирует номер, чтобы найти вас в Max' : 'Пусто — как в коде сайта') : 'Номер телефона или ссылка вида https://max.ru/…'}</small>
        </label>
        <p className="sa-note">Меняется в записи, в подвале и во всех кнопках «Написать». Ссылки обновятся после публикации.</p>
        <div className="sa-pop__actions">
          <span className="sa-spacer" />
          <button type="button" className="sa-btn sa-btn--quiet" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="sa-btn sa-btn--gold" disabled={!tgOk || !maxOk}>
            Применить
          </button>
        </div>
      </form>
    </Panel>
  );
}

// --- Photos -----------------------------------------------------------------------------

export type MediaState = 'original' | 'replaced' | 'hidden' | 'empty' | 'inserted';

export interface MediaItem {
  /** Media key ("/photos/night-flame", "slot:portrait") or the insert id for added images. */
  key: string;
  insert?: boolean;
  thumb: string;
  label: string;
  state: MediaState;
}

const STATE_TEXT: Record<MediaState, string> = {
  original: 'исходное',
  replaced: 'заменено',
  hidden: 'скрыто',
  empty: 'пусто — можно поставить фото',
  inserted: 'добавлено вами',
};

/** Actions on one image, anchored next to it (replace, hide, restore, remove). */
export function MediaPopover({
  item,
  rect,
  busy,
  onReplace,
  onHide,
  onRestore,
  onRemove,
  onClose,
}: {
  item: MediaItem;
  rect: DOMRect;
  busy: boolean;
  onReplace: () => void;
  onHide: () => void;
  onRestore: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const width = 300;
  const top = Math.min(Math.max(12, rect.top + 12), window.innerHeight - 260);
  const left = Math.min(Math.max(12, rect.left + 12), window.innerWidth - width - 12);
  return (
    <div data-site-admin role="dialog" aria-label={`Фото: ${item.label}`} className="sa-pop sa-media" style={{ top, left, width }} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="sa-pop__head">
        <p>
          <span>Фото</span> · {item.label}
        </p>
        <button type="button" className="sa-icon" onClick={onClose} aria-label="Закрыть">
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <div className="sa-pop__body">
        {item.thumb ? <img className="sa-media__thumb" src={item.thumb} alt="" /> : <div className="sa-media__thumb sa-media__thumb--empty">Пустая рамка</div>}
        <p className="sa-note">Сейчас: {STATE_TEXT[item.state]}</p>
        <div className="sa-media__actions">
          <button type="button" className="sa-btn sa-btn--gold" onClick={onReplace} disabled={busy} autoFocus>
            {busy ? 'Загружаю…' : item.state === 'empty' ? 'Поставить фото' : 'Заменить фото'}
          </button>
          {item.insert ? (
            <button type="button" className="sa-btn sa-btn--quiet" onClick={onRemove} disabled={busy}>
              Убрать с сайта
            </button>
          ) : (
            <>
              {item.state !== 'hidden' && item.state !== 'empty' && (
                <button type="button" className="sa-btn sa-btn--quiet" onClick={onHide} disabled={busy}>
                  Скрыть
                </button>
              )}
              {(item.state === 'replaced' || item.state === 'hidden') && (
                <button type="button" className="sa-btn sa-btn--quiet" onClick={onRestore} disabled={busy}>
                  Вернуть исходное
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Every image on the page, to replace, hide or bring back, including ones hidden earlier. */
export function PhotosPanel({ items, busyKey, onReplace, onHide, onRestore, onRemove, onShow, onClose }: {
  items: MediaItem[];
  busyKey: string | null;
  onReplace: (item: MediaItem) => void;
  onHide: (item: MediaItem) => void;
  onRestore: (item: MediaItem) => void;
  onRemove: (item: MediaItem) => void;
  onShow: (item: MediaItem) => void;
  onClose: () => void;
}) {
  return (
    <Panel title="Фото на сайте" onClose={onClose}>
      <p className="sa-panel__intro">Нажмите на фото прямо на странице в режиме «Редактировать» или выберите здесь. Новое фото можно вставить кнопкой «Вставить фото» после любого абзаца.</p>
      <ul className="sa-photos">
        {items.map((item) => (
          <li key={item.key} data-state={item.state}>
            <button type="button" className="sa-photos__thumb" onClick={() => onShow(item)} aria-label={`Показать на странице: ${item.label}`}>
              {item.thumb ? <img src={item.thumb} alt="" loading="lazy" /> : <span>пусто</span>}
            </button>
            <span className="sa-photos__text">
              <span>{item.label}</span>
              <small>{STATE_TEXT[item.state]}</small>
            </span>
            <span className="sa-photos__actions">
              <button type="button" className="sa-btn sa-btn--quiet" onClick={() => onReplace(item)} disabled={busyKey === item.key}>
                {busyKey === item.key ? '…' : item.state === 'empty' ? 'Поставить' : 'Заменить'}
              </button>
              {item.insert ? (
                <button type="button" className="sa-btn sa-btn--quiet" onClick={() => onRemove(item)}>
                  Убрать
                </button>
              ) : item.state === 'hidden' || item.state === 'replaced' ? (
                <button type="button" className="sa-btn sa-btn--quiet" onClick={() => onRestore(item)}>
                  Вернуть
                </button>
              ) : item.state !== 'empty' ? (
                <button type="button" className="sa-btn sa-btn--quiet" onClick={() => onHide(item)}>
                  Скрыть
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
