"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import AskMobiPanel from './AskMobiPanel';
import { drawerForm, normalizeContext } from './askMobi.mjs';
import './ask-mobi.css';
import './mobi-launch.css';

// Ask Mobi's one conversation in its frames (ASK-MOBI-1018; the chat box 20 Nov 2026, owner: "this entire chatbot could just be, on
// the bottom, an opaque or glass-morphism kind of small chat box, which can then be expanded into a full page or window"):
// - From 768 px, a floating window (form 'window'): 400 px wide and up to 640 px tall, its bottom right corner where the chat box
//   rests (24 px from the right, 20 px from the bottom). It floats OVER the page with no scrim, so the page behind keeps its width,
//   its layout and its scrolling (the 19 Nov dock narrowed it by 400 px and pushed Practice into its stacked form). It is a
//   non-modal dialog: Esc closes it while focus is inside it.
// - "Make larger" turns the same window into a centred one, min(960px, 92vw) by min(86vh, 900px), over a plain dim scrim, with a
//   reading column of 720 px; "Make smaller" (or a press on the scrim) brings it back. The conversation goes on through both: the
//   panel is never remounted by a size change. Larger, it is modal: focus stays inside it.
// - Below 768 px: a phone's bottom sheet as tall as its content, 92 px short of the top at most, exactly as before. The handle drags
//   it; a flick down (faster than 0.11 px/ms) or a drag past 35 % of its height closes it.
// The window opens from the chat box's own place (scale and fade from its bottom right corner, 180 ms) and closes back into it
// (140 ms). Enter is slower than exit. Reduced motion: fades only.
const DRAWER = [0.32, 0.72, 0, 1];
const OUT = [0.23, 1, 0.32, 1];
const FLICK = 110; // px per second (0.11 px/ms)
const CLOSE_SHARE = 0.35;

export function formFor(width) {
  return drawerForm(width);
}

function useForm() {
  const [form, setForm] = useState(() => (typeof window === 'undefined' ? 'window' : formFor(window.innerWidth)));
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setForm(formFor(window.innerWidth));
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return form;
}

const PAGE = normalizeContext({ kind: 'page' });
const FOCUSABLE = 'a[href],button:not(:disabled),textarea:not(:disabled),input:not(:disabled),[tabindex="0"]';

export default function AssistantDrawer({ open, onClose, context = PAGE, onForm, launcher = false, pageHref = '/mentor' }) {
  const reduced = useReducedMotion();
  const form = useForm();
  const [size, setSize] = useState('small');
  const large = form === 'window' && size === 'large';
  const modal = form === 'sheet' || large;
  const panel = useRef(null);
  const drag = useDragControls();
  const close = useRef(onClose);
  const formNow = useRef(form);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => { formNow.current = form; }, [form]);
  useEffect(() => { onForm?.(open ? form : null); }, [form, open, onForm]);

  // Focus goes in once as it opens (the composer on a wide screen, the panel itself on a phone, so no keyboard jumps up) and back
  // to what opened it as it closes. A size change is not an open: focus stays where the student left it.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const target = formNow.current === 'sheet' ? panel.current : panel.current?.querySelector('textarea:not(:disabled)') || panel.current;
      target?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (previous?.isConnected && previous !== document.body) previous.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      const now = document.activeElement;
      const inside = Boolean(now && panel.current?.contains(now));
      if (event.key === 'Escape') {
        // The small window leaves the page usable: Esc closes it only when focus is inside it. Larger, or a phone's sheet, is modal.
        if (!modal && !inside) return;
        if (event.defaultPrevented) return;
        event.preventDefault(); close.current(); return;
      }
      if (!modal || event.key !== 'Tab') return;
      const controls = [...(panel.current?.querySelectorAll(FOCUSABLE) || [])].filter((node) => node.getClientRects().length);
      const first = controls[0]; const last = controls.at(-1);
      if (!inside) { event.preventDefault(); first?.focus(); return; }
      if (event.shiftKey && (now === first || now === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && now === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, modal]);

  // A size change answers the student's press: the same window settles into its new frame (opacity and scale, 200 ms).
  const sized = useRef(size);
  useEffect(() => {
    if (sized.current === size) return;
    sized.current = size;
    const node = panel.current;
    if (!node?.animate || reduced) return;
    node.animate([{ opacity: 0.55, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }, [size, reduced]);

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
      initial: { opacity: 0, scale: 0.92, y: 8 },
      animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: OUT } },
      exit: { opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.14, ease: OUT } },
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
        <div className={`amb-layer amb-layer--${form}${large ? ' amb-layer--large' : ''}`} key="amb-layer">
          {modal ? (
            <motion.button
              type="button"
              className="amb-scrim"
              onClick={large ? () => setSize('small') : onClose}
              aria-label={large ? 'Make smaller' : 'Close Ask Mobi'}
              aria-hidden="true"
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.12 : 0.18 }}
            />
          ) : null}
          <motion.section
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal={modal ? 'true' : undefined}
            aria-labelledby="ask-mobi-title"
            className={`amb-panel amb-panel--${form}`}
            data-size={form === 'window' ? size : undefined}
            data-launcher={launcher || undefined}
            {...motionFor()}
            {...sheetProps}
          >
            {form === 'sheet' ? (
              <div className="amb-grab" onPointerDown={(event) => drag.start(event)} aria-hidden="true"><span /></div>
            ) : null}
            <AskMobiPanel
              context={context}
              onClose={onClose}
              form={form}
              titleId="ask-mobi-title"
              size={form === 'window' ? size : null}
              onSize={form === 'window' ? setSize : null}
              pageHref={pageHref}
            />
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
