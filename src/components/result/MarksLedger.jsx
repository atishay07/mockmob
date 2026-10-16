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
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Play, Users } from 'lucide-react';
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
      if (!entry?.isIntersecting) return;
      io.disconnect();
      markSeen(attemptId);
      // Two frames, so the neutral block is painted before it splits.
      raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => setPhase(reducedMotion() ? 'still' : 'split')); });
    }, { threshold: 1, rootMargin: '0px 0px -12% 0px' });
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
  const fine = [...(lab.state === 'basic' && lab.older ? [] : lab.fine || []), ...(lab.cohort?.fine || [])].filter(Boolean);

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
            <li key={g.id} className="ml-row" data-open={isOpen || undefined} data-active={active === g.id || undefined} style={{ '--i': i }}>
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
          {lab.remark.fine ? <p className="ml-fine">{lab.remark.fine}</p> : null}
          {changesId && labels.seeChanges ? <button type="button" className="ml-textbtn" onClick={seeChanges}>{labels.seeChanges}</button> : null}
        </div>
      ) : null}

      {lab.cohort?.line || lab.cohort?.slow ? (
        <div className="ml-cohort">
          <span className="ml-cohort__icon" aria-hidden="true"><Users size={16} strokeWidth={2.2} /></span>
          <div className="ml-cohort__main">
            {lab.cohort.line ? <p>{withNumbers(lab.cohort.line)}</p> : null}
            {lab.cohort.line ? <LabChips numbers={lab.cohort.numbers} onJump={onJump} showMore={labels.showMore} /> : null}
            {/* Slice 5: the questions that took over twice as long as the students who got them right (the nightly table). */}
            {lab.cohort.slow ? <p>{withNumbers(lab.cohort.slow.line)}</p> : null}
            {lab.cohort.slow ? <LabChips numbers={lab.cohort.slow.numbers} onJump={onJump} showMore={labels.showMore} /> : null}
          </div>
        </div>
      ) : null}

      {fine.length ? (
        <div className="ml-fines">
          {fine.map((line) => <p key={line} className="ml-fine">{line}</p>)}
        </div>
      ) : null}
    </div>
  );
}
