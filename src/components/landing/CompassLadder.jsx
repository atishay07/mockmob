"use client";

// "What if my score were ...": a ladder of published DU cutoffs controlled by the visitor (R19, 18 Nov 2026: one card, the
// answer "n of m cleared" under the score, the colleges as a two-state list with pen ticks).
// Every number is a minimum allocation score printed
// in DU's own round lists (CSAS UG 2026-27). It states a gap to a past cutoff and nothing else:
// no admission chance, no prediction, no conversion of practice marks into a CUET score.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Doodle from '@/components/doodle/Doodle';
import { Play, Pause } from 'lucide-react';

const AXIS_MIN = 0;
const AXIS_MAX = 1000;
const pct = (v) => Math.min(100, Math.max(0, ((v - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100));
const ROUND_LABEL = { 'round-1': 'Round 1', 'round-2': 'Round 2', 'round-3': 'Round 3' };
// The tour eases back and forth across this band, where the showcased cutoffs sit.
const SWEEP_LOW = 600;
const SWEEP_HIGH = 960;
const SWEEP_PERIOD_MS = 11000;
// One formatter, kept: the ladder formats every row on each step of the sweep.
const ONE_DECIMAL = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt = (n) => ONE_DECIMAL.format(n);

const INITIAL_SCORE = 780;

export default function CompassLadder({ data }) {
  const rootRef = useRef(null);
  const [programme, setProgramme] = useState(0);
  const [category, setCategory] = useState('UR');
  const [round, setRound] = useState('round-1');
  const [score, setScore] = useState(INITIAL_SCORE);
  const [sweeping, setSweeping] = useState(true);
  const phaseRef = useRef(Math.acos(1 - 2 * (INITIAL_SCORE - SWEEP_LOW) / (SWEEP_HIGH - SWEEP_LOW)) / (2 * Math.PI));
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      const calm = query.matches || document.documentElement.dataset.motion === 'reduced';
      setReduced(calm);
      if (calm) setSweeping(false);
    };
    sync();
    query.addEventListener('change', sync);
    window.addEventListener('mm-prefs', sync);
    return () => { query.removeEventListener('change', sync); window.removeEventListener('mm-prefs', sync); };
  }, []);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setSweeping(false); return undefined; }
    let entered = false;
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.22;
      setInView(visible);
      if (visible) entered = true;
      else if (entered) setSweeping(false);
    }, { threshold: [0, 0.22] });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Plays by itself: an eased, time-based sweep (cosine ping-pong, so it slows at each end instead of bouncing).
  // Owner LK322 (18 Nov 2026): "it should autoplay ... and after [scrolling] out or playing for ten second or fifteen ... then
  // it can pause". So it plays on every screen (touch too; the 16 Nov rest-on-touch rule is replaced), once through: one whole
  // sweep (11 seconds), ending on the score it began with, where some colleges clear and others do not. It also stops the
  // moment the card leaves the screen, the tab is hidden or the visitor takes the score; Play starts it again. Filters can
  // change while it plays.
  useEffect(() => {
    if (!sweeping || !inView || reduced) return undefined;
    let frame = 0;
    const stop = window.setTimeout(() => setSweeping(false), SWEEP_PERIOD_MS + 80);
    const hide = () => { if (document.hidden) setSweeping(false); };
    document.addEventListener('visibilitychange', hide);
    let last = performance.now();
    let shown = null;
    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!document.hidden) {
        phaseRef.current = (phaseRef.current + dt / SWEEP_PERIOD_MS) % 1;
        const eased = (1 - Math.cos(phaseRef.current * 2 * Math.PI)) / 2;
        // Steps of 5 points (round 13, audit F10): the ladder re-rendered on nearly every frame; the bars ease between steps.
        const next = Math.round((SWEEP_LOW + (SWEEP_HIGH - SWEEP_LOW) * eased) / 5) * 5;
        if (next !== shown) { shown = next; setScore(next); }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.clearTimeout(stop);
      window.cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', hide);
    };
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
      {/* R19 (18 Nov 2026): one card that answers "which colleges would this score have cleared?" as the score moves. The
          picks on top (the course as one row that scrolls sideways, then category and round as two segmented controls on one
          line), the score as the card's largest figure with its slider, the answer under it, then the colleges as a two-state
          list: a cleared college carries a pen tick, drawn as it flips to cleared and gone at once when it flips back; the
          rest say how far short they are. */}
      <div className="cl__card">
        <div className="cl__controls">
          <div className="cl__group cl__courses" role="group" aria-label="Course">
            {data.programmes.map((p, i) => (
              <button key={p.id} type="button" aria-pressed={programme === i} onClick={() => setProgramme(i)}>{p.label}</button>
            ))}
          </div>
          <div className="cl__row">
            <div className="cl__pick">
              <span className="cl__pick-label" aria-hidden="true">Category</span>
              <div className="cl__seg" role="group" aria-label="Category">
                {data.categories.map((c) => <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
              </div>
            </div>
            <div className="cl__pick">
              <span className="cl__pick-label" aria-hidden="true">Round</span>
              <div className="cl__seg" role="group" aria-label="Round">
                {data.rounds.map((r) => <button key={r} type="button" aria-pressed={round === r} aria-label={ROUND_LABEL[r]} onClick={() => setRound(r)}>{ROUND_LABEL[r].replace('Round ', '')}</button>)}
              </div>
            </div>
          </div>
        </div>

        {/* --p, how far along the track the score sits (the track's fill reads it, r10-tools.css), is set on the group and
            inherited by the slider: an inline style on the input itself is rewritten by a screenshot tool that touches
            inputs before the page hydrates, and React then reports a hydration mismatch for it (10 Nov 2026). */}
        <div className="cl__score" style={{ '--p': `${pct(score)}%` }}>
          <div className="cl__score-top">
            <label htmlFor="cl-score">If your score were</label>
            {!reduced ? <button className="cl__demo" type="button" onClick={() => (sweeping ? setSweeping(false) : resume())}>{sweeping ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}{sweeping ? 'Pause' : 'Play'}<span className="lp-sr"> the score tour</span></button> : null}
          </div>
          <div className="cl__score-row">
            <output htmlFor="cl-score" className="cl__big">{String(Math.round(score))}<span className="cl__denominator"> / 1000</span></output>
            <div className="cl__group cl__group--small cl__presets" role="group" aria-label="Try a score">
              {[650, 800, 950].map((value) => <button key={value} type="button" aria-pressed={score === value} onClick={take(() => setScore(value))}>{value}</button>)}
            </div>
          </div>
          <input id="cl-score" type="range" data-cursor="Drag" min={AXIS_MIN} max={AXIS_MAX} step={1} value={score} onPointerDown={() => setSweeping(false)} onKeyDown={() => setSweeping(false)} onChange={(event) => { setSweeping(false); setScore(Number(event.target.value)); }} aria-describedby="cl-score-help" aria-valuetext={`${Math.round(score)} out of 1000`} />
          <small id="cl-score-help">Drag the slider, or use the arrow keys.</small>
        </div>

        <figure className="cl__stage" aria-label={`${current.label} ${ROUND_LABEL[round]} cutoffs for ${category}`}>
          <p className="cl__answer" aria-live={sweeping ? 'off' : 'polite'}>
            {listed.length ? (
              <><b><Doodle mark="highlight" when={!sweeping} inkKey={!sweeping ? cleared : null}>{`${cleared} of ${listed.length}`}</Doodle></b> cleared</>
            ) : (
              <span className="cl__none">No {ROUND_LABEL[round]} {category} cutoff was published for these colleges in <b>{data.cycle}</b>. Try another round or category.</span>
            )}
          </p>
          <p className="cl__top"><span>{current.label}</span> <span className="cl__tag">{data.cycle}, {ROUND_LABEL[round]}, {category}</span></p>
          <ul className="cl__list">
            {rows.map((r) => {
              const none = r.cutoff === null;
              const clear = !none && score >= r.cutoff;
              return (
                <li key={r.college} data-state={none ? 'none' : clear ? 'clear' : 'short'}>
                  <span className="cl__mark" aria-hidden="true">{none ? null : <Doodle mark="tick" tone="brand" when={clear} className="cl__tick" />}</span>
                  <span className="cl__name">{r.college}{r.women ? <i> (W)</i> : null}</span>
                  <span className="cl__gap">{none ? 'Not listed' : clear ? <>{score === r.cutoff ? 'At cutoff' : fmt(r.cutoff)}<span className="lp-sr">, cutoff cleared</span></> : `Short by ${fmt(r.cutoff - score)}`}</span>
                  <span className="cl__track" aria-hidden="true">
                    <u style={{ transform: `scaleX(${pct(score) / 100})` }} />
                    {none ? null : <b style={{ left: `${pct(r.cutoff)}%` }} />}
                  </span>
                </li>
              );
            })}
          </ul>
          <figcaption>Closing scores from DU’s published round lists. (W) marks a women’s college.</figcaption>
        </figure>
      </div>
      <div className="cl__cta">
        <Link href="/cuet-cutoff-calculator" className="mm-btn mm-btn--primary">Check my subjects</Link>
        <Link href="/admission-compass" className="lp-link">Open Compass</Link>
      </div>
    </div>
  );
}
