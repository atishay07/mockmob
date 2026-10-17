"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import AskMobiPanel from './AskMobiPanel';
import { normalizeContext } from './askMobi.mjs';
import './ask-mobi.css';

// Ask Mobi's one panel in three forms (ASK-MOBI-1018, section 5):
// - 1280 px and up: docked at the right, 400 px, from under the top bar to the bottom. No scrim: the page stays visible
//   and usable (the student keeps Q7 in view while asking about it), so it is a complementary region, not a modal.
//   The main column gives up the panel's width while it is open (one change, caused by the student).
// - 768 to 1279 px: an overlay panel at the right, 400 px, over a light scrim. Click outside or Esc closes it.
// - Below 768 px: a bottom sheet as tall as its content, 92 px short of the top at most. The handle drags it; a flick
//   down (faster than 0.11 px/ms) or a drag past 35 % of its height closes it.
// Enter is slower than exit: the student is arriving; on close the system gets out of the way. Reduced motion: fades only.
const DRAWER = [0.32, 0.72, 0, 1];
const OUT = [0.23, 1, 0.32, 1];
const FLICK = 110; // px per second (0.11 px/ms)
const CLOSE_SHARE = 0.35;

export function formFor(width) {
  if (width >= 1280) return 'dock';
  if (width >= 768) return 'overlay';
  return 'sheet';
}

function useForm() {
  const [form, setForm] = useState(() => (typeof window === 'undefined' ? 'dock' : formFor(window.innerWidth)));
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1280px)');
    const mid = window.matchMedia('(min-width: 768px)');
    const update = () => setForm(formFor(window.innerWidth));
    wide.addEventListener('change', update);
    mid.addEventListener('change', update);
    return () => { wide.removeEventListener('change', update); mid.removeEventListener('change', update); };
  }, []);
  return form;
}

const PAGE = normalizeContext({ kind: 'page' });

export default function AssistantDrawer({ open, onClose, context = PAGE, onForm }) {
  const reduced = useReducedMotion();
  const form = useForm();
  const panel = useRef(null);
  const drag = useDragControls();
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => { onForm?.(open ? form : null); }, [form, open, onForm]);
  const modal = form !== 'dock';

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    // Focus lands inside the panel: the composer on a wide screen, the panel itself on a phone (no keyboard jump).
    const frame = requestAnimationFrame(() => {
      const target = form === 'sheet' ? panel.current : panel.current?.querySelector('textarea:not(:disabled)') || panel.current;
      target?.focus({ preventScroll: true });
    });
    const onKey = (event) => {
      if (event.key === 'Escape') {
        // Docked, the page stays usable: Esc closes only when focus is in the panel or on nothing in particular.
        if (!modal && document.activeElement && document.activeElement !== document.body && !panel.current?.contains(document.activeElement)) return;
        event.preventDefault(); close.current(); return;
      }
      if (!modal || event.key !== 'Tab') return;
      const controls = [...(panel.current?.querySelectorAll('a[href],button:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || [])].filter((node) => node.getClientRects().length);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      if (previous?.isConnected && previous !== document.body) previous.focus({ preventScroll: true });
    };
  }, [open, form, modal]);

  // Docked, the panel starts under the top bar: its real lower edge, read on open and as the page scrolls (a strip above
  // the bar, such as the development preview's note, moves it down until it scrolls away).
  useEffect(() => {
    if (!open || form !== 'dock') return undefined;
    let frame = 0;
    const place = () => {
      frame = 0;
      const bar = document.querySelector('.app-shell .arena-topbar');
      const bottom = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : null;
      if (bottom !== null) panel.current?.style.setProperty('--amb-top', `${bottom}px`);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(place); };
    place();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [open, form]);

  const motionFor = () => {
    if (reduced) {
      const fade = { opacity: 0 };
      return { initial: fade, animate: { opacity: 1, transition: { duration: 0.16 } }, exit: { opacity: 0, transition: { duration: 0.12 } } };
    }
    if (form === 'sheet') {
      return {
        initial: { y: '100%' },
        animate: { y: 0, transition: { duration: 0.38, ease: DRAWER } },
        exit: { y: '100%', transition: { duration: 0.22, ease: DRAWER } },
      };
    }
    return {
      initial: { x: 24, opacity: 0 },
      animate: { x: 0, opacity: 1, transition: { duration: 0.24, ease: DRAWER } },
      exit: { x: 24, opacity: 0, transition: { duration: 0.16, ease: OUT } },
    };
  };

  const onDragEnd = (_, info) => {
    const height = panel.current?.offsetHeight || 1;
    if (info.velocity.y > FLICK || info.offset.y > height * CLOSE_SHARE) onClose();
  };

  const sheetProps = form === 'sheet' && !reduced ? {
    drag: 'y', dragControls: drag, dragListener: false, dragConstraints: { top: 0, bottom: 0 }, dragElastic: { top: 0, bottom: 0.9 }, dragMomentum: false, onDragEnd,
  } : {};

  return (
    <AnimatePresence>
      {open ? (
        <div className={`amb-layer amb-layer--${form}`} key="amb-layer">
          {modal ? (
            <motion.button
              type="button"
              className="amb-scrim"
              onClick={onClose}
              aria-label="Close Ask Mobi"
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.12 : 0.22 }}
            />
          ) : null}
          <motion.section
            ref={panel}
            tabIndex={-1}
            role={modal ? 'dialog' : 'complementary'}
            aria-modal={modal ? 'true' : undefined}
            aria-labelledby="ask-mobi-title"
            className={`amb-panel amb-panel--${form}`}
            {...motionFor()}
            {...sheetProps}
          >
            {form === 'sheet' ? (
              <div className="amb-grab" onPointerDown={(event) => drag.start(event)} aria-hidden="true"><span /></div>
            ) : null}
            <AskMobiPanel context={context} onClose={onClose} form={form} titleId="ask-mobi-title" />
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
