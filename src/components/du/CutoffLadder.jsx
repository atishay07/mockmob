"use client";

// "If your score were ...": a ladder of published DU cutoffs controlled by the visitor. It moved here
// from the home page (web IA plan 4.3: the DU blocks leave the landing and live with the calculator).
// Every number is a minimum allocation score printed in DU's own round lists (CSAS UG 2026-27). It
// states a gap to a past cutoff and nothing else: no admission chance, no prediction, no conversion
// of practice marks into a CUET score. Nothing plays by itself: the score changes only when the
// visitor changes it.
import { useMemo, useState } from 'react';
import Link from 'next/link';

const AXIS_MIN = 0;
const AXIS_MAX = 1000;
const pct = (v) => Math.min(100, Math.max(0, ((v - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100));
const ROUND_LABEL = { 'round-1': 'Round I', 'round-2': 'Round II', 'round-3': 'Round III' };
const START_SCORE = 780;
const TRY_SCORES = [650, 800, 950];
const fmt = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function CutoffLadder({ data }) {
  const [programme, setProgramme] = useState(0);
  const [category, setCategory] = useState('UR');
  const [round, setRound] = useState('round-1');
  const [score, setScore] = useState(START_SCORE);

  const current = data.programmes[programme];
  const rows = useMemo(() => {
    const listed = current.rows.map((r) => ({ ...r, cutoff: r.cutoffs[round]?.[category] ?? null }));
    return [...listed.filter((r) => r.cutoff !== null).sort((a, b) => b.cutoff - a.cutoff), ...listed.filter((r) => r.cutoff === null)];
  }, [current, round, category]);
  const listed = rows.filter((r) => r.cutoff !== null);
  const cleared = listed.filter((r) => score >= r.cutoff).length;

  return (
    <div className="du-cl">
      <div className="du-cl__controls">
        <div className="du-cl__group" role="group" aria-label="Programme">
          {data.programmes.map((p, i) => (
            <button key={p.id} type="button" aria-pressed={programme === i} onClick={() => setProgramme(i)}>{p.label}</button>
          ))}
        </div>
        <div className="du-cl__row">
          <div className="du-cl__group du-cl__group--small" role="group" aria-label="Category">
            {data.categories.map((c) => <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
          <div className="du-cl__group du-cl__group--small" role="group" aria-label="Round">
            {data.rounds.map((r) => <button key={r} type="button" aria-pressed={round === r} onClick={() => setRound(r)}>{ROUND_LABEL[r]}</button>)}
          </div>
        </div>

        <div className="du-cl__score">
          <label htmlFor="du-cl-score">If your score were</label>
          <output htmlFor="du-cl-score" className="du-cl__big">{Math.round(score)}<span> / 1000</span></output>
          <input
            id="du-cl-score"
            type="range"
            min={AXIS_MIN}
            max={AXIS_MAX}
            step={1}
            value={score}
            onChange={(event) => setScore(Number(event.target.value))}
            aria-describedby="du-cl-score-help"
            aria-valuetext={`${Math.round(score)} out of 1000`}
          />
          <small id="du-cl-score-help">Drag or use the arrow keys. This is a what-if, not your result.</small>
          <div className="du-cl__try">
            <div className="du-cl__group du-cl__group--small" role="group" aria-label="Try a score">
              {TRY_SCORES.map((value) => <button key={value} type="button" aria-pressed={score === value} onClick={() => setScore(value)}>{value}</button>)}
            </div>
          </div>
        </div>

        <p className="du-cl__summary" aria-live="polite">
          {listed.length ? (
            <>At <b>{Math.round(score)}</b> you are at or above the {ROUND_LABEL[round]} {category} cutoff in <b>{cleared} of {listed.length}</b> colleges below, published for <b>{data.cycle}</b>.</>
          ) : (
            <>No {ROUND_LABEL[round]} {category} cutoff was published for these colleges in <b>{data.cycle}</b>. Try another round or category.</>
          )}
        </p>
        <p className="du-cl__cta">
          <Link href="#du-tool-start" className="mm-btn mm-btn--secondary">Check my own subjects</Link>
        </p>
      </div>

      <figure className="du-cl__stage" aria-label={`${current.label} ${ROUND_LABEL[round]} cutoffs for ${category}`}>
        <div className="du-cl__top"><span>{current.label}</span><span className="du-cl__tag">{data.cycle}, {ROUND_LABEL[round]}, {category}</span></div>
        <ul className="du-cl__list">
          {rows.map((r) => {
            const none = r.cutoff === null;
            const clear = !none && score >= r.cutoff;
            return (
              <li key={r.college} data-state={none ? 'none' : clear ? 'clear' : 'short'}>
                <span className="du-cl__name" title={r.college}>{r.college}{r.women ? <i> (W)</i> : null}</span>
                <span className="du-cl__track" aria-hidden="true">
                  <u style={{ transform: `scaleX(${pct(score) / 100})` }} />
                  {none ? null : <b style={{ left: `${pct(r.cutoff)}%` }} />}
                </span>
                <span className="du-cl__cut">{none ? 'Not listed' : fmt(r.cutoff)}</span>
                <span className="du-cl__gap">{none ? 'No published cutoff' : score === r.cutoff ? 'At cutoff' : clear ? `Above by ${fmt(score - r.cutoff)}` : `Short by ${fmt(r.cutoff - score)}`}</span>
              </li>
            );
          })}
        </ul>
        <figcaption>Minimum allocation scores from DU’s published round lists. Cutoffs change every year with seats and demand, so this is history, not a prediction. (W) marks a women’s college.</figcaption>
      </figure>
    </div>
  );
}
