"use client";

// "What if my score were ...": a ladder of published DU cutoffs controlled by the visitor.
// Every number is a minimum allocation score printed
// in DU's own round lists (CSAS UG 2026-27). It states a gap to a past cutoff and nothing else:
// no admission chance, no prediction, no conversion of practice marks into a CUET score.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, Pause } from 'lucide-react';

const AXIS_MIN = 0;
const AXIS_MAX = 1000;
const pct = (v) => Math.min(100, Math.max(0, ((v - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100));
const ROUND_LABEL = { 'round-1': 'Round I', 'round-2': 'Round II', 'round-3': 'Round III' };
// The tour eases back and forth across this band, where the showcased cutoffs sit.
const SWEEP_LOW = 600;
const SWEEP_HIGH = 960;
const SWEEP_PERIOD_MS = 11000;
const fmt = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function CompassLadder({ data }) {
  const rootRef = useRef(null);
  const [programme, setProgramme] = useState(0);
  const [category, setCategory] = useState('UR');
  const [round, setRound] = useState('round-1');
  const [score, setScore] = useState(780);
  const [sweeping, setSweeping] = useState(true);
  const phaseRef = useRef(0);
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

  // Plays by itself: an eased, time-based sweep (cosine ping-pong, so it slows at each end
  // instead of bouncing). It idles while offscreen or in a background tab, and stops only when
  // the visitor takes the score themselves. Filters can change while it plays.
  useEffect(() => {
    if (!sweeping || !inView || reduced) return undefined;
    let frame = 0;
    let last = performance.now();
    let shown = null;
    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!document.hidden) {
        phaseRef.current = (phaseRef.current + dt / SWEEP_PERIOD_MS) % 1;
        const eased = (1 - Math.cos(phaseRef.current * 2 * Math.PI)) / 2;
        const next = Math.round(SWEEP_LOW + (SWEEP_HIGH - SWEEP_LOW) * eased);
        if (next !== shown) { shown = next; setScore(next); }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [sweeping, inView, reduced]);

  // Resuming continues from the visitor's last score rather than jumping back to the start.
  const resume = () => {
    const x = Math.min(1, Math.max(0, (score - SWEEP_LOW) / (SWEEP_HIGH - SWEEP_LOW)));
    phaseRef.current = Math.acos(1 - 2 * x) / (2 * Math.PI);
    setSweeping(true);
  };
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
        <div className="cl__group" role="group" aria-label="Programme">
          {data.programmes.map((p, i) => (
            <button key={p.id} type="button" aria-pressed={programme === i} onClick={() => setProgramme(i)}>{p.label}</button>
          ))}
        </div>
        <div className="cl__row">
          <div className="cl__group cl__group--small" role="group" aria-label="Category">
            {data.categories.map((c) => <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
          <div className="cl__group cl__group--small" role="group" aria-label="Round">
            {data.rounds.map((r) => <button key={r} type="button" aria-pressed={round === r} onClick={() => setRound(r)}>{ROUND_LABEL[r]}</button>)}
          </div>
        </div>

        <div className="cl__score">
          <label htmlFor="cl-score">If your score were</label>
          <output htmlFor="cl-score" className="cl__big">{Math.round(score)}<span> / 1000</span></output>
          <input id="cl-score" type="range" min={AXIS_MIN} max={AXIS_MAX} step={1} value={score} onPointerDown={() => setSweeping(false)} onKeyDown={() => setSweeping(false)} onChange={(event) => { setSweeping(false); setScore(Number(event.target.value)); }} aria-describedby="cl-score-help" aria-valuetext={`${Math.round(score)} out of 1000`} />
          <small id="cl-score-help">Drag or use arrow keys. This is a what-if, not your result.</small>
          <div className="cl__try">
            <div className="cl__group cl__group--small" role="group" aria-label="Try a score">
              {[650, 800, 950].map((value) => <button key={value} type="button" aria-pressed={score === value} onClick={take(() => setScore(value))}>{value}</button>)}
            </div>
            {!reduced ? <button className="cl__demo" type="button" onClick={() => (sweeping ? setSweeping(false) : resume())}>{sweeping ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}{sweeping ? 'Pause' : 'Play'}<span className="lp-sr"> the score tour</span></button> : null}
          </div>
        </div>

        <p className="cl__summary" aria-live={sweeping ? 'off' : 'polite'}>
          {listed.length ? (
            <>At <b>{Math.round(score)}</b> you are at or above the {ROUND_LABEL[round]} {category} cutoff in <b>{cleared} of {listed.length}</b> colleges below, published for <b>{data.cycle}</b>.</>
          ) : (
            <>No {ROUND_LABEL[round]} {category} cutoff was published for these colleges in <b>{data.cycle}</b>. Try another round or category.</>
          )}
        </p>
        <div className="cl__cta">
          <Link href="/cuet-cutoff-calculator" className="mm-btn mm-btn--primary">Check my subjects<ArrowRight size={17} aria-hidden="true" /></Link>
          <Link href="/admission-compass" className="lp-link">Open Compass<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>

      <figure className="cl__stage" aria-label={`${current.label} ${ROUND_LABEL[round]} cutoffs for ${category}`}>
        <div className="cl__top"><span>{current.label}</span><span className="cl__tag">{data.cycle} · {ROUND_LABEL[round]} · {category}</span></div>
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
        <figcaption>Minimum allocation scores from DU’s published round lists. Cutoffs change every year with seats and demand, so this is history, not a prediction. (W) marks a women’s college.</figcaption>
      </figure>
    </div>
  );
}
