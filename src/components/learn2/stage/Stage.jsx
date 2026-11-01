'use client';
// The study stage's frame (BUILD-1101 B1, B7; A1 3.2-3.6, 3.14; A8 3.1): the parts the feed and the run share.
//
//   <Stage label rootRef viewRef trackRef mode panel top ticks rail bar end overlay say busy>{pages}</Stage>
//     A focus place over the whole shell: role dialog, focus moves in on mount and back on unmount, the app shell is inert
//     while it is open, one polite live region that exists before its text (A8 F2, F7). mode 'items' | 'end'.
//     Bands: phone (top bar, item, action bar), tablet (top bar, item + rail, bar), desktop (panel, ticks + item + bar, rail).
//   <Ticks total done current />               one 2 px segment per item (a single track over 48); total 0 draws a hairline
//   <TopBar onClose title counter onCounter kept ticks meta next />   phone and tablet
//   <Panel onClose title bookRef position of time note rows next foot />   desktop only; rows = [{ label, value, sub, extra }]
//   <MiniPile />                               the kept pile (the Keep flight's target)
//   <KeptCount count />                        the phone and tablet kept count (the flight's target there)
//   <RailKey icon label on busy pop disabled onClick href describedBy />
//   <ActionBar left right prev wide hint>{main}</ActionBar>   left/right are the phone's side keys (the rail's), prev the
//                                              desktop's Previous key, main the step slot
//   <PrevKey onClick disabled />  <StepKey onClick kbd later>{label}</StepKey>  <SkipKey onClick disabled />
//   <KeysList rows onClose />                  the "?" popover (desktop)
//   helpers: still(), buzz(pattern), flyTo(fromEl, toEl)
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, LoaderCircle, X } from 'lucide-react';
import { ncertFont } from '@/components/keycards/ncertFont';
import { openUpgrade, useUpgradeState } from '@/components/pro/proNudgeStore';
import '@/components/keycards/keycards.css';
import './stage.css';

export const still = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
/** A light haptic where the browser has one: a turn 8 ms, a right answer 12 ms, a wrong answer nothing (A1 3.11). */
export const buzz = (pattern) => { try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern); } catch { /* no haptics */ } };
/** "See Pro": the shell's Upgrade sheet, or /pricing where no sheet is mounted (a focus route, Pro). */
export const seePro = (trigger, opener, navigate) => {
  const shown = openUpgrade({ trigger, opener });
  if (!shown) { if (navigate) navigate('/pricing'); else window.location.assign('/pricing'); }
};
/** The first element of a list that is on screen (one of two copies of a key, one per band). */
export const visible = (els) => (els || []).find((el) => el && el.getClientRects().length > 0 && el.offsetParent !== null) || null;

/**
 * Marks a scroll box `data-more` while content waits below its foot (the stage fades the foot then, so a long question shows
 * that it goes on) and `data-top` once it is scrolled off its top (the head fades 24 px, so a line is never cut hard under the
 * ticks). Returns the cleanup. Call it on the page in view: `useEffect(() => watchMore(el), [active])`.
 */
export function watchMore(el) {
  if (!el) return () => {};
  const flag = (name, on) => { if (on) el.setAttribute(name, ''); else el.removeAttribute(name); };
  const read = () => { flag('data-more', el.scrollHeight - el.scrollTop - el.clientHeight > 4); flag('data-top', el.scrollTop > 2); };
  read();
  el.addEventListener('scroll', read, { passive: true });
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); ro.observe(el); for (const c of el.children) ro.observe(c); }
  return () => { el.removeEventListener('scroll', read); ro?.disconnect(); el.removeAttribute('data-more'); el.removeAttribute('data-top'); };
}

/**
 * Whether the first option of an unanswered question waits below the fold (M10): `onChange(true)` while less than half of
 * option A is above the highest of `limits` ([{ el, edge: 'top' | 'bottom' }]: the scroll boxes' bottom, the bar's top). The rects
 * are read, so it does not matter which box scrolls. `roots` are the scroll boxes (scroll listeners); `find()` gives option A.
 */
export function watchBelow({ roots = [], limits = [], find, onChange }) {
  const els = roots.filter(Boolean);
  if (!els.length || typeof find !== 'function') { onChange(false); return () => {}; }
  let last = null;
  const read = () => {
    const a = find();
    let below = false;
    if (a && a.getClientRects().length && !a.closest('.st-opts, .lr-opts')?.querySelector('[data-state]')) {
      const edge = Math.min(window.innerHeight, ...limits.filter((l) => l?.el).map((l) => l.el.getBoundingClientRect()[l.edge || 'bottom']));
      below = a.getBoundingClientRect().top + 28 > edge;
    }
    if (below !== last) { last = below; onChange(below); }
  };
  read();
  for (const el of els) el.addEventListener('scroll', read, { passive: true });
  window.addEventListener('resize', read);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); for (const el of els) { ro.observe(el); for (const c of el.children) ro.observe(c); } }
  return () => { for (const el of els) el.removeEventListener('scroll', read); window.removeEventListener('resize', read); ro?.disconnect(); };
}

/** The quiet "Options below" chip: 36 px, ink-2, a down chevron, centred 8 px above the bar. A tap goes to option A. */
export function BelowChip({ show, onClick }) {
  if (!show) return null;
  return (
    <button type="button" className="st-below" onClick={onClick}>
      Options below<ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

/**
 * Scroll `row` to the top of the box that scrolls it, clear by the row's own scroll-margin-top (12 px). Like scrollIntoView
 * ({ block: 'start' }) but it moves only the nearest scroll box: scrollIntoView would also slide the pager's clipped view.
 */
export function scrollToRow(row, behavior = 'auto') {
  let box = row?.parentElement;
  while (box && box !== document.body) {
    const oy = getComputedStyle(box).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && box.scrollHeight > box.clientHeight + 1) break;
    box = box.parentElement;
  }
  if (!row || !box || box === document.body) return;
  const margin = parseFloat(getComputedStyle(row).scrollMarginTop) || 0;
  const top = box.scrollTop + row.getBoundingClientRect().top - box.getBoundingClientRect().top - margin;
  box.scrollTo({ top: Math.max(0, top), behavior });
}

/** Option A to the top of its scroll box (smooth unless motion is reduced). */
export const goToOptions = (a) => { try { scrollToRow(a, still() ? 'auto' : 'smooth'); } catch { /* old browser */ } };

/** A small copy of a card flies from `from` to `to` in 320 ms (Keep). Nothing under reduced motion. */
export function flyTo(from, to) {
  if (still() || !from || !to) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const ghost = document.createElement('span');
  ghost.className = 'st-ghost';
  const w = 72; const h = 96;
  ghost.style.left = `${a.left + a.width / 2 - w / 2}px`;
  ghost.style.top = `${a.top + a.height / 2 - h / 2}px`;
  (from.closest('.st') || document.body).appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  try {
    const anim = ghost.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 0.95 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0.2 },
    ], { duration: 320, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' });
    anim.onfinish = () => ghost.remove();
    anim.oncancel = () => ghost.remove();
  } catch { ghost.remove(); }
}

/**
 * Set `inert` on the app shell while the stage is open (the stage is portalled over it), and give focus back after. While the
 * shell's own Upgrade sheet is open (See Pro), the shell is live again so the sheet can be used.
 */
function useFocusPlace(rootRef, paused) {
  const shells = useRef([]);
  useEffect(() => {
    const root = rootRef.current;
    const opener = document.activeElement;
    shells.current = [...document.querySelectorAll('.app-shell')]
      .map((el) => { let top = el; while (top.parentElement && top.parentElement !== document.body) top = top.parentElement; return top; })
      .filter((el, i, all) => el && el !== root && !el.contains(root) && !el.hasAttribute('inert') && all.indexOf(el) === i);
    for (const el of shells.current) el.setAttribute('inert', '');
    try { root?.focus({ preventScroll: true }); } catch { /* old browser */ }
    return () => {
      for (const el of shells.current) el.removeAttribute('inert');
      shells.current = [];
      try { if (opener && opener.isConnected && opener !== document.body) opener.focus({ preventScroll: true }); } catch { /* gone */ }
    };
  }, [rootRef]);
  useEffect(() => {
    for (const el of shells.current) { if (paused) el.removeAttribute('inert'); else el.setAttribute('inert', ''); }
  }, [paused]);
}

export function Stage({ label, rootRef, viewRef, trackRef, mode = 'items', busy = false, panel = null, top = null, ticks = null, rail = null, bar = null, end = null, overlay = null, say = '', feedLabel, children, className = '' }) {
  const own = useRef(null);
  const ref = rootRef || own;
  const upgrade = useUpgradeState();
  useFocusPlace(ref, upgrade.open);
  return (
    <div ref={ref} className={`kc st ${className} ${ncertFont.variable}`.trim()} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} data-mode={mode} aria-busy={busy || undefined}>
      <div className="st-grid" aria-hidden={mode === 'end' || undefined} inert={mode === 'end' || undefined}>
        {panel}
        {top}
        {ticks ? <div className="st-ticks-desk" aria-hidden="true">{ticks}</div> : null}
        <div className="st-view" ref={viewRef}>
          <div className="st-track" ref={trackRef} role={feedLabel ? 'feed' : undefined} aria-roledescription={feedLabel ? 'feed' : undefined} aria-label={feedLabel || undefined} aria-busy={busy || undefined}>
            {children}
          </div>
        </div>
        {rail ? <div className="st-side">{rail}</div> : null}
        {bar}
      </div>
      {end}
      {overlay}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{say}</p>
    </div>
  );
}

export function Ticks({ total = 0, done = 0, current = -1 }) {
  if (!total) return <div className="st-ticks st-ticks--line" />;
  if (total > 48) {
    const share = Math.max(0, Math.min(1, (current >= 0 ? current + 1 : done) / total));
    return <div className="st-ticks--bar"><i style={{ transform: `scaleX(${share})` }} /></div>;
  }
  return (
    <div className="st-ticks">
      {Array.from({ length: total }, (_, i) => <span key={i} className="st-seg" data-state={i < done ? 'done' : i === current ? 'now' : undefined}><i /></span>)}
    </div>
  );
}

export function KeptCount({ count, refEl }) {
  if (!count) return <span ref={refEl} className="st-kept" hidden />;
  return (
    <span ref={refEl} className="st-kept" aria-label={`${count} kept`}>
      <BookmarkFill />
      <b key={count}>{count}</b>
    </span>
  );
}

/** The bookmark glyph, filled (lucide's Bookmark with a fill). */
export function BookmarkFill({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>;
}

export function TopBar({ onClose, closeLabel = 'Close', title, titleNote = null, counter = null, onCounter, counterLabel, kept = null, ticks = null, meta = null, next = null }) {
  return (
    <header className="st-top">
      <div className="st-top__ticks" aria-hidden="true">{ticks}</div>
      <div className="st-top__row">
        <button type="button" className="st-iconkey" aria-label={closeLabel} onClick={onClose}><X size={22} strokeWidth={2.2} aria-hidden="true" /></button>
        <p className="st-top__title" title={titleNote ? undefined : title || undefined}>{titleNote || title}</p>
        {kept}
        {counter ? (onCounter
          ? <button type="button" className="st-counter" onClick={onCounter} aria-label={counterLabel} aria-haspopup="dialog">{counter}<ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" /></button>
          : <span className="st-counter" aria-label={counterLabel}>{counter}</span>) : null}
      </div>
      {meta ? <p className="st-top__meta">{meta}</p> : <p className="st-top__meta" />}
      <p className="st-top__next">{next}</p>
    </header>
  );
}

export function Panel({ onClose, closeLabel = 'Close', title, bookRef, position = null, of = null, time = null, note = null, rows = [], next = null, foot = null, loading = false }) {
  return (
    <aside className="st-panel" aria-label="This session">
      <button type="button" className="st-closekey" onClick={onClose} aria-label={closeLabel}><X size={18} strokeWidth={2.2} aria-hidden="true" />Close</button>
      {loading && !title ? <span className="skeleton st-skel-line" style={{ width: 160, height: 22, marginTop: 28 }} /> : title ? <h2 className="st-panel__title">{title}</h2> : null}
      {bookRef ? <p className="st-panel__ref">{bookRef}</p> : null}
      {loading ? <span className="skeleton st-skel-line" style={{ width: 90, height: 28, marginTop: 28 }} /> : position ? <p className="st-panel__pos"><b>{position}</b>{of ? ` of ${of}` : ''}</p> : null}
      {time ? <p className="st-panel__time">{time}</p> : null}
      {note ? <p className="st-panel__note">{note}</p> : null}
      {rows.length ? (
        <dl className="st-prows">
          {rows.map((r) => (
            <div key={r.label} className="st-prow">
              <dt>{r.label}</dt>
              <dd>{r.value}{r.extra || null}{r.sub ? <span className="st-prow__sub">{r.sub}</span> : null}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {next ? <p className="st-panel__next">{next}</p> : null}
      <div className="st-panel__foot">{foot}</div>
    </aside>
  );
}

export function MiniPile({ refEl }) {
  return <span ref={refEl} className="st-mini" aria-hidden="true"><i /><i /><i /></span>;
}

export function RailKey({ icon: Icon, label, on = false, busy = false, pop = false, disabled = false, onClick, href, describedBy, refEl, title }) {
  const body = (
    <>
      <span className="st-railkey__glyph" data-pop={pop || undefined}>
        {busy ? <LoaderCircle className="kc-spin" size={20} strokeWidth={2} aria-hidden="true" /> : <Icon size={22} strokeWidth={1.9} fill={on ? 'currentColor' : 'none'} aria-hidden="true" />}
      </span>
      <span className="st-railkey__label">{label}</span>
    </>
  );
  if (href) return <Link ref={refEl} className="st-railkey" href={href} aria-describedby={describedBy} title={title}>{body}</Link>;
  return (
    <button ref={refEl} type="button" className="st-railkey" data-on={on || undefined} aria-disabled={busy || disabled || undefined}
      onClick={(e) => { if (busy || disabled) return; onClick?.(e); }} aria-describedby={describedBy} title={title}>{body}</button>
  );
}

export function ActionBar({ left = null, right = null, prev = null, wide = false, hint = null, extra = null, children }) {
  return (
    <div className="st-bar" data-wide={wide || undefined}>
      <div className="st-bar__side st-bar__side--l">{left}</div>
      <div className="st-bar__prev">{prev}</div>
      <div className="st-bar__main">{children}</div>
      <div className="st-bar__side st-bar__side--r">{right}</div>
      {hint ? <p className="st-firsthint">{hint}</p> : null}
      {extra}
    </div>
  );
}

export function PrevKey({ onClick, disabled }) {
  return (
    <button type="button" className="kc-btn kc-btn--line st-prev" onClick={onClick} disabled={disabled} aria-keyshortcuts="ArrowUp k">
      <ChevronUp size={18} strokeWidth={2.2} aria-hidden="true" />Previous<span className="kc-kbd" aria-hidden="true">Up</span>
    </button>
  );
}

export function StepKey({ onClick, kbd = 'Space', later = false, disabled = false, refEl, tone = 'volt', children, label }) {
  return (
    <button ref={refEl} type="button" className={`kc-btn kc-btn--${tone} st-step`} onClick={onClick} disabled={disabled} data-later={later || undefined} aria-label={label}>
      <span className="st-bar__label">{children}</span>
      {kbd ? <span className="kc-kbd" aria-hidden="true">{kbd}</span> : null}
    </button>
  );
}

export function SkipKey({ onClick, disabled }) {
  return <button type="button" className="kc-btn kc-btn--line st-skip" onClick={onClick} disabled={disabled}>Skip</button>;
}

export const STAGE_KEYS = Object.freeze([
  ['Down, j or Page Down', 'Next item'],
  ['Up, k or Page Up', 'Previous item'],
  ['Space or Enter', 'Turn the card over, or go on'],
  ['1 to 6, or A to F', 'Answer the question'],
  ['S', 'Keep the card, or save the question'],
  ['Home, End', 'The first item, the end'],
  ['Esc', 'Stop for now, or close this list'],
]);

export function KeysList({ rows = STAGE_KEYS, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const away = (e) => { if (!ref.current?.contains(e.target)) onClose?.(); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);
  return (
    <div ref={ref} className="st-keys" role="dialog" aria-label="Keys" data-pager-ignore="">
      <p className="st-keys__title">Keys</p>
      <dl>{rows.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>
  );
}
