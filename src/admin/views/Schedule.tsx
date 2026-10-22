import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { formatPhone, type BookingRequest } from '../../../shared/booking.ts';
import { DEFAULT_WORK_HOURS } from '../../../shared/schedule.ts';
import { addDays, dayKey, minutesOf, timeOfMinutes, weekdayOf, zonedTime } from '../../../shared/time.ts';
import { useCardDrag, type DropInfo } from '../drag.ts';
import { plural } from '../format.ts';
import { AdminIcon } from '../icons.tsx';
import { useAdmin } from '../store.tsx';

const HOUR_PX = 72;
const SNAP = 15;
const PX_PER_MIN = HOUR_PX / 60;

/** Monday of the week containing the day key. */
const mondayOf = (key: string) => addDays(key, 1 - weekdayOf(key));

/** Where a session would go: a day, a start minute, and for whom. */
interface Target {
  day: string;
  minutes: number;
  id: string | null;
}

/**
 * Week planner. Placing is exact: pick a waiting request (click it) and click the hour, or
 * drag it; the block under the pointer shows the real start, end and length before you
 * let go. Clicking an empty slot offers the waiting requests or a new one at that time.
 */
export function Schedule() {
  const { requests, patch, open, openNew, fmt, status, overrides, now } = useAdmin();
  const tz = status.tz;
  const hours = overrides.hours ?? DEFAULT_WORK_HOURS;
  const today = dayKey(now, tz);
  const [week, setWeek] = useState(() => mondayOf(today));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const [placing, setPlacing] = useState<string | null>(null);
  const [hover, setHover] = useState<Target | null>(null);
  const [menu, setMenu] = useState<{ day: string; minutes: number; x: number; y: number } | null>(null);
  const dragging = useRef<{ id: string; grab: number; session: boolean } | null>(null);

  const byId = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const sessions = useMemo(
    () => requests.filter((r) => r.scheduledAt && r.status !== 'cancelled' && days.includes(dayKey(r.scheduledAt, tz))),
    [requests, days, tz],
  );
  const waiting = useMemo(
    () =>
      requests
        .filter((r) => !r.scheduledAt && (r.status === 'new' || r.status === 'in_progress'))
        .sort((a, b) => (a.preferredAt ?? Infinity) - (b.preferredAt ?? Infinity) || b.createdAt - a.createdAt),
    [requests],
  );

  // Visible hours: working hours with a margin, widened to fit any session outside them.
  const [fromHour, toHour] = useMemo(() => {
    let from = Math.floor(minutesOf(hours.start) / 60) - 1;
    let to = Math.ceil(minutesOf(hours.end) / 60) + 1;
    for (const s of sessions) {
      const m = minutesOf(fmt.time(s.scheduledAt!));
      from = Math.min(from, Math.floor(m / 60));
      to = Math.max(to, Math.ceil((m + s.durationMin) / 60));
    }
    return [Math.max(0, from), Math.min(24, to)];
  }, [hours, sessions, fmt]);

  const startOfGrid = fromHour * 60;
  const endOfGrid = toHour * 60;

  /** Minute under a viewport Y inside a day column. `floor` picks the cell under the pointer. */
  const minuteAt = (column: Element, clientY: number, mode: 'floor' | 'round' = 'floor') => {
    const offset = (clientY - column.getBoundingClientRect().top) / PX_PER_MIN;
    const snapped = (mode === 'floor' ? Math.floor(offset / SNAP) : Math.round(offset / SNAP)) * SNAP;
    return Math.max(startOfGrid, Math.min(endOfGrid - SNAP, startOfGrid + snapped));
  };

  const place = (id: string, day: string, minutes: number) => {
    const r = byId.get(id);
    setPlacing(null);
    setHover(null);
    setMenu(null);
    if (!r) return;
    const at = zonedTime(day, timeOfMinutes(minutes), tz);
    if (at === r.scheduledAt) return;
    void patch(id, { scheduledAt: at, status: r.status === 'done' ? 'done' : 'scheduled', seen: true }, { animate: true });
  };

  // --- Dragging: the start follows the pointer (minus where a session was grabbed) ----------

  const onDrop = (id: string, info: DropInfo) => {
    const drag = dragging.current;
    dragging.current = null;
    setHover(null);
    const column = info.zone?.closest('[data-day]') as HTMLElement | null;
    if (!column) return;
    const y = drag?.session ? info.y - drag.grab : info.y;
    place(id, column.dataset.day!, minuteAt(column, y, drag?.session ? 'round' : 'floor'));
  };
  const { onPointerDown, guard } = useCardDrag(onDrop);

  const startDrag = (r: BookingRequest, session: boolean) => (event: PointerEvent<HTMLElement>) => {
    dragging.current = { id: r.id, grab: session ? event.clientY - event.currentTarget.getBoundingClientRect().top : 0, session };
    onPointerDown(r.id)(event);
  };

  // On a phone the week scrolls sideways: start at today, not on Monday.
  const calRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cal = calRef.current;
    const todayCol = cal?.querySelector<HTMLElement>('.a-cal__col[data-today="true"]');
    if (cal && todayCol && cal.scrollWidth > cal.clientWidth) cal.scrollLeft = todayCol.offsetLeft - 56;
  }, [week]);

  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const onOver = (event: Event) => {
      const column = (event.target as HTMLElement).closest('[data-day]') as HTMLElement | null;
      const { id, y } = (event as CustomEvent<{ id: string; y: number }>).detail;
      const drag = dragging.current;
      if (!column) return;
      const top = drag?.session ? y - drag.grab : y;
      setHover({ day: column.dataset.day!, minutes: minuteAt(column, top, drag?.session ? 'round' : 'floor'), id });
    };
    const onLeave = () => setHover(null);
    grid.addEventListener('a-dragover', onOver);
    grid.addEventListener('a-dragleave', onLeave);
    return () => {
      grid.removeEventListener('a-dragover', onOver);
      grid.removeEventListener('a-dragleave', onLeave);
    };
  });

  // --- Click placing: hover shows the block, click puts it there ----------------------------

  const onColumnMove = (day: string) => (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current || event.pointerType === 'touch') return;
    if ((event.target as Element).closest('.a-session')) return setHover(null);
    setHover({ day, minutes: minuteAt(event.currentTarget, event.clientY), id: placing });
  };

  const onColumnClick = (day: string) => (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('.a-session')) return;
    const minutes = minuteAt(event.currentTarget, event.clientY);
    if (placing) return place(placing, day, minutes);
    setMenu({ day, minutes, x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPlacing(null);
      setMenu(null);
      setHover(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Overlaps with other sessions, and whether it leaves working hours. */
  const checkTarget = (t: Target) => {
    const r = t.id ? byId.get(t.id) : null;
    const duration = r?.durationMin ?? hours.slotMinutes;
    const start = zonedTime(t.day, timeOfMinutes(t.minutes), tz);
    const end = start + duration * 60_000;
    const clash = sessions.find(
      (s) => s.id !== t.id && s.status !== 'done' && s.scheduledAt! < end && s.scheduledAt! + s.durationMin * 60_000 > start,
    );
    const offHours = !hours.days.includes(weekdayOf(t.day)) || t.minutes < minutesOf(hours.start) || t.minutes + duration > minutesOf(hours.end);
    return { r, duration, clash, offHours, past: end < now };
  };

  const weekLabel = `${fmt.day(zonedTime(days[0], '12:00', tz))} – ${fmt.day(zonedTime(days[6], '12:00', tz))}`;
  const todaySessions = requests
    .filter((r) => r.scheduledAt && r.status === 'scheduled' && dayKey(r.scheduledAt, tz) === today)
    .sort((a, b) => a.scheduledAt! - b.scheduledAt!);
  const next = todaySessions.find((r) => r.scheduledAt! + r.durationMin * 60_000 > now);
  const nowMinutes = minutesOf(fmt.time(now));
  const placingRequest = placing ? byId.get(placing) : null;

  return (
    <div className="a-schedule" data-placing={Boolean(placing)}>
      <div className="a-toolbar">
        <div className="a-weeknav">
          <button type="button" className="a-icon-btn" onClick={() => setWeek(addDays(week, -7))} aria-label="Предыдущая неделя">
            <AdminIcon name="left" />
          </button>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setWeek(mondayOf(today))} disabled={week === mondayOf(today)}>
            Эта неделя
          </button>
          <button type="button" className="a-icon-btn" onClick={() => setWeek(addDays(week, 7))} aria-label="Следующая неделя">
            <AdminIcon name="right" />
          </button>
          <h2 className="a-weeknav__label" key={week}>
            {weekLabel}
          </h2>
        </div>
        <p className="a-toolbar__note">
          {todaySessions.length
            ? `Сегодня ${todaySessions.length} ${plural(todaySessions.length, 'встреча', 'встречи', 'встреч')}${next ? ` · ближайшая в ${fmt.time(next.scheduledAt!)} — ${next.name}` : ' · все прошли'}`
            : 'Сегодня встреч нет'}
        </p>
      </div>

      {placingRequest && (
        <div className="a-placing" role="status">
          <span className="a-placing__dot" aria-hidden="true" />
          <span>
            Куда поставить <strong>{placingRequest.name}</strong> · {placingRequest.durationMin} мин? Нажмите на час в календаре.
            {placingRequest.preferredAt && <> Клиент просил {fmt.when(placingRequest.preferredAt, now)}.</>}
          </span>
          {placingRequest.preferredAt && (
            <button type="button" className="a-btn a-btn--primary a-btn--sm" onClick={() => place(placingRequest.id, dayKey(placingRequest.preferredAt!, tz), minutesOf(fmt.time(placingRequest.preferredAt!)))}>
              На это время
            </button>
          )}
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setPlacing(null)}>
            Отмена
          </button>
        </div>
      )}

      <div className="a-schedule__layout">
        <aside className="a-waiting">
          <h3 className="a-block__title">
            Ждут времени <span>{waiting.length}</span>
          </h3>
          <p className="a-waiting__hint">Нажмите на заявку, потом на час в календаре. Или перетащите.</p>
          <div className="a-waiting__list">
            {waiting.map((r) => (
              <article
                key={r.id}
                className="a-wait"
                data-status={r.status}
                data-active={placing === r.id}
                data-unseen={!r.seen}
                onPointerDown={startDrag(r, false)}
                style={{ viewTransitionName: `req-${r.id}` } as CSSProperties}
              >
                <button
                  type="button"
                  className="a-card__open"
                  data-drag-through
                  onClick={guard(() => setPlacing((p) => (p === r.id ? null : r.id)))}
                  aria-pressed={placing === r.id}
                  aria-label={`Выбрать время для: ${r.name}`}
                />
                <span className="a-wait__name">{r.name}</span>
                <span className="a-wait__meta">
                  {r.serviceTitle ?? 'Формат не выбран'} · {r.durationMin} мин
                </span>
                {r.preferredAt && (
                  <span className="a-wait__prefer">
                    <AdminIcon name="clock" size={13} /> просит {fmt.when(r.preferredAt, now)}
                  </span>
                )}
                <span className="a-wait__phone">{formatPhone(r.phone)}</span>
                <button type="button" className="a-wait__more" onClick={() => open(r.id)} aria-label={`Открыть заявку: ${r.name}`}>
                  <AdminIcon name="external" size={14} />
                </button>
              </article>
            ))}
            {waiting.length === 0 && <p className="a-column__empty">Все заявки уже со временем.</p>}
          </div>
        </aside>

        <div ref={calRef} className="a-cal" style={{ '--hour': `${HOUR_PX}px`, '--hours': toHour - fromHour } as CSSProperties} onPointerLeave={() => !dragging.current && setHover(null)}>
          <div className="a-cal__head">
            <span />
            {days.map((d) => {
              const at = zonedTime(d, '12:00', tz);
              const off = !hours.days.includes(weekdayOf(d));
              return (
                <div key={d} className="a-cal__day" data-today={d === today} data-off={off}>
                  <small>{fmt.weekday(at)}</small>
                  <b>{fmt.day(at).split(' ')[0]}</b>
                </div>
              );
            })}
          </div>
          <div className="a-cal__body" ref={gridRef}>
            <div className="a-cal__gutter">
              {Array.from({ length: toHour - fromHour }, (_, i) => (
                <span key={i}>{String(fromHour + i).padStart(2, '0')}:00</span>
              ))}
            </div>
            {days.map((d) => {
              const off = !hours.days.includes(weekdayOf(d));
              const workTop = (minutesOf(hours.start) - startOfGrid) * PX_PER_MIN;
              const workHeight = (minutesOf(hours.end) - minutesOf(hours.start)) * PX_PER_MIN;
              const preview = hover?.day === d ? checkTarget(hover) : null;
              return (
                <div
                  key={d}
                  className="a-cal__col"
                  data-drop={`day:${d}`}
                  data-day={d}
                  data-ghost="hide"
                  data-today={d === today}
                  data-off={off}
                  onPointerMove={onColumnMove(d)}
                  onClick={onColumnClick(d)}
                >
                  {!off && <span className="a-cal__work" style={{ top: workTop, height: workHeight }} aria-hidden="true" />}
                  {d === today && nowMinutes >= startOfGrid && nowMinutes <= endOfGrid && (
                    <span className="a-cal__now" style={{ top: (nowMinutes - startOfGrid) * PX_PER_MIN }} aria-hidden="true" />
                  )}
                  {sessions
                    .filter((s) => dayKey(s.scheduledAt!, tz) === d)
                    .map((s) => (
                      <Session
                        key={s.id}
                        request={s}
                        top={(minutesOf(fmt.time(s.scheduledAt!)) - startOfGrid) * PX_PER_MIN}
                        moving={hover?.id === s.id}
                        onPointerDown={startDrag(s, true)}
                        onOpen={guard(() => open(s.id))}
                      />
                    ))}
                  {preview && hover && (
                    <span
                      className="a-cal__preview"
                      data-kind={hover.id ? 'place' : 'slot'}
                      data-clash={Boolean(preview.clash)}
                      data-off={preview.offHours || preview.past}
                      style={{ top: (hover.minutes - startOfGrid) * PX_PER_MIN, height: Math.max(preview.duration * PX_PER_MIN - 2, 18) }}
                      aria-hidden="true"
                    >
                      <b>
                        {timeOfMinutes(hover.minutes)}–{timeOfMinutes(hover.minutes + preview.duration)}
                      </b>
                      {preview.r ? <span>{preview.r.name}</span> : <span>+ сюда</span>}
                      {preview.clash && <em>пересекается с {preview.clash.name}</em>}
                      {!preview.clash && preview.past && <em>это время уже прошло</em>}
                      {!preview.clash && !preview.past && preview.offHours && <em>вне рабочих часов</em>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {menu && (
        <SlotMenu
          menu={menu}
          waiting={waiting}
          label={`${fmt.weekday(zonedTime(menu.day, '12:00', tz))}, ${fmt.day(zonedTime(menu.day, '12:00', tz))} · ${timeOfMinutes(menu.minutes)}`}
          onPick={(id) => place(id, menu.day, menu.minutes)}
          onNew={() => {
            openNew({ date: menu.day, time: timeOfMinutes(menu.minutes) });
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

function Session({
  request: r,
  top,
  moving,
  onPointerDown,
  onOpen,
}: {
  request: BookingRequest;
  top: number;
  moving: boolean;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onOpen: () => void;
}) {
  const { fmt } = useAdmin();
  const height = Math.max(r.durationMin * PX_PER_MIN - 3, 26);
  return (
    <article
      className="a-session"
      data-status={r.status}
      data-short={height < 56}
      data-moving={moving}
      style={{ top, height, viewTransitionName: `req-${r.id}` } as CSSProperties}
      onPointerDown={onPointerDown}
    >
      <button type="button" className="a-card__open" data-drag-through onClick={onOpen} aria-label={`Открыть: ${r.name}, ${fmt.time(r.scheduledAt!)}`} />
      <span className="a-session__time">
        {fmt.time(r.scheduledAt!)}–{fmt.time(r.scheduledAt! + r.durationMin * 60_000)}
      </span>
      <span className="a-session__name">{r.name}</span>
      {r.serviceTitle && <span className="a-session__service">{r.serviceTitle}</span>}
    </article>
  );
}

/** Menu at a clicked empty slot: put a waiting request here, or add a new one. */
function SlotMenu({
  menu,
  waiting,
  label,
  onPick,
  onNew,
  onClose,
}: {
  menu: { x: number; y: number };
  waiting: BookingRequest[];
  label: string;
  onPick: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x + 8, top: menu.y + 8 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({ left: Math.min(menu.x + 8, window.innerWidth - width - 12), top: Math.min(menu.y + 8, window.innerHeight - height - 12) });
    el.querySelector('button')?.focus();
    const onDown = (event: globalThis.PointerEvent) => !el.contains(event.target as Node) && onClose();
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [menu, onClose]);

  return (
    <div ref={ref} className="a-slotmenu" role="menu" aria-label={`Слот ${label}`} style={pos}>
      <p className="a-slotmenu__title">{label}</p>
      {waiting.length > 0 && <p className="a-slotmenu__sub">Поставить сюда</p>}
      {waiting.slice(0, 6).map((r) => (
        <button key={r.id} type="button" role="menuitem" className="a-slotmenu__item" onClick={() => onPick(r.id)}>
          <span>{r.name}</span>
          <small>
            {r.serviceTitle ?? 'без формата'} · {r.durationMin} мин
          </small>
        </button>
      ))}
      <button type="button" role="menuitem" className="a-slotmenu__item a-slotmenu__item--new" onClick={onNew}>
        <AdminIcon name="plus" size={15} /> Новая заявка на это время
      </button>
    </div>
  );
}
