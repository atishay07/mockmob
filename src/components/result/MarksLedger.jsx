"use client";
// The Mistake Lab ledger on the result page (spec tmp/mistake-lab-v4/SPEC.md 4.1 to 4.3): where every missed mark of
// this paper went, in groups that add up exactly, with one thing to do for each group, the first-pick re-mark and
// the "most other students got it right" line. Every sentence and number comes finished from the server
// (data/mistake_lab.js, the same words as the app); this file only lays them out and moves them.
//
// Motion (4.1): the first time this attempt's bar is in view, it starts as one neutral "missed" block and splits into
// its groups left to right (each segment 180 ms, 60 ms apart); each legend row fades in 150 ms after its segment.
// It plays once per attempt (sessionStorage). Opening a row dims the other segments to 40% and lifts its own by
// 2 px (150 ms). Reduced motion, a later view or no IntersectionObserver: the final state at once, dimming only.
// Pass 1016e (WC-01 to WC-03): a click on a bar segment opens its row and glides the page to it (300 ms, the glide curve;
// at once under reduced motion), its segment lifted 2 px. The re-mark is one net line and the two re-mark figures over
// one denominator. Every method sentence sits under one 44 px row, "How this is counted", that opens in place (200 ms).
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Play, Users } from 'lucide-react';
import { curves, durations } from '@/lib/motion/tokens.g.js';
import { SPLIT_OBSERVER, splitPhaseFor } from './splitReveal.mjs';
import './marks-ledger.css';

const CHIPS_SHOWN = 8; // LAB_RULES.chipsShown in data/mistake_lab.js

const reducedMotion = () => {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
};
const seenKey = (attemptId) => `lab-split:${attemptId}`;
function wasSeen(attemptId) {
  try { return window.sessionStorage.getItem(seenKey(attemptId)) === '1'; } catch { return false; }
}
function markSeen(attemptId) {
  try { window.sessionStorage.setItem(seenKey(attemptId), '1'); } catch { /* storage blocked: the split may play again, nothing else changes */ }
}

// A cubic-bezier easing (the token curves are the four control values), solved for x by Newton steps then bisection.
function bezier([x1, y1, x2, y2]) {
  const at = (a, b, t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  const slope = (a, b, t) => 3 * (1 - 3 * b + 3 * a) * t * t + 2 * (3 * b - 6 * a) * t + 3 * a;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i += 1) {
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= (at(x1, x2, t) - x) / d;
    }
    if (!(t >= 0 && t <= 1)) {
      let lo = 0; let hi = 1; t = x;
      for (let i = 0; i < 20; i += 1) { if (at(x1, x2, t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    }
    return at(y1, y2, t);
  };
}
const glideEase = bezier(curves.glide);

/**
 * Brings `el` into view on the glide (300 ms), leaving it alone when it is already fully on screen. The landing spot
 * honours the element's scroll-margin-top, so a sticky header never covers it. Reduced motion: one jump.
 */
function glideTo(el) {
  if (!el || typeof window === 'undefined') return;
  const box = el.getBoundingClientRect();
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const bottomInset = 96; // the dock and the floating key on phones
  if (box.top >= margin && box.bottom <= window.innerHeight - bottomInset) return;
  const from = window.scrollY;
  const to = Math.max(0, from + box.top - margin);
  // 'instant' each frame: the page sets scroll-behavior: smooth, which would turn every frame into its own smooth scroll.
  if (reducedMotion() || Math.abs(to - from) < 2) { window.scrollTo({ top: to, behavior: 'instant' }); return; }
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / durations.glide);
    window.scrollTo({ top: from + (to - from) * glideEase(p), behavior: 'instant' });
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// 'armed' holds the neutral block until the bar is in view; 'split' plays the split once; 'still' is the final state.
function useSplit(attemptId) {
  const ref = useRef(null);
  const [phase, setPhase] = useState(() => {
    if (typeof window === 'undefined' || !attemptId) return 'still';
    if (typeof IntersectionObserver === 'undefined' || reducedMotion() || wasSeen(attemptId)) return 'still';
    return 'armed';
  });
  useEffect(() => {
    if (phase !== 'armed') return undefined;
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      const next = splitPhaseFor({ isIntersecting: entry.isIntersecting, bottom: entry.boundingClientRect.bottom, height: entry.boundingClientRect.height, rootTop: entry.rootBounds?.top ?? 0 });
      if (!next) return;
      io.disconnect();
      markSeen(attemptId);
      if (next === 'still') { setPhase('still'); return; }
      // Two frames, so the neutral block is painted before it splits.
      raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => setPhase(reducedMotion() ? 'still' : 'split')); });
    }, SPLIT_OBSERVER);
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [phase, attemptId]);
  return [ref, phase];
}

// Numbers carry the sentence, so they are set in the heavier ink. The words stay exactly as the server sent them.
const NUMBER = /((?<![\w−])−?\d+(?:[.,]\d+)?(?:h|m|s)?(?![\w]))/;
export function withNumbers(text) {
  return String(text ?? '').split(NUMBER).map((part, i) => (i % 2 ? <b key={i} className="ml-num">{part}</b> : part));
}

/** Q chips: the first eight, then "Show {k} more". Each opens that answer with the page's own jump. */
export function LabChips({ numbers, onJump, showMore }) {
  const [all, setAll] = useState(false);
  if (!numbers?.length) return null;
  const shown = all ? numbers : numbers.slice(0, CHIPS_SHOWN);
  const rest = numbers.length - shown.length;
  return (
    <div className="ml-chips">
      {shown.map((n) => (
        <button key={n} type="button" className="ml-chip" onClick={() => onJump?.(n)} aria-label={`Go to question ${n}`}>Q{n}</button>
      ))}
      {rest > 0 ? (
        <button type="button" className="ml-chip ml-chip--more" onClick={() => setAll(true)}>{String(showMore || 'Show {k} more').replace('{k}', rest)}</button>
      ) : null}
    </div>
  );
}

/**
 * MarksLedger({ lab, attemptId, onJump, changesId, replay }): the ledger for lab.state 'ready' or 'basic'.
 * `changesId` is the id of "Every answer you changed" in Time and decisions, for "See every change".
 * `replay` ({ label, ids, onSee }): the groups the Replay has a chip for; each of those rows gets "See it in the
 * replay", which opens the Replay with that chip on (spec 4.5).
 */
export default function MarksLedger({ lab, attemptId, onJump, changesId = null, replay = null }) {
  const uid = useId();
  const [barRef, phase] = useSplit(attemptId);
  const groups = lab?.groups || [];
  const [open, setOpen] = useState(() => new Set(groups.filter((g) => g.open).map((g) => g.id)));
  const [picked, setPicked] = useState(null); // the row the student opened last
  const [preview, setPreview] = useState(null); // the row under the mouse or keyboard focus
  const active = preview ?? picked;

  const toggle = (id) => {
    const opening = !open.has(id);
    setOpen((s) => { const next = new Set(s); if (opening) next.add(id); else next.delete(id); return next; });
    setPicked((p) => (opening ? id : p === id ? null : p));
  };
  // A bar segment: open its row (never close it), lift the segment, and glide to the row. The row's button is the
  // keyboard and screen-reader way to the same place, so the segment itself stays a pointer shortcut.
  const rowRefs = useRef(new Map());
  const [methodOpen, setMethodOpen] = useState(false);
  const goToGroup = (id) => {
    setOpen((s) => (s.has(id) ? s : new Set(s).add(id)));
    setPicked(id);
    requestAnimationFrame(() => glideTo(rowRefs.current.get(id)));
  };

  const seeChanges = useCallback(() => {
    const el = changesId ? document.getElementById(changesId) : null;
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
    el.dataset.arrived = '';
    setTimeout(() => { delete el.dataset.arrived; }, 1600);
  }, [changesId]);

  if (!lab || !groups.length) return null;
  const labels = lab.labels || {};
  const headlineGroup = lab.headline?.group || null;
  // A paper without a clock record (state basic) gets its one line from the Lab (OlderPaper), not the ledger's fine line.
  // A ready paper's `fine` and the cohort's `fine` are method sentences, kept in the contract for older apps: the web
  // shows them only through lab.method.
  const fine = lab.state === 'basic' && !lab.older ? (lab.fine || []).filter(Boolean) : [];
  const method = lab.method?.lines?.length ? lab.method : null;

  return (
    <div className="ml" data-split={phase} data-state={lab.state}>
      {lab.headline?.text ? (
        <p className="ml-headline">
          <span className="ml-sw" data-g={headlineGroup} aria-hidden="true" />
          <span>{withNumbers(lab.headline.text)}</span>
        </p>
      ) : null}

      <div className="ml-bar" ref={barRef} role="img" aria-label={lab.barLabel || undefined}>
        {groups.map((g, i) => (
          <span key={g.id} className="ml-seg" data-g={g.id}
            data-dim={active && active !== g.id ? '' : undefined} data-lift={active === g.id ? '' : undefined}
            onClick={() => goToGroup(g.id)}
            style={{ flexGrow: Math.max(g.marks, 1), '--n': Math.max(g.count, 1), '--d': i }}>
            {g.count > 1 ? <i className="ml-seg__ticks" aria-hidden="true" /> : null}
          </span>
        ))}
      </div>

      <ul className="ml-rows">
        {groups.map((g, i) => {
          const isOpen = open.has(g.id);
          const panelId = `${uid}-${g.id}`;
          return (
            <li key={g.id} className="ml-row" ref={(el) => { if (el) rowRefs.current.set(g.id, el); else rowRefs.current.delete(g.id); }} data-open={isOpen || undefined} data-active={active === g.id || undefined} style={{ '--i': i }}>
              <button type="button" className="ml-row__btn" aria-expanded={isOpen} aria-controls={panelId}
                onClick={() => toggle(g.id)}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setPreview(g.id); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setPreview(null); }}
                onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setPreview(g.id); }}
                onBlur={() => setPreview(null)}>
                <span className="ml-sw" data-g={g.id} aria-hidden="true" />
                <span className="ml-row__label">{g.label}</span>
                <span className="ml-row__line">{withNumbers(g.line)}</span>
                <ChevronDown className="ml-row__chev" size={16} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <div className="ml-row__panel" id={panelId} hidden={!isOpen}>
                {g.doLine ? <p className="ml-do"><span>{g.doLine}</span></p> : null}
                <LabChips numbers={g.numbers} onJump={onJump} showMore={labels.showMore} />
                {replay?.ids?.has(g.id) && replay.label ? (
                  <button type="button" className="ml-textbtn ml-replaylink" onClick={() => replay.onSee(g.id)}>
                    <Play size={14} strokeWidth={2.4} aria-hidden="true" />{replay.label}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {lab.remark?.text ? (
        <div className="ml-remark">
          <p className="ml-remark__text">{withNumbers(lab.remark.text)}</p>
          {lab.remark.scores ? <p className="ml-remark__scores">{withNumbers(lab.remark.scores)}</p> : null}
          {changesId && labels.seeChanges ? <button type="button" className="ml-textbtn" onClick={seeChanges}>{labels.seeChanges}</button> : null}
        </div>
      ) : null}

      {lab.cohort?.line || lab.cohort?.slow ? (
        <div className="ml-cohort">
          <span className="ml-cohort__icon" aria-hidden="true"><Users size={16} strokeWidth={2.2} /></span>
          <div className="ml-cohort__main">
            {lab.cohort.line ? <p>{withNumbers(lab.cohort.line)}{lab.cohort.truth ? <> <span className="ml-truth">{lab.cohort.truth}</span></> : null}</p> : null}
            {lab.cohort.line ? <LabChips numbers={lab.cohort.numbers} onJump={onJump} showMore={labels.showMore} /> : null}
            {/* Slice 5: the questions that took over twice as long as the students who got them right (the nightly table). */}
            {lab.cohort.slow ? <p>{withNumbers(lab.cohort.slow.line)}</p> : null}
            {lab.cohort.slow ? <LabChips numbers={lab.cohort.slow.numbers} onJump={onJump} showMore={labels.showMore} /> : null}
          </div>
        </div>
      ) : null}

      {/* A basic paper's one line on why the split is only wrong and blank stays in flow (an older paper says it itself). */}
      {fine.length ? <p className="ml-fine ml-fine--state">{fine[0]}</p> : null}

      {/* "How this is counted" (WC-01): the method sentences, one 44 px row away, opening in place. */}
      {method ? (
        <div className="ml-method" data-open={methodOpen || undefined}>
          <button type="button" className="ml-method__row" aria-expanded={methodOpen} aria-controls={`${uid}-method`} onClick={() => setMethodOpen((v) => !v)}>
            <span>{method.label}</span>
            <ChevronDown className="ml-method__chev" size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <div className="ml-method__panel" id={`${uid}-method`} inert={!methodOpen || undefined} aria-hidden={!methodOpen || undefined}>
            <div className="ml-method__inner">
              {method.lines.map((line) => <p key={line} className="ml-fine">{line}</p>)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
