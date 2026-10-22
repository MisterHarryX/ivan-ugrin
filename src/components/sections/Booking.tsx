import { useEffect, useId, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { CONTACT_PREFS, CONTACT_PREF_LABELS, formatPhone, normalizePhone, type ContactPref } from '../../../shared/booking.ts';
import { DEFAULT_WORK_HOURS, bookableDays, slotsFor, type Availability } from '../../../shared/schedule.ts';
import { zonedTime } from '../../../shared/time.ts';
import type { ContactMethod } from '../../config/types.ts';
import { site } from '../../config/site.ts';
import { getAvailability, sendRequest } from '../../lib/api.ts';
import { BOOKING_ID, useBooking } from '../../lib/BookingContext.tsx';
import { LetterSketch } from '../ui/Sketches.tsx';
import { contactDisplay, contactHref, contactNames, copiesNumber, isExternal, prettyPhone, supportsPrefill } from '../../lib/contacts.ts';
import { Icon } from '../ui/Icon.tsx';
import { SectionHeading } from '../ui/SectionHeading.tsx';
import { formatPrice } from '../../lib/format.ts';

/** One tap adds a theme to the question, so nobody has to find words for it alone. */
const QUICK_TOPICS = ['Кризис', 'Отношения', 'Тревога', 'Потеря', 'Дело и деньги', 'Найти себя', 'Здоровье'];
/** Telegram first: most people answer there fastest. */
const PREF_ORDER: ContactPref[] = ['telegram', 'max', 'call'];

type CopyState = 'idle' | 'copied' | 'number' | 'failed';
type SendState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; when: string } | { kind: 'error'; message: string };

const TZ_FALLBACK = 'Europe/Moscow';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function channelHint(contact: ContactMethod): string {
  if (contact.hint) return contact.hint;
  if (contact.kind === 'booking') return 'Откроется страница онлайн-записи';
  if (supportsPrefill[contact.kind]) return 'Текст подставится автоматически';
  return 'Текст скопируется — вставьте его в чат';
}

/** "+7 (900) 123-45-67" while typing a Russian number; other numbers keep their digits. */
function maskPhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (!d) return input.trim().startsWith('+') ? '+' : '';
  if (d.startsWith('8')) d = `7${d.slice(1)}`;
  if (d.startsWith('9')) d = `7${d}`;
  if (!d.startsWith('7')) return `+${d.slice(0, 15)}`;
  d = d.slice(1, 11);
  let out = '+7';
  if (d.length) out += ` (${d.slice(0, 3)}`;
  if (d.length >= 3) out += ')';
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

const ERRORS: Record<string, string> = {
  'invalid-name': 'Подскажите, как к вам обращаться.',
  'invalid-phone': 'Проверьте номер телефона — в нём не хватает цифр.',
  'invalid-time': 'Это время уже прошло. Выберите другое.',
  'too-many': 'Слишком много заявок подряд. Попробуйте чуть позже или напишите мне напрямую.',
  'storage-unavailable': 'Приём заявок на сайте пока не настроен. Напишите мне в мессенджер ниже — отвечу так же быстро.',
  network: 'Нет связи с сервером. Проверьте интернет или напишите мне напрямую.',
};

/**
 * Booking: a request saved on the site (name, phone, format, a free slot), and below it
 * the messengers with the same text prefilled for those who prefer to write themselves.
 */
export function Booking() {
  const { booking, services, contacts } = site;
  const { serviceId, setServiceId } = useBooking();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPref, setContactPref] = useState<ContactPref>('telegram');
  const [skipTime, setSkipTime] = useState(false);
  const [unsure, setUnsure] = useState(false);
  const [question, setQuestion] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [trap, setTrap] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [fallbackNow] = useState(() => Date.now());
  const [send, setSend] = useState<SendState>({ kind: 'idle' });
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const uid = useId();

  const service = services.items.find((s) => s.id === serviceId);
  const needsTime = !service || service.minutes !== undefined;
  const durationMin = service?.minutes ?? 60;

  useEffect(() => {
    let cancelled = false;
    getAvailability().then((a) => !cancelled && setAvailability(a));
    return () => {
      cancelled = true;
    };
  }, []);

  // Without the API (a static preview) the picker still works from the default hours.
  const schedule = useMemo<Availability>(
    () => availability ?? { tz: TZ_FALLBACK, hours: DEFAULT_WORK_HOURS, busy: [], now: fallbackNow },
    [availability, fallbackNow],
  );
  const tz = schedule.tz;
  const days = useMemo(() => bookableDays(schedule.hours, schedule.now, tz), [schedule, tz]);
  const daySlots = useMemo(() => new Map(days.map((d) => [d, slotsFor(d, durationMin, schedule)])), [days, durationMin, schedule]);
  const slots = useMemo(() => (date ? (daySlots.get(date) ?? []) : []), [date, daySlots]);

  // A picked time the new format no longer fits is dropped rather than silently kept.
  useEffect(() => {
    if (time && !slots.some((s) => s.time === time && s.free)) setTime('');
  }, [slots, time]);

  const dayLabel = useMemo(() => {
    const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: tz });
    const day = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: tz });
    const month = new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: tz });
    return (key: string) => {
      const at = zonedTime(key, '12:00', tz);
      return { weekday: weekday.format(at).replace('.', ''), day: day.format(at), month: month.format(at).replace('.', '') };
    };
  }, [tz]);

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const chosen = slots.find((s) => s.time === time);
  const localHint = useMemo(() => {
    if (!chosen || localTz === tz) return '';
    const local = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(chosen.at);
    return local === chosen.time ? '' : `По вашему времени это ${local}`;
  }, [chosen, localTz, tz]);

  const whenText = useMemo(() => {
    if (!date || !time) return '';
    const d = dayLabel(date);
    return `${d.weekday}, ${d.day} ${d.month}, в ${time}`;
  }, [date, time, dayLabel]);

  const message = useMemo(
    () =>
      [
        booking.greeting,
        service ? `Формат: ${service.title} (${service.duration}).` : '',
        whenText ? `Удобно: ${whenText} (по Москве).` : '',
        name.trim() ? `Меня зовут ${name.trim()}.` : '',
        question.trim() ? `Мой вопрос: ${question.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    [booking.greeting, service, whenText, name, question],
  );

  useEffect(() => setCopyState('idle'), [message]);

  const onChannel = async (contact: ContactMethod) => {
    // Max by number: the button dials; the number goes to the clipboard to find the chat in Max.
    if (copiesNumber(contact)) { setCopyState((await copyText(prettyPhone(contact.value))) ? 'number' : 'failed'); return; }
    if (contact.kind !== 'telegram') return;
    // Telegram links cannot carry text to a personal chat, so the message goes to the clipboard.
    setCopyState((await copyText(message)) ? 'copied' : 'failed');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (send.kind === 'sending') return;
    if (!name.trim()) return setSend({ kind: 'error', message: ERRORS['invalid-name'] });
    if (!normalizePhone(phone)) return setSend({ kind: 'error', message: ERRORS['invalid-phone'] });
    setSend({ kind: 'sending' });
    const result = await sendRequest({
      name,
      phone,
      contactPref,
      serviceId: service?.id ?? null,
      serviceTitle: service?.title ?? null,
      durationMin,
      question,
      date: needsTime ? date : '',
      time: needsTime ? time : '',
      website: trap,
    });
    if (result.ok) {
      setSend({ kind: 'sent', when: needsTime ? whenText : '' });
      getAvailability().then(setAvailability);
    } else {
      setSend({ kind: 'error', message: ERRORS[result.error] ?? 'Не получилось отправить заявку. Попробуйте ещё раз или напишите мне напрямую.' });
    }
  };

  const phoneOk = Boolean(normalizePhone(phone));
  const steps = [Boolean(service) || unsure, !needsTime || Boolean(time) || skipTime, Boolean(name.trim()) && phoneOk];
  const progress = steps.filter(Boolean).length / steps.length;
  const addTopic = (topic: string) => setQuestion((q) => (q.toLowerCase().includes(topic.toLowerCase()) ? q : q.trim() ? `${q.trim()}, ${topic.toLowerCase()}` : topic));

  const reset = () => {
    setSend({ kind: 'idle' });
    setQuestion('');
    setTime('');
  };

  return (
    <section id={BOOKING_ID} className="section booking" aria-labelledby={`${BOOKING_ID}-title`}>
      <div className="wrap booking__grid">
        <div className="booking__intro">
          <SectionHeading id={`${BOOKING_ID}-title`} title={booking.title} lead={booking.lead} focusable />
          <p className="booking__privacy">{booking.privacyNote}</p>
          <LetterSketch />
        </div>

        <div className="composer" data-state={send.kind}>
          {send.kind === 'sent' ? (
            <div className="sealed" role="status">
              <svg className="sealed__letter" viewBox="0 0 220 150" aria-hidden="true" focusable="false">
                <path className="sealed__paper" pathLength={1} d="M14 26h192v108H14Z" />
                <path className="sealed__fold" pathLength={1} d="M14 26l96 62 96-62" />
                <g className="sealed__wax">
                  <circle cx="110" cy="86" r="21" />
                  <path d="M116 74c-10 4-12 18-2 24-13 1-19-17-8-24 3-2 7-2 10 0Z" />
                </g>
              </svg>
              <h3 className="sealed__title">Спасибо за ваше доверие</h3>
              <p className="sealed__text">
                {name.trim() ? `${name.trim()}, я` : 'Я'} свяжусь с вами по номеру <strong>{formatPhone(normalizePhone(phone))}</strong>
                {contactPref !== 'call' ? ` в ${CONTACT_PREF_LABELS[contactPref]}` : ''}
                {send.when ? `, чтобы подтвердить встречу: ${send.when} по Москве.` : ' и предложу удобное время.'}
              </p>
              <button type="button" className="text-button" onClick={reset}>
                Оставить ещё одну заявку
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} aria-labelledby={`${uid}-legend`}>
              <div className="composer__head">
                <h3 id={`${uid}-legend`} className="composer__title">Оставьте заявку</h3>
                <span className="composer__steps" aria-hidden="true">{steps.filter(Boolean).length} из 3</span>
              </div>
              <div className="composer__progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
              <p className="composer__hint">Займёт минуту. Я отвечу и подтвержу время лично.</p>

              <fieldset className="composer__formats">
                <legend><b className="step-n" data-done={steps[0] || undefined}>1</b> Формат</legend>
                <div className="fmt-grid">
                  {services.items.map((s) => (
                    <label key={s.id} className="fmt">
                      <input type="radio" name={`${uid}-service`} value={s.id} checked={serviceId === s.id} onChange={() => setServiceId(s.id)} />
                      <span>
                        <strong>{s.title}</strong>
                        <small>{s.duration} · {s.format.split('·')[0].trim()}</small>
                        <b>{formatPrice(s.price)}</b>
                      </span>
                    </label>
                  ))}
                  <label className="fmt fmt--unsure">
                    <input type="radio" name={`${uid}-service`} value="" checked={!service} onChange={() => { setServiceId(null); setUnsure(true); }} />
                    <span><strong>Пока не знаю</strong><small>подскажу на связи</small></span>
                  </label>
                </div>
              </fieldset>

              {needsTime && (
                <fieldset className="when">
                  <legend>
                    <b className="step-n" data-done={steps[1] || undefined}>2</b> Когда удобно <span className="when__tz">время московское</span>
                    <label className="when__skip">
                      <input type="checkbox" checked={skipTime} onChange={(e) => { setSkipTime(e.target.checked); if (e.target.checked) { setDate(''); setTime(''); } }} />
                      <span>Подберём вместе</span>
                    </label>
                  </legend>
                  <div className="days" role="radiogroup" aria-label="День">
                    {days.map((key) => {
                      const d = dayLabel(key);
                      const free = daySlots.get(key)?.some((s) => s.free) ?? false;
                      return (
                        <label key={key} className="day" data-free={free}>
                          <input type="radio" name={`${uid}-day`} value={key} checked={date === key} disabled={!free} onChange={() => { setDate(key); setSkipTime(false); }} />
                          <span>
                            <small>{d.weekday}</small>
                            <b>{d.day}</b>
                            <small>{d.month}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {date ? (
                    <div className="slots" role="radiogroup" aria-label="Время" key={`${date}-${durationMin}`}>
                      {slots.map((s, i) => (
                        <label key={s.time} className="slot" style={{ '--i': i } as CSSProperties}>
                          <input type="radio" name={`${uid}-time`} value={s.time} checked={time === s.time} disabled={!s.free} onChange={() => setTime(s.time)} />
                          <span>{s.time}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="when__empty">Выберите день — покажу свободное время. Можно и не выбирать: договоримся.</p>
                  )}
                  {localHint && <p className="when__local">{localHint}</p>}
                </fieldset>
              )}

              <p className="composer__step"><b className="step-n" data-done={steps[2] || undefined}>3</b> Контакты</p>
              <div className="composer__row">
                <div className="field">
                  <label htmlFor={`${uid}-name`}>Как к вам обращаться</label>
                  <input id={`${uid}-name`} type="text" autoComplete="given-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-phone`}>Телефон</label>
                  <input
                    id={`${uid}-phone`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={22}
                    placeholder="+7 (900) 000-00-00"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    required
                  />
                </div>
              </div>

              <fieldset className="composer__formats">
                <legend>Где удобнее ответить</legend>
                <div className="chips">
                  {PREF_ORDER.filter((p) => CONTACT_PREFS.includes(p)).map((pref) => (
                    <label key={pref} className="chip">
                      <input type="radio" name={`${uid}-pref`} value={pref} checked={contactPref === pref} onChange={() => setContactPref(pref)} />
                      <span>{CONTACT_PREF_LABELS[pref]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="field">
                <label htmlFor={`${uid}-question`}>Что хотите обсудить (необязательно)</label>
                <textarea
                  id={`${uid}-question`}
                  rows={3}
                  maxLength={600}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Можно оставить пустым или выбрать тему ниже"
                />
                <div className="quick-topics" role="group" aria-label="Быстро добавить тему">
                  {QUICK_TOPICS.map((t) => <button type="button" key={t} aria-pressed={question.toLowerCase().includes(t.toLowerCase())} onClick={() => addTopic(t)}>+ {t}</button>)}
                </div>
              </div>

              {/* Honeypot: hidden from people, irresistible to bots. */}
              <div className="composer__trap" aria-hidden="true">
                <label>
                  Сайт
                  <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
                </label>
              </div>

              <div className="composer__summary" aria-live="polite">
                <span className="composer__summary-mark" aria-hidden="true">✦</span>
                <span>
                  <strong>{service ? service.title : 'Формат обсудим'}</strong>
                  <small>{whenText ? `${whenText} по Москве` : 'время подберём вместе'}{service ? ` · ${formatPrice(service.price)}` : ''}</small>
                </span>
              </div>

              <div className="composer__submit">
                <button type="submit" className="btn btn--primary" disabled={send.kind === 'sending'} data-sending={send.kind === 'sending'}>
                  {send.kind === 'sending' ? 'Отправляю…' : 'Отправить заявку'}
                </button>
                <p className="composer__consent">Нажимая кнопку, вы соглашаетесь, что я свяжусь с вами по этому номеру.</p>
              </div>
              <p className="composer__error" role="alert">
                {send.kind === 'error' ? send.message : ''}
              </p>
            </form>
          )}

          {contacts.length > 0 && (
            <div className="composer__direct">
              <p className="composer__or">
                <span>или напишите напрямую</span>
              </p>
              <ul className="channels" aria-label="Куда написать">
                {contacts.map((contact) => (
                  <li key={contact.kind}>
                    <a
                      className={`channel channel--${contact.kind}`}
                      href={contactHref(contact)}
                      onClick={() => onChannel(contact)}
                      {...(isExternal(contact) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      <Icon name={contact.kind} size={22} />
                      <span className="channel__text">
                        <span className="channel__name">{contact.label ?? contactNames[contact.kind]}</span>
                        <span className="channel__hint">{channelHint(contact)}</span>
                      </span>
                      <span className="channel__handle">{contactDisplay(contact)}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="composer__status" role="status">
                {copyState === 'copied' && 'Текст скопирован. Вставьте его в чат и отправьте, когда будете готовы.'}
                {copyState === 'number' && 'Номер скопирован — найдите его в поиске Max.'}
                {copyState === 'failed' && 'Не получилось скопировать автоматически — выделите текст и скопируйте вручную.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
