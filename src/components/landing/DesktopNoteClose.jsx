'use client';

import { X } from 'lucide-react';
import { DESK_NOTE_KEY } from './desktopNoteGate.mjs';

// The note's cross: gone now, and for good on this device.
export function DesktopNoteClose() {
  const close = () => {
    try { window.localStorage.setItem(DESK_NOTE_KEY, 'x'); } catch { /* storage blocked: it goes for this view */ }
    document.documentElement.removeAttribute('data-desk-note');
  };
  return (
    <button type="button" className="lp-desk-note__x" aria-label="Dismiss this tip" onClick={close}>
      <X size={15} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}
