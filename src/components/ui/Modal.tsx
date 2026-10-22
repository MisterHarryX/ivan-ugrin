import { useEffect, useRef, type ReactNode } from 'react';

/** Native dialog supplies keyboard trapping, inert background and Escape handling. */
export function Modal({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const before = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); before?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal__content">
      <button className="modal__close" aria-label="Закрыть" onClick={onClose}>×</button>
      {children}
    </div>
  </dialog>;
}
