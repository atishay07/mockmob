"use client";

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import MockMobAIHub from './MockMobAIHub';

export default function AssistantDrawer({ open, onClose, initialTab = 'ai' }) {
  const reduced = useReducedMotion();
  const panel = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => panel.current?.querySelector('button')?.focus());
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...(panel.current?.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]') || [])].filter((node) => node.getClientRects().length);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[95]">
          <motion.button
            type="button"
            className="absolute inset-0 hidden bg-zinc-950/58 md:block"
            onClick={onClose}
            aria-label="Close PrepOS"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          />
          <motion.section
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="PrepOS assistant"
            className="arena-dark-island absolute inset-0 flex flex-col bg-[#090a08] md:inset-y-3 md:right-3 md:left-auto md:w-[min(520px,calc(100vw-28px))] md:overflow-hidden md:rounded-[26px] md:border md:border-white/10 md:shadow-[0_0_90px_rgba(0,0,0,0.62)]"
            initial={{ x: reduced ? 0 : 24, opacity: reduced ? 1 : 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reduced ? 0 : 24, opacity: reduced ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <MockMobAIHub variant="drawer" initialTab={initialTab} onClose={onClose} />
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
