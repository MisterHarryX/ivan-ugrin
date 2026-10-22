import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { captureText, pathLabel, previewText, restoreText, sectionLabel, type CapturedText, type TextRef } from './dom.ts';

export interface TextTarget {
  refs: TextRef[];
  /** What the editor starts with (the bare amount for prices). */
  value: string;
  /** Text as written in the code. */
  original: string;
  /** Text as the page shows it right now, to find every node to preview in. */
  shown: string;
  rect: DOMRect;
  /** Turns the edited value into what the page displays (prices get their formatting). */
  display: (value: string) => string;
  /** Set for text written straight into the page (not in the config): its original wording. */
  freeKey?: string;
}

const WIDTH = 400;

/**
 * Inline editor anchored to the clicked text (from ICG). Typing previews on the page at
 * once; «Применить» keeps it as a draft until the reader publishes.
 */
export function TextPopover({ target, onApply, onClose }: { target: TextTarget; onApply: (refs: TextRef[], value: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(target.value);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [position, setPosition] = useState({ top: target.rect.bottom + 10, left: target.rect.left });
  const titleId = useId();
  const nodes = useRef<CapturedText>([]);
  const isPrice = target.refs[0].price;

  useEffect(() => {
    nodes.current = captureText(target.shown);
    const element = field.current;
    element?.focus();
    element?.setSelectionRange(element.value.length, element.value.length);
  }, [target.shown]);

  // Below the text, or above it when there is no room; always inside the viewport.
  useLayoutEffect(() => {
    const height = box.current?.offsetHeight ?? 220;
    const below = target.rect.bottom + 12;
    const top = below + height > window.innerHeight - 110 ? Math.max(12, target.rect.top - height - 12) : below;
    const left = Math.min(Math.max(12, target.rect.left), window.innerWidth - Math.min(WIDTH, window.innerWidth - 24) - 12);
    setPosition({ top, left });
  }, [target.rect]);

  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = 'auto';
    const border = element.offsetHeight - element.clientHeight;
    element.style.height = `${Math.min(element.scrollHeight + border, 260)}px`;
  }, [value]);

  const preview = (next: string) => {
    const clean = isPrice ? next.replace(/\D/g, '') : next;
    setValue(clean);
    previewText(nodes.current, target.display(clean || target.value));
  };
  const cancel = () => {
    restoreText(nodes.current);
    onClose();
  };
  const apply = () => {
    onApply(target.refs, value.trim() ? value : target.value);
    onClose();
  };
  const changedFromCode = value !== target.original;

  return (
    <div
      ref={box}
      data-site-admin
      role="dialog"
      aria-labelledby={titleId}
      className="sa-pop"
      style={{ top: position.top, left: position.left, width: `min(${WIDTH}px, calc(100vw - 24px))` }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          cancel();
        }
      }}
    >
      <div className="sa-pop__head">
        <p id={titleId}>
          {target.freeKey ? (
            <>
              <span>{target.refs[0].path.replace(/^free:/, '')}</span> · текст на странице
            </>
          ) : (
            <>
              <span>{sectionLabel(target.refs[0].path)}</span> · {target.refs[0].line !== undefined ? `строка ${target.refs[0].line + 1}` : pathLabel(target.refs[0].path)}
              {target.refs.length > 1 && <> · в {target.refs.length} местах</>}
            </>
          )}
        </p>
        <kbd>Enter — применить</kbd>
      </div>
      <div className="sa-pop__body">
        <textarea
          ref={field}
          value={value}
          rows={1}
          inputMode={isPrice ? 'numeric' : undefined}
          onChange={(event) => preview(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              apply();
            }
          }}
          aria-label={isPrice ? 'Цена в рублях' : 'Новый текст'}
          className="sa-input"
        />
        {isPrice && <p className="sa-note">Только число — пробелы и «₽» сайт поставит сам.</p>}
        {changedFromCode && (
          <p className="sa-note">
            Исходный текст: <span>{target.display(target.original)}</span>
          </p>
        )}
        <div className="sa-pop__actions">
          {changedFromCode && (
            <button type="button" className="sa-btn sa-btn--quiet" onClick={() => preview(target.original)}>
              Вернуть исходный
            </button>
          )}
          <span className="sa-spacer" />
          <button type="button" className="sa-btn sa-btn--quiet" onClick={cancel}>
            Отмена
          </button>
          <button type="button" className="sa-btn sa-btn--gold" onClick={apply}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
