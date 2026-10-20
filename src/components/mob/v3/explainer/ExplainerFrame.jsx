"use client";
// The frame the explainer and the setup draw in: a fixed 360 x 780 design canvas, scaled to fit. On a phone (under 640 px
// wide) it fills the screen on the den's ground; on a desktop it is a centred panel over the dimmed page. A modal dialog:
// focus stays inside (Tab wraps), Escape and a click on the dimmed page call onEscape, the page under it does not scroll,
// and focus goes back to where it was when the frame closes. The scale is shared (useFrameScale) for pointer maths.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './explainer.css';

export const DESIGN_W = 360;
export const DESIGN_H = 780;
const FrameScale = createContext(1);
export const useFrameScale = () => useContext(FrameScale);

/** The fit for a viewport: { s, fit: 'phone' | 'panel' }. */
export function fitFor(vw, vh) {
  if (vw < 640) return { s: Math.min(vw / DESIGN_W, vh / DESIGN_H), fit: 'phone' };
  return { s: Math.max(0.6, Math.min((vh - 48) / DESIGN_H, (vw - 48) / DESIGN_W, 1.25)), fit: 'panel' };
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function ExplainerFrame({ label, onEscape, children, initialFocus = null, className = '', id }) {
  const [fit, setFit] = useState(null);
  const [host, setHost] = useState(null);
  const overlay = useRef(null);
  const escRef = useRef(onEscape);
  useEffect(() => { escRef.current = onEscape; }, [onEscape]);
  useIsoLayout(() => {
    setHost(document.body);
    const measure = () => setFit(fitFor(window.innerWidth, window.innerHeight));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  // Modal: the page under it does not scroll; focus returns where it was.
  useEffect(() => {
    const before = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      if (before && typeof before.focus === 'function' && before.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (!fit || !overlay.current) return;
    const el = overlay.current;
    if (!el.contains(document.activeElement)) {
      // The dialog itself takes focus (its label is read); Tab then reaches Skip, Next and the keys in order.
      const first = (initialFocus && el.querySelector(initialFocus)) || el.querySelector('.mx-frame');
      first?.focus({ preventScroll: true });
    }
  }, [fit, initialFocus]);
  useEffect(() => {
    const onKey = (e) => {
      const el = overlay.current;
      if (!el) return;
      if (e.key === 'Escape') { e.preventDefault(); escRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const list = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!list.length) return;
      const first = list[0]; const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  if (!host || !fit) return null;
  const { s } = fit;
  return createPortal(
    <div ref={overlay} className={`mx mx-overlay ${className}`.trim()} data-fit={fit.fit} id={id}
      onPointerDown={(e) => { if (fit.fit === 'panel' && e.target === e.currentTarget) escRef.current?.(); }}>
      <div className="mx-frame" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={{ width: DESIGN_W * s, height: DESIGN_H * s }}>
        <div className="mx-canvas" style={{ transform: `scale(${s})` }}>
          <FrameScale.Provider value={s}>{children}</FrameScale.Provider>
        </div>
      </div>
    </div>,
    host,
  );
}

export default ExplainerFrame;
