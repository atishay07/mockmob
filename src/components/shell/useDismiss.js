"use client";

import { useEffect } from 'react';

// Closes an open menu or sheet on Escape, on a press outside it, and when focus leaves it, and
// moves focus into it on open. Escape returns focus to the control that opened it.
// `rootRef` wraps the trigger and the panel; `triggerRef` is the opener; `panelRef` the panel.
export function useDismiss(open, close, { rootRef, triggerRef, panelRef, focusFirst = true } = {}) {
  useEffect(() => {
    if (!open) return undefined;
    const inside = (node) => Boolean(node && rootRef?.current?.contains(node));
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
      triggerRef?.current?.focus({ preventScroll: true });
    };
    const onPointer = (event) => { if (!inside(event.target)) close(); };
    const onFocus = (event) => { if (!inside(event.target)) close(); };
    const frame = focusFirst
      ? requestAnimationFrame(() => panelRef?.current?.querySelector('a[href], button:not([disabled])')?.focus({ preventScroll: true }))
      : 0;
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open, close, rootRef, triggerRef, panelRef, focusFirst]);
}
