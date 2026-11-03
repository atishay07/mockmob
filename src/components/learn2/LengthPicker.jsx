'use client';
// The length control shared by Learn home's offer (LK37) and the chapter page: the site's SegmentedControl (5 min | 10 min | 20 min |
// Other) and the "Your own length" sheet that "Other" opens. One chosen length per device (MINUTES_KEY), so the two pages agree.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/controls/SegmentedControl';
import '../keycards/keycards.css';
import './length.css';

export const LENGTHS = [5, 10, 20];
export const OWN_PRESETS = [30, 45, 60];
export const OWN_MIN = 5;
export const OWN_MAX = 120;
export const OWN_STEP = 5;
export const MINUTES_KEY = 'mm:learn2:minutes';
export const store = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* a private window keeps nothing */ } },
};
export const minutesLabel = (m) => (m >= 60 && m % 60 === 0 ? (m === 60 ? '1 hour' : `${m / 60} hours`) : `${m} min`);
export const validMinutes = (m) => Number.isFinite(m) && m >= OWN_MIN && m <= OWN_MAX;


/** "Your own": three ready lengths (one press chooses) and a stepper in 5-minute steps, chosen with its own key. */
export function OwnSheet({ open, minutes, onChoose, onClose, returnRef, anchorRef }) {
  const titleId = useId();
  const [at, setAt] = useState(null);
  const [own, setOwn] = useState(() => (LENGTHS.includes(minutes) || OWN_PRESETS.includes(minutes) ? 35 : minutes));
  const first = useRef(null);
  const panel = useRef(null);
  // Above the app's dock and bars: the sheet is drawn into <body> (the arena tokens live on <html>). On a wide screen it
  // hangs under the length control, right-aligned to it.
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) setAt({ top: r.bottom + window.scrollY + 8, right: document.documentElement.clientWidth - r.right });
    };
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', place); };
  }, [open, anchorRef]);
  useEffect(() => {
    if (!open) return undefined;
    first.current?.focus({ preventScroll: true });
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll('button:not(:disabled), [role="spinbutton"]')];
        if (!f.length) return;
        const [a, z] = [f[0], f[f.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, onClose, returnRef]);
  if (!open || typeof document === 'undefined') return null;
  const step = (d) => setOwn((n) => Math.min(OWN_MAX, Math.max(OWN_MIN, n + d * OWN_STEP)));
  const spin = (e) => {
    const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
    if (map[e.key]) { e.preventDefault(); step(map[e.key]); }
    if (e.key === 'Home') { e.preventDefault(); setOwn(OWN_MIN); }
    if (e.key === 'End') { e.preventDefault(); setOwn(OWN_MAX); }
    if (e.key === 'Enter') { e.preventDefault(); onChoose(own); }
  };
  return createPortal(
    <div className="lc-own-layer">
      <button type="button" className="lc-own__scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div ref={panel} className="lc-own" role="dialog" aria-modal="true" aria-labelledby={titleId} style={at ? { '--lc-own-top': `${at.top}px`, '--lc-own-right': `${at.right}px` } : undefined}>
        <span className="lc-own__grab" aria-hidden="true" />
        <h2 id={titleId} className="lc-own__title">Your own length</h2>
        <div className="lc-own__presets">
          {OWN_PRESETS.map((m, i) => (
            <button key={m} ref={i === 0 ? first : undefined} type="button" className="lc-own__preset" aria-pressed={minutes === m} onClick={() => onChoose(m)}>{minutesLabel(m)}</button>
          ))}
        </div>
        <div className="lc-own__step">
          <button type="button" className="lc-own__nudge" aria-label="5 minutes less" disabled={own <= OWN_MIN} onClick={() => step(-1)}><Minus size={18} strokeWidth={2.4} aria-hidden="true" /></button>
          <div className="lc-own__read" role="spinbutton" tabIndex={0} aria-label="Minutes" aria-valuemin={OWN_MIN} aria-valuemax={OWN_MAX} aria-valuenow={own} aria-valuetext={`${own} minutes`} onKeyDown={spin}>
            <b>{own}</b> min
          </div>
          <button type="button" className="lc-own__nudge" aria-label="5 minutes more" disabled={own >= OWN_MAX} onClick={() => step(1)}><Plus size={18} strokeWidth={2.4} aria-hidden="true" /></button>
        </div>
        <button type="button" className="lc-own__use" onClick={() => onChoose(own)}>Use {own} minutes</button>
      </div>
    </div>,
    document.body,
  );
}

/** The site's segmented control for 5 | 10 | 20 | Other. Its segment keeps what was chosen; "Other" reopens its sheet. */
export function LengthControl({ minutes, onChange, onOwn, labelledBy, wrapRef }) {
  const own = !LENGTHS.includes(minutes);
  const options = [...LENGTHS.map((m) => ({ value: m, label: `${m} min` })), { value: 'own', label: own ? minutesLabel(minutes) : 'Other' }];
  // The control ignores a press on the option already chosen; "Your own" chosen and pressed again opens its sheet.
  const reopen = (e) => {
    const radio = e.target.closest?.('[role="radio"]');
    if (own && radio && radio === wrapRef.current?.querySelectorAll('[role="radio"]')[3]) onOwn();
  };
  return (
    <div className="lc-len-wrap" ref={wrapRef} onClickCapture={reopen}>
      <SegmentedControl labelledBy={labelledBy} value={own ? 'own' : minutes} options={options} className="lc-seg" onChange={(v) => (v === 'own' ? onOwn() : onChange(v))} />
    </div>
  );
}

