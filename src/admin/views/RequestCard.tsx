import type { CSSProperties, PointerEvent } from 'react';
import { CONTACT_PREF_LABELS, STATUS_LABELS, formatPhone, type BookingRequest } from '../../../shared/booking.ts';
import { ago } from '../format.ts';
import { AdminIcon } from '../icons.tsx';
import { useAdmin } from '../store.tsx';

/** One request as a card; shared by the board and the schedule's waiting list. */
export function RequestCard({
  request: r,
  onPointerDown,
  onOpen,
  compact = false,
}: {
  request: BookingRequest;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onOpen: () => void;
  compact?: boolean;
}) {
  const { fmt, now } = useAdmin();
  const when = r.scheduledAt ?? r.preferredAt;
  const overdue = r.status === 'scheduled' && r.scheduledAt !== null && r.scheduledAt + r.durationMin * 60_000 < now;

  return (
    <article
      className="a-card"
      data-status={r.status}
      data-unseen={!r.seen}
      data-overdue={overdue}
      onPointerDown={onPointerDown}
      style={{ viewTransitionName: `req-${r.id}` } as CSSProperties}
    >
      <button type="button" className="a-card__open" data-drag-through onClick={onOpen} aria-label={`Открыть заявку: ${r.name}`} />
      <header className="a-card__head">
        <h3 className="a-card__name">{r.name || 'Без имени'}</h3>
        <span className="a-card__ago">{ago(r.createdAt, now)}</span>
      </header>
      {r.serviceTitle && <p className="a-card__service">{r.serviceTitle}</p>}
      {when && (
        <p className="a-card__when" data-kind={r.scheduledAt ? 'scheduled' : 'preferred'}>
          <AdminIcon name="clock" size={14} />
          {r.scheduledAt ? fmt.when(r.scheduledAt, now) : `просит: ${fmt.when(r.preferredAt!, now)}`}
        </p>
      )}
      {!compact && r.question && <p className="a-card__question">{r.question}</p>}
      <footer className="a-card__foot">
        <a className="a-card__phone" href={`tel:${r.phone}`}>
          <AdminIcon name="phone" size={14} />
          {formatPhone(r.phone)}
        </a>
        <span className="a-card__pref">{CONTACT_PREF_LABELS[r.contactPref]}</span>
        {overdue && <span className="a-card__flag">прошла — отметить?</span>}
        {compact && <span className="a-card__status">{STATUS_LABELS[r.status]}</span>}
      </footer>
    </article>
  );
}
