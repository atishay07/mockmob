"use client";

// "What if my score were ...": a ladder of published DU cutoffs controlled by the visitor.
// Every number is a minimum allocation score printed
// in DU's own round lists (CSAS UG 2026-27). It states a gap to a past cutoff and nothing else:
// no admission chance, no prediction, no conversion of practice marks into a CUET score.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

const AXIS_MIN = 0;
const AXIS_MAX = 1000;
const pct = (v) => Math.min(100, Math.max(0, ((v - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100));
const ROUND_LABEL = { 'round-1': 'Round I', 'round-2': 'Round II', 'round-3': 'Round III' };
// The first time the ladder comes into view the score makes one pass across the band where the showcased
// cutoffs sit (780 down to 600, up to 960, back to 780), so the visitor sees colleges clear and fall short, and
// then rests. Each leg eases in and out. Touching any control ends it at once.
const SWEEP = [780, 600, 960, 780];
const SWEEP_LEGS = [0.25, 0.5, 0.25];
const SWEEP_MS = 6000;
const sweepAt = (t) => {
  let from = 0;
  for (let i = 0; i < SWEEP_LEGS.length; i += 1) {
    const to = from + SWEEP_LEGS[i];
    if (t <= to || i === SWEEP_LEGS.length - 1) {
      const local = Math.min(1, Math.max(0, (t - from) / SWEEP_LEGS[i]));
      const eased = (1 - Math.cos(local * Math.PI)) / 2;
      return Math.round(SWEEP[i] + (SWEEP[i + 1] - SWEEP[i]) * eased);
    }
    from = to;
  }
  return SWEEP[SWEEP.length - 1];
};
const fmt = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function CompassLadder({ data }) {
  const rootRef = useRef(null);
  const [programme, setProgramme] = useState(0);
  const [category, setCategory] = useState('UR');
  const [round, setRound] = useState('round-1');
  const [score, setScore] = useState(780);
  const [sweeping, setSweeping] = useState(true);
  const elapsedRef = useRef(0);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync(); query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The one pass: time-based, held while the ladder is off screen or the tab is hidden (it continues where it
  // stopped), and over for good once it ends or the visitor takes any control. Reduced motion skips it.
  useEffect(() => {
    if (!sweeping || !inView || reduced) return undefined;
    let frame = 0;
    let last = performance.now();
    let shown = null;
    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!document.hidden) elapsedRef.current += dt;
      const t = Math.min(1, elapsedRef.current / SWEEP_MS);
      const next = sweepAt(t);
      if (next !== shown) { shown = next; setScore(next); }
      if (t < 1) frame = window.requestAnimationFrame(tick);
      else setSweeping(false);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [sweeping, inView, reduced]);

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
      <div className="cl__controls">
        {/* Filters are text tabs with an underline on the chosen one: the programme as a row that scrolls on a
            narrow phone, category and round side by side under it. */}
        <div className="cl__tabs" role="group" aria-label="Programme">
          {data.programmes.map((p, i) => (
            <button key={p.id} type="button" aria-pressed={programme === i} onClick={take(() => setProgramme(i))}>{p.label}</button>
          ))}
        </div>
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
          <Link href="/cuet-cutoff-calculator" className="mm-btn mm-btn--primary">Check my subjects</Link>
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
