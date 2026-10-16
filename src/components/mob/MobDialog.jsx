"use client";
// A small modal for the Mob's secondary steps (invite, member actions, rename, confirm). Native <dialog> with
// showModal: focus moves in, Escape closes, focus returns to the opener, and the page behind is inert.
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function MobDialog({ open, onClose, title, children, labelId }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const closed = () => onClose?.();
    el.addEventListener('close', closed);
    return () => el.removeEventListener('close', closed);
  }, [onClose]);
  return (
    <dialog ref={ref} className="mob-dialog" aria-labelledby={labelId}
      onClick={(event) => { if (event.target === ref.current) ref.current.close(); }}>
      {open ? (
        <div className="mob-dialog__body">
          <header className="mob-dialog__head">
            <h2 id={labelId} className="mob-dialog__title">{title}</h2>
            <button type="button" className="mob-icon" aria-label="Close" onClick={() => ref.current?.close()}><X size={18} aria-hidden="true" /></button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export default MobDialog;
