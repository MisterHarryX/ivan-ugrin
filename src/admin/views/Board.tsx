import { useMemo, useState } from 'react';
import { STATUS_LABELS, type BookingRequest, type RequestStatus } from '../../../shared/booking.ts';
import { useCardDrag, type DropInfo } from '../drag.ts';
import { plural } from '../format.ts';
import { AdminIcon } from '../icons.tsx';
import { useAdmin } from '../store.tsx';
import { RequestCard } from './RequestCard.tsx';

const COLUMNS: { status: RequestStatus; hint: string }[] = [
  { status: 'new', hint: 'Только пришли — позвоните или напишите' },
  { status: 'in_progress', hint: 'Договариваетесь о времени и формате' },
  { status: 'scheduled', hint: 'Время подтверждено' },
];

function sortFor(status: RequestStatus) {
  if (status === 'scheduled') return (a: BookingRequest, b: BookingRequest) => (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity);
  if (status === 'new') return (a: BookingRequest, b: BookingRequest) => b.createdAt - a.createdAt;
  return (a: BookingRequest, b: BookingRequest) => b.updatedAt - a.updatedAt;
}

/** Kanban of open requests: drag between columns, click to open the editor. */
export function Board() {
  const { requests, loaded, patch, open, services } = useAdmin();
  const [query, setQuery] = useState('');
  const [service, setService] = useState<string>('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return requests.filter((r) => {
      if (service && r.serviceId !== service) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.question.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        (digits.length >= 3 && r.phone.replace(/\D/g, '').includes(digits))
      );
    });
  }, [requests, query, service]);

  const onDrop = (id: string, { zone }: DropInfo) => {
    const status = zone?.dataset.drop as RequestStatus | undefined;
    const r = requests.find((x) => x.id === id);
    if (!r || !status || status === r.status) return;
    if (status === 'scheduled' && !r.scheduledAt) {
      // Confirming the time the client asked for is the usual case; otherwise pick one in the editor.
      if (r.preferredAt) void patch(id, { status, scheduledAt: r.preferredAt, seen: true }, { animate: true });
      else open(id);
      return;
    }
    void patch(id, { status, seen: true }, { animate: true });
  };
  const { onPointerDown, guard } = useCardDrag(onDrop);

  const counts = COLUMNS.map((c) => filtered.filter((r) => r.status === c.status).length);
  const openTotal = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="a-board-view">
      <div className="a-toolbar">
        <label className="a-search">
          <AdminIcon name="search" size={16} />
          <input type="search" placeholder="Имя, телефон или слово из вопроса" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="a-segment" role="group" aria-label="Формат">
          <button type="button" aria-pressed={service === ''} onClick={() => setService('')}>
            Все
          </button>
          {services.map((s) => (
            <button key={s.id} type="button" aria-pressed={service === s.id} onClick={() => setService(s.id)}>
              {s.title}
            </button>
          ))}
        </div>
        <p className="a-toolbar__note">
          {openTotal} {plural(openTotal, 'открытая заявка', 'открытые заявки', 'открытых заявок')}
        </p>
      </div>

      <div className="a-board">
        {COLUMNS.map((column, i) => {
          const items = filtered.filter((r) => r.status === column.status).sort(sortFor(column.status));
          return (
            <section key={column.status} className="a-column" data-drop={column.status} data-status={column.status} aria-label={STATUS_LABELS[column.status]}>
              <header className="a-column__head">
                <span className="a-column__dot" aria-hidden="true" />
                <h2>{STATUS_LABELS[column.status]}</h2>
                <span className="a-column__count">{counts[i]}</span>
              </header>
              <p className="a-column__hint">{column.hint}</p>
              <div className="a-column__list">
                {items.map((r) => (
                  <RequestCard key={r.id} request={r} onPointerDown={onPointerDown(r.id)} onOpen={guard(() => open(r.id))} />
                ))}
                {loaded && items.length === 0 && <p className="a-column__empty">{column.status === 'new' ? 'Новых заявок нет — тишина.' : 'Пусто'}</p>}
                {!loaded && <div className="a-skeleton" />}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
