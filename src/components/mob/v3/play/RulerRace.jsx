"use client";
// The race view (spec 0.3 call 1, 5.3 R1, 5.6 M4, M6, M6b): the paper ruler on a lamp-lit desk with full-body
// Folds walking it question by question. Ghosts (recorded runs) are at 55% with a dashed shadow. Two Folds on one
// number stand in depth. A step glides 300 ms with a 6 px hop; a Fold at the flag raises a pennant in its colour.
// It never shows a pick, a mark or anyone's right or wrong: only where everyone is.
// A timed race (D167) has no flag: the strip grows in fives with the leader and labels 1, every fifth and yours.
// A Fold steps only when it moves on this screen: a resumed run or a reconnect draws everyone where they stand,
// without replaying a step for each (the live client's leftover, 20 Oct).
import { useEffect, useRef } from 'react';
import { PlayFold } from './PlayFold';
import { COPY, racerLabel } from './playModel.mjs';
import { raceLabelled } from './formats.mjs';

const RULER_FROM = 5;
const RULER_SPAN = 80;
const FLAG_AT = 92;

export function RulerRace({ count, racers, answered = 0, youPose = 'idle', youNod = 0, race = false }) {
  const compact = racers.length >= 5;
  // Where each racer stood at the last paint: a step plays only when that changes after the first paint.
  const seen = useRef(null);
  const placeOf = (r) => `${r.at}-${r.finished}`;
  const stepping = (r) => Boolean(seen.current) && seen.current.has(r.id) && seen.current.get(r.id) !== placeOf(r);
  useEffect(() => { seen.current = new Map(racers.map((r) => [r.id, `${r.at}-${r.finished}`])); });
  const span = race ? RULER_SPAN + 8 : RULER_SPAN;
  const xOf = (i) => RULER_FROM + (i - 0.5) * (span / count);
  const size = compact ? 48 : 64;
  const flagged = racers.filter((r) => r.finished);
  const sorted = [...racers].sort((a, b) => b.depth - a.depth || (a.you ? 1 : b.you ? -1 : 0));
  return (
    <figure className="mp-ruler" aria-label={COPY.rulerLabel}>
      <div className="mp-ruler__desk" aria-hidden="true">
        <span className="mp-ruler__lamp" />
        {race ? null : (
          <span className="mp-ruler__pole" style={{ left: `${FLAG_AT}%` }}>
            <span className="mp-ruler__flag" />
            {flagged.map((r, i) => (
              <span key={r.id} className="mp-ruler__pennant" style={{ '--mp-c': `var(--mob-c${Number(r.colour) % 8 || 0})`, '--i': i }} />
            ))}
          </span>
        )}
        <div className={`mp-ruler__strip${race ? ' mp-ruler__strip--race' : ''}`}>
          {Array.from({ length: count }, (_, k) => k + 1).map((n) => (race && !raceLabelled(n, count, answered + 1)
            ? <span key={n} className={`mp-ruler__dot${n <= answered ? ' is-done' : ''}`} style={{ left: `${xOf(n)}%` }} />
            : <span key={n} className={`mp-ruler__num${n <= answered ? ' is-done' : ''}${n === answered + 1 ? ' is-here' : ''}`} style={{ left: `${xOf(n)}%` }}>{n}</span>))}
          {Array.from({ length: count * (race ? 1 : 4) + 1 }, (_, k) => k).map((k) => (
            <span key={`t${k}`} className={`mp-ruler__tick${race || k % 4 === 0 ? ' is-major' : ''}`} style={{ left: `${RULER_FROM - span / count / 2 + (k * span) / (count * (race ? 1 : 4))}%` }} />
          ))}
        </div>
      </div>
      <ul className="mp-ruler__racers">
        {sorted.map((r) => {
          const x = r.finished && !race ? FLAG_AT - 3 : xOf(r.at);
          return (
            <li
              key={r.id}
              className={`mp-racer${r.ghost ? ' is-ghost' : ''}${r.you ? ' is-you' : ''}`}
              style={{ left: `calc(${x}% + ${r.aside || 0}px)`, zIndex: 10 - r.depth, '--lift': `${r.lift || 0}px`, '--tag': `${(r.depth || 0) * -14}px`, '--scale': r.scale ?? 1, '--bright': r.brightness ?? 1, '--mp-c': `var(--mob-c${Number(r.colour) % 8 || 0})` }}
              aria-label={r.finished ? COPY.rulerDone(r.name) : COPY.rulerAt(r.name, r.at, count)}
            >
              <span className={`mp-racer__body${stepping(r) ? '' : ' is-still'}`} key={placeOf(r)}>
                <span className={`mp-racer__name${compact ? ' is-compact' : ''}`}>{racerLabel(r.name, compact)}</span>
                <span className="mp-racer__shadow" />
                <span className={`mp-racer__fold${r.you && youNod ? ` is-nod-${youNod % 2}` : ''}`}>
                  <PlayFold fold={r.fold} pose={r.you ? youPose : 'idle'} size={size} name={r.name} colour={r.colour} ghost={r.ghost} />
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
