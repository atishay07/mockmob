"use client";

// Ask Mobi as a side sheet (the same surface as /mentor, in its drawer variant). The floating launcher that
// opened it is gone (web IA plan 2.1: Ask Mobi is a key in the Review header), so only a page that offers
// its own key mounts this; it stays here so any such page can. A solid sheet on the shared tokens, a focus
// trap, Esc closes and returns focus to whatever opened it.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import MockMobAIHub from './MockMobAIHub';
import './askmobi.css';

export default function AssistantDrawer({ open, onClose }) {
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
        <div className="am-layer">
          <motion.button
            type="button"
            className="am-scrim"
            onClick={onClose}
            aria-label="Close Ask Mobi"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          />
          <motion.section
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Ask Mobi"
            className="am-sheet"
            initial={{ x: reduced ? 0 : 24, opacity: reduced ? 1 : 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reduced ? 0 : 24, opacity: reduced ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <MockMobAIHub variant="drawer" onClose={onClose} />
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
