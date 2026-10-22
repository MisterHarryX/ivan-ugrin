import { useMemo, useState, type CSSProperties } from 'react';
import { STATUS_LABELS, formatPhone, type BookingRequest } from '../../../shared/booking.ts';
import { dayKey } from '../../../shared/time.ts';
import { money, plural } from '../format.ts';
import { AdminIcon } from '../icons.tsx';
import { useAdmin } from '../store.tsx';

type Filter = 'done' | 'cancelled' | 'all';

const closedAt = (r: BookingRequest) => r.completedAt ?? r.scheduledAt ?? r.updatedAt;

/** Spreadsheet-friendly export: semicolons and a BOM so Excel opens Cyrillic correctly. */
function downloadCsv(rows: BookingRequest[], fmt: ReturnType<typeof useAdmin>['fmt']) {
  const cell = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const head = ['Дата', 'Встреча', 'Статус', 'Имя', 'Телефон', 'Формат', 'Цена', 'Оплачено', 'Вопрос', 'Заметки'];
  const lines = rows.map((r) =>
    [
      fmt.full(closedAt(r)),
      r.scheduledAt ? fmt.full(r.scheduledAt) : '',
      STATUS_LABELS[r.status],
      r.name,
      formatPhone(r.phone),
      r.serviceTitle ?? '',
      r.price,
      r.paid ? 'да' : 'нет',
      r.question,
      r.notes,
    ]
      .map(cell)
      .join(';'),
  );
  const blob = new Blob([`﻿${[head.map(cell).join(';'), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `архив-заявок-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

/** Finished and cancelled requests, with a month filter, totals and CSV export. */
export function Archive() {
  const { requests, open, fmt, status } = useAdmin();
  const [filter, setFilter] = useState<Filter>('done');
  const [month, setMonth] = useState('');
  const [query, setQuery] = useState('');

  const closed = useMemo(() => requests.filter((r) => r.status === 'done' || r.status === 'cancelled').sort((a, b) => closedAt(b) - closedAt(a)), [requests]);
  const months = useMemo(() => [...new Set(closed.map((r) => dayKey(closedAt(r), status.tz).slice(0, 7)))], [closed, status.tz]);
  const monthName = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 15));
  };

  const rows = closed.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (month && !dayKey(closedAt(r), status.tz).startsWith(month)) return false;
    const q = query.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.phone.includes(q.replace(/\D/g, '') || '§') || r.notes.toLowerCase().includes(q);
  });
  const done = rows.filter((r) => r.status === 'done');
  const revenue = done.reduce((sum, r) => sum + (r.paid ? (r.price ?? 0) : 0), 0);
  const unpaid = done.filter((r) => !r.paid && r.price).reduce((sum, r) => sum + (r.price ?? 0), 0);

  return (
    <div className="a-archive">
      <div className="a-toolbar">
        <div className="a-segment" role="group" aria-label="Что показать">
          {(['done', 'cancelled', 'all'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'done' ? 'Завершённые' : f === 'cancelled' ? 'Отменённые' : 'Все'}
            </button>
          ))}
        </div>
        <select className="a-input a-input--sm" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Месяц">
          <option value="">За всё время</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
        <label className="a-search">
          <AdminIcon name="search" size={16} />
          <input type="search" placeholder="Имя, телефон, заметка" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => downloadCsv(rows, fmt)} disabled={rows.length === 0}>
          <AdminIcon name="download" size={15} /> CSV
        </button>
      </div>

      <div className="a-kpis">
        <div className="a-kpi">
          <span>Встреч</span>
          <b>{done.length}</b>
        </div>
        <div className="a-kpi">
          <span>Получено</span>
          <b>{money(revenue)}</b>
        </div>
        <div className="a-kpi" data-tone={unpaid ? 'warn' : undefined}>
          <span>Ждёт оплаты</span>
          <b>{money(unpaid)}</b>
        </div>
        <div className="a-kpi">
          <span>Средний чек</span>
          <b>{done.length ? money(Math.round(done.reduce((s, r) => s + (r.price ?? 0), 0) / done.length)) : '—'}</b>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="a-empty">Здесь появятся встречи, которые вы отметите как прошедшие или отменённые.</p>
      ) : (
        <div className="a-table" role="table" aria-label="Архив заявок">
          <div className="a-table__row a-table__row--head" role="row">
            <span role="columnheader">Дата</span>
            <span role="columnheader">Клиент</span>
            <span role="columnheader">Формат</span>
            <span role="columnheader">Сумма</span>
            <span role="columnheader">Статус</span>
          </div>
          {rows.map((r, i) => (
            <button key={r.id} type="button" className="a-table__row" role="row" onClick={() => open(r.id)} style={{ '--i': Math.min(i, 14) } as CSSProperties}>
              <span role="cell">
                {fmt.day(closedAt(r))}
                <small>{fmt.time(closedAt(r))}</small>
              </span>
              <span role="cell">
                {r.name}
                <small>{formatPhone(r.phone)}</small>
              </span>
              <span role="cell">{r.serviceTitle ?? '—'}</span>
              <span role="cell">
                {money(r.price)}
                {r.status === 'done' && r.price ? <small data-paid={r.paid}>{r.paid ? 'оплачено' : 'не оплачено'}</small> : null}
              </span>
              <span role="cell" data-status={r.status}>
                {STATUS_LABELS[r.status]}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="a-toolbar__note">
        {rows.length} {plural(rows.length, 'запись', 'записи', 'записей')}
      </p>
    </div>
  );
}
