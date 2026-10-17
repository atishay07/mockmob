"use client";

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import MockMobAIHub from './MockMobAIHub';

// Ask Mobi's panel (N9). It opens where it was asked for: from 768 px a panel at the right edge that grows out of the
// control that opened it (the Help door's orb, a repair's "Ask Mobi about Q3") and shrinks back towards it on close;
// on a phone a sheet that rises from the bottom like the dock's other sheets. Enter is slower than exit (the student
// is arriving; on close the system just gets out of the way). Reduced motion keeps only the fade.
const SETTLE = [0.32, 0.72, 0, 1];
const OUT = [0.23, 1, 0.32, 1];
const PANEL_GAP = 12;
const PANEL_MAX = 520;

function useWide() {
  const [wide, setWide] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

// The trigger's point in the panel's own coordinates, so scale() starts from it. Without one (a link from the page
// itself), the panel grows from its own lower edge on the side nearest the student's eye.
function originFor(origin) {
  if (typeof window === 'undefined' || !origin) return '50% 100%';
  const width = Math.min(PANEL_MAX, window.innerWidth - 28);
  const left = window.innerWidth - PANEL_GAP - width;
  return `${Math.round(origin.x - left)}px ${Math.round(origin.y - PANEL_GAP)}px`;
}

export default function AssistantDrawer({ open, onClose, initialTab = 'ai', questionRef = null, origin = null }) {
  const reduced = useReducedMotion();
  const wide = useWide();
  const panel = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => panel.current?.querySelector('button')?.focus({ preventScroll: true }));
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...(panel.current?.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]') || [])].filter((node) => node.getClientRects().length);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open]);

  const motionFor = () => {
    if (reduced) {
      const fade = { opacity: 0 };
      return { initial: fade, animate: { opacity: 1 }, exit: fade, transition: { duration: 0.15 } };
    }
    if (!wide) {
      return {
        initial: { transform: 'translateY(100%)' },
        animate: { transform: 'translateY(0%)', transition: { duration: 0.42, ease: SETTLE } },
        exit: { transform: 'translateY(100%)', transition: { duration: 0.24, ease: SETTLE } },
      };
    }
    return {
      initial: { opacity: 0, transform: 'scale(0.9)' },
      animate: { opacity: 1, transform: 'scale(1)', transition: { duration: 0.34, ease: SETTLE } },
      exit: { opacity: 0, transform: 'scale(0.94)', transition: { duration: 0.18, ease: OUT } },
    };
  };

  return (
    <AnimatePresence>
      {open ? (
        <div className="mobi-layer fixed inset-0 z-[95]">
          <motion.button
            type="button"
            className="mobi-scrim absolute inset-0"
            onClick={onClose}
            aria-label="Close Ask Mobi"
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.22 }}
          />
          <motion.section
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Ask Mobi"
            className="mobi-panel arena-dark-island"
            style={{ transformOrigin: wide ? originFor(origin) : '50% 100%' }}
            {...motionFor()}
          >
            {!wide ? <span className="mobi-panel__handle" aria-hidden="true" /> : null}
            <MockMobAIHub variant="drawer" initialTab={initialTab} questionRef={questionRef} onClose={onClose} />
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
