"use client";
// One sheet for Today's secondary choices (More ways to practise, Change plan): a native modal dialog, so
// focus moves in and back, Escape closes it and the page behind is inert. On a phone it rises from the bottom; on a
// wide screen it sits centred. Opening and closing are 240 ms and 160 ms ease-out; reduced motion fades only.
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function TodaySheet({ open, onClose, title, lede = '', children, id }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Focus lands on the title, not the close button, so no focus ring flashes as the sheet opens (TODAY-1018 6.6).
      dialog.querySelector('.tsh__head h2')?.focus({ preventScroll: true });
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      id={id}
      className="tsh"
      aria-labelledby={id ? `${id}-title` : undefined}
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
    >
      <div className="tsh__body">
        <span className="tsh__handle" aria-hidden="true" />
        <header className="tsh__head">
          <h2 id={id ? `${id}-title` : undefined} tabIndex={-1}>{title}</h2>
          <button type="button" className="tsh__close" onClick={onClose} aria-label="Close"><X size={20} strokeWidth={1.75} aria-hidden="true" /></button>
        </header>
        {lede ? <p className="tsh__lede">{lede}</p> : null}
        {open ? children : null}
      </div>
    </dialog>
  );
}
