"use client";

// "What if my score were ...": a ladder of published DU cutoffs controlled by the visitor.
// Every number is a minimum allocation score printed
// in DU's own round lists (CSAS UG 2026-27). It states a gap to a past cutoff and nothing else:
// no admission chance, no prediction, no conversion of practice marks into a CUET score.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { fitRowEnd, revealTab } from './tabScroll';

const AXIS_MIN = 0;
const AXIS_MAX = 1000;
const pct = (v) => Math.min(100, Math.max(0, ((v - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100));
const ROUND_LABEL = { 'round-1': 'Round I', 'round-2': 'Round II', 'round-3': 'Round III' };
// Once per visit, when the ladder is first 60% in view and nobody has touched it, the score makes one short pass
// (900 down to 760 and back, 1.1 s, eased) so the visitor sees colleges fall short and clear again, then rests on
// 900, a score that clears some of the 2026 Round I rows (780 cleared none, so the resting ladder showed nothing
// working). It never plays again in that visit: leaving the view mid-pass ends it on 900, and the first pointer, key,
// touch or input anywhere in the ladder ends it for good, so the control never moves under the visitor's hand.
const REST = 900;
const SWEEP = [REST, 760, REST];
const SWEEP_MS = 1100;
const sweepAt = (t) => {
  const half = t < 0.5;
  const local = half ? t * 2 : (t - 0.5) * 2;
  const eased = (1 - Math.cos(local * Math.PI)) / 2;
  const [from, to] = half ? [SWEEP[0], SWEEP[1]] : [SWEEP[1], SWEEP[2]];
  return Math.round(from + (to - from) * eased);
};
const fmt = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function CompassLadder({ data }) {
  const rootRef = useRef(null);
  const [programme, setProgramme] = useState(0);
  const [category, setCategory] = useState('UR');
  const [round, setRound] = useState('round-1');
  const [score, setScore] = useState(REST);
  const [sweeping, setSweeping] = useState(true);
  const handRef = useRef(false); // the visitor has touched the ladder
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync(); query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  // The visitor's hand ends the pass for good: native capture listeners on the whole ladder, so a press that lands
  // before React has wired its own handlers, or on a chip or tab, still counts. A score already moved before then
  // is kept.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    const input = node.querySelector('input[type="range"]');
    const early = input ? Number(input.value) : REST;
    if (early !== REST) queueMicrotask(() => { setSweeping(false); setScore(early); });
    const stop = () => { handRef.current = true; setSweeping(false); };
    const types = ['pointerdown', 'touchstart', 'keydown', 'input', 'focusin'];
    for (const type of types) node.addEventListener(type, stop, { capture: true, passive: true });
    return () => { for (const type of types) node.removeEventListener(type, stop, { capture: true }); };
  }, []);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    // The score and its slider are what move, so they are what must be 60% in view (the whole ladder is taller
    // than a phone's window).
    const target = node.querySelector('.cl__score') || node;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio >= 0.6), { threshold: [0, 0.6, 1] });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // The one pass. Leaving the view ends it on its resting score; reduced motion skips it.
  useEffect(() => {
    if (!sweeping || reduced || !inView) return undefined;
    let frame = 0;
    const start = performance.now();
    let shown = null;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / SWEEP_MS);
      const next = sweepAt(t);
      if (next !== shown) { shown = next; setScore(next); }
      if (t < 1) frame = window.requestAnimationFrame(tick);
      else setSweeping(false);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      // Cut short by leaving the view (not by the visitor's hand): rest where the pass would have ended.
      if (shown !== null && !handRef.current) { setScore(SWEEP[SWEEP.length - 1]); setSweeping(false); }
    };
  }, [sweeping, inView, reduced]);

  // The programme row's edge fades, and the chosen name scrolled fully into view (never cut mid-word at an edge).
  const tabsRef = useRef(null);
  const [fade, setFade] = useState('none');
  const readFade = useCallback(() => {
    const row = tabsRef.current;
    if (!row) return;
    const more = row.scrollWidth - row.clientWidth;
    const start = row.scrollLeft > 2;
    const end = more > 2 && row.scrollLeft < more - 2;
    setFade(start && end ? 'both' : start ? 'start' : end ? 'end' : 'none');
  }, []);
  useEffect(() => {
    const row = tabsRef.current;
    if (!row) return undefined;
    const fit = () => { fitRowEnd(row); readFade(); };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    return () => observer.disconnect();
  }, [readFade]);
  useEffect(() => { revealTab(tabsRef.current, programme, { smooth: !reduced }); }, [programme, reduced]);

  const take = (fn) => (...args) => { setSweeping(false); fn(...args); };
  const current = data.programmes[programme];
  const rows = useMemo(() => {
    const listed = current.rows.map((r) => ({ ...r, cutoff: r.cutoffs[round]?.[category] ?? null }));
    return [...listed.filter((r) => r.cutoff !== null).sort((a, b) => b.cutoff - a.cutoff), ...listed.filter((r) => r.cutoff === null)];
  }, [current, round, category]);
  const listed = rows.filter((r) => r.cutoff !== null);
  const cleared = listed.filter((r) => score >= r.cutoff).length;

  return (
    <div className="cl" ref={rootRef}>
      {/* Filters are text tabs with an underline on the chosen one. The programme row runs the ladder's full width on
          desktop (all four names on one line); on a phone it scrolls sideways, fading only at an edge with more
          names beyond it, and the chosen name always scrolls fully into view. Category and round sit under it. */}
      <div className="cl__tabs" role="group" aria-label="Programme" ref={tabsRef} data-fade={fade} onScroll={readFade}>
        {data.programmes.map((p, i) => (
          <button key={p.id} type="button" aria-pressed={programme === i} onClick={take(() => setProgramme(i))}>{p.label}</button>
        ))}
      </div>
      <div className="cl__controls">
        <div className="cl__row">
          <div className="cl__seg" role="group" aria-label="Category">
            {data.categories.map((c) => <button key={c} type="button" aria-pressed={category === c} onClick={take(() => setCategory(c))}>{c}</button>)}
          </div>
          <div className="cl__seg" role="group" aria-label="Round">
            {data.rounds.map((r) => <button key={r} type="button" aria-pressed={round === r} onClick={take(() => setRound(r))}>{ROUND_LABEL[r]}</button>)}
          </div>
        </div>

        <div className="cl__score">
          <label htmlFor="cl-score">If your score were</label>
          <output htmlFor="cl-score" className="cl__big">{Math.round(score)}<span> / 1000</span></output>
          <input id="cl-score" type="range" min={AXIS_MIN} max={AXIS_MAX} step={1} value={score} onPointerDown={() => setSweeping(false)} onKeyDown={() => setSweeping(false)} onChange={(event) => { setSweeping(false); setScore(Number(event.target.value)); }} aria-describedby="cl-score-help" aria-valuetext={`${Math.round(score)} out of 1000`} />
          <small id="cl-score-help">Drag the slider, or use the arrow keys.</small>
          <div className="cl__try" role="group" aria-label="Try a score">
            <span aria-hidden="true">Try</span>
            {[650, 800, 950].map((value) => <button key={value} type="button" aria-pressed={!sweeping && score === value} onClick={take(() => setScore(value))}>{value}</button>)}
          </div>
        </div>

        <p className="cl__summary" aria-live={sweeping ? 'off' : 'polite'}>
          {listed.length ? (
            <><b>{Math.round(score)}</b> clears <b>{cleared} of {listed.length === 1 ? 'the 1' : `these ${listed.length}`}</b> {ROUND_LABEL[round]} {category} {listed.length === 1 ? 'cutoff' : 'cutoffs'} ({data.cycle.replace(' UG ', ' ')}).</>
          ) : (
            <>No {ROUND_LABEL[round]} {category} cutoff was published for these colleges in <b>{data.cycle}</b>. Try another round or category.</>
          )}
        </p>
        <div className="cl__cta">
          <Link href="/cuet-cutoff-calculator" className="mm-btn mm-btn--secondary">Check my subjects</Link>
          <Link href="/admission-compass" className="lp-textlink">Open Compass</Link>
        </div>
      </div>

      <figure className="cl__stage" aria-label={`${current.label} ${ROUND_LABEL[round]} cutoffs for ${category}`}>
        <div className="cl__top"><span>{current.label}</span><span className="cl__src">{data.cycle.replace('CSAS UG', 'DU CSAS')}, {ROUND_LABEL[round]}, {category}</span></div>
        <ul className="cl__list">
          {rows.map((r) => {
            const none = r.cutoff === null;
            const clear = !none && score >= r.cutoff;
            return (
              <li key={r.college} data-state={none ? 'none' : clear ? 'clear' : 'short'}>
                <span className="cl__name" title={r.college}>{r.college}{r.women ? <i> (W)</i> : null}</span>
                <span className="cl__track" aria-hidden="true">
                  <u style={{ transform: `scaleX(${pct(score) / 100})` }} />
                  {none ? null : <b style={{ left: `${pct(r.cutoff)}%` }} />}
                </span>
                <span className="cl__cut">{none ? 'Not listed' : fmt(r.cutoff)}</span>
                <span className="cl__gap">{none ? 'No published cutoff' : score === r.cutoff ? 'At cutoff' : clear ? `Above by ${fmt(score - r.cutoff)}` : `Short by ${fmt(r.cutoff - score)}`}</span>
              </li>
            );
          })}
        </ul>
        <figcaption>Closing scores from DU’s published round lists. (W) marks a women’s college.</figcaption>
      </figure>
    </div>
  );
}
