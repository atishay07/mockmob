"use client";
// Your full analysis, pass 1018 (docs/design-decisions/pass-1018/REVIEW-RESULT-1018.md 5.2 to 5.4, packet P-RR2; owner
// D16: "As soon as someone wants to go deep into something, there will be a lot of clutter").
//
// One index of six named parts, each stating what it found with a number, and exactly one part open: below the index on a
// phone (its heading sticks under the top bar with "All six parts", and it ends with "Next: {part}"), beside it from 1024 px
// (the index is sticky on the left). Every part's content stays mounted and is only hidden, so a repair being written or
// an opened answer keeps its state when the student looks at another part. The open part lives in the URL (?part=time),
// so Back returns to it and a link can open a part. The open row is a neutral lit fill with a 3 px ink bar: never lime.
// Motion: the old part fades out (120 ms) and the new one rises 8 px while fading in (200 ms); scale 0.98 on rows.
import { useRef } from 'react';
import './result-parts.css';

const reduced = () => { try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };
const wide = () => { try { return window.matchMedia('(min-width: 1024px)').matches; } catch { return false; } };

export const PART_IDS = Object.freeze(['marks', 'mistakes', 'time', 'rule', 'after', 'answers']);

/** The part named in the URL, or the default (Where your marks went). */
export function partFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search).get('part');
    return PART_IDS.includes(p) ? p : 'marks';
  } catch { return 'marks'; }
}
export function writePart(id) {
  try {
    const p = new URLSearchParams(window.location.search);
    if (id === 'marks') p.delete('part'); else p.set('part', id);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${p.size ? `?${p}` : ''}`);
  } catch { /* the URL is a convenience only */ }
}

/** Bring the open part's heading under the top bar (phones), or the detail's top into view (desktop). */
export function scrollToPart(id) {
  requestAnimationFrame(() => {
    const el = document.getElementById(`ap-h-${id}`);
    if (!el) return;
    if (wide()) {
      const box = document.getElementById('ap-detail')?.getBoundingClientRect();
      if (box && box.top >= 0 && box.top < window.innerHeight * 0.5) return;
    }
    el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  });
}

/**
 * parts: [{ id, name, line, figure, body }] in index order. `open` is the open part's id; `onOpen(id)` opens one.
 */
export default function AnalysisParts({ parts, open, onOpen }) {
  const indexRef = useRef(null);
  const at = Math.max(0, parts.findIndex((p) => p.id === open));
  const next = parts[at + 1] || null;
  const choose = (id) => { onOpen(id); scrollToPart(id); };
  // Arrow keys move along the index (a list of buttons; Home and End jump).
  const onKey = (event) => {
    const keys = { ArrowDown: 1, ArrowUp: -1 };
    if (!(event.key in keys) && event.key !== 'Home' && event.key !== 'End') return;
    const buttons = [...(indexRef.current?.querySelectorAll('button.ap-row') || [])];
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    event.preventDefault();
    const to = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.min(buttons.length - 1, Math.max(0, i + keys[event.key]));
    buttons[to]?.focus();
  };
  return (
    <section className="ap" aria-labelledby="ap-title">
      <h2 id="ap-title" className="ap-title">Your full analysis</h2>
      <p className="ap-lede">Six parts, each with what it found. One opens at a time.</p>
      <div className="ap-grid">
        <ol className="ap-index" ref={indexRef} onKeyDown={onKey} aria-label="The six parts">
          {parts.map((p) => (
            <li key={p.id} data-open={p.id === open || undefined}>
              <button type="button" className="ap-row mk-press" aria-current={p.id === open ? 'true' : undefined} aria-controls={`ap-part-${p.id}`} onClick={() => choose(p.id)}>
                <b>{p.name}</b>
                <span>{p.line}</span>
                {p.figure ? <em>{p.figure}</em> : null}
                <svg className="ap-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            </li>
          ))}
        </ol>
        <div className="ap-detail" id="ap-detail">
          {parts.map((p, i) => (
            <section key={p.id} id={`ap-part-${p.id}`} className="ap-part" hidden={p.id !== open} aria-labelledby={`ap-h-${p.id}`} data-part={p.id}>
              <div className="ap-dhead">
                <h3 id={`ap-h-${p.id}`}>{p.name}</h3>
                <button type="button" className="ap-all" onClick={() => indexRef.current?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })}>All six parts</button>
              </div>
              <div className="ap-body">{p.body}</div>
              {i === at && next ? (
                <button type="button" className="ap-next mk-press" onClick={() => choose(next.id)}>
                  <span>Next: <b>{next.name}</b></span>
                  <svg className="ap-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
