"use client";
// The race view (spec 0.3 call 1, 5.3 R1, 5.6 M4, M6, M6b): the paper ruler on a lamp-lit desk with full-body
// Folds walking it question by question. Ghosts (recorded runs) are at 55% with a dashed shadow. Two Folds on one
// number stand in depth. A step glides 300 ms with a 6 px hop; a Fold at the flag raises a pennant in its colour.
// It never shows a pick, a mark or anyone's right or wrong: only where everyone is.
import { PlayFold } from './PlayFold';
import { COPY, racerLabel } from './playModel.mjs';

const RULER_FROM = 5;
const RULER_SPAN = 80;
const FLAG_AT = 92;
const numberX = (i, count) => RULER_FROM + (i - 0.5) * (RULER_SPAN / count);

export function RulerRace({ count, racers, answered = 0, youPose = 'idle', youNod = 0 }) {
  const compact = racers.length >= 5;
  const size = compact ? 48 : 64;
  const flagged = racers.filter((r) => r.finished);
  const sorted = [...racers].sort((a, b) => b.depth - a.depth || (a.you ? 1 : b.you ? -1 : 0));
  return (
    <figure className="mp-ruler" aria-label={COPY.rulerLabel}>
      <div className="mp-ruler__desk" aria-hidden="true">
        <span className="mp-ruler__lamp" />
        <span className="mp-ruler__pole" style={{ left: `${FLAG_AT}%` }}>
          <span className="mp-ruler__flag" />
          {flagged.map((r, i) => (
            <span key={r.id} className="mp-ruler__pennant" style={{ '--mp-c': `var(--mob-c${Number(r.colour) % 8 || 0})`, '--i': i }} />
          ))}
        </span>
        <div className="mp-ruler__strip">
          {Array.from({ length: count }, (_, k) => k + 1).map((n) => (
            <span key={n} className={`mp-ruler__num${n <= answered ? ' is-done' : ''}${n === answered + 1 ? ' is-here' : ''}`} style={{ left: `${numberX(n, count)}%` }}>{n}</span>
          ))}
          {Array.from({ length: count * 4 + 1 }, (_, k) => k).map((k) => (
            <span key={`t${k}`} className={`mp-ruler__tick${k % 4 === 0 ? ' is-major' : ''}`} style={{ left: `${RULER_FROM - RULER_SPAN / count / 2 + (k * RULER_SPAN) / (count * 4)}%` }} />
          ))}
        </div>
      </div>
      <ul className="mp-ruler__racers">
        {sorted.map((r) => {
          const x = r.finished ? FLAG_AT - 3 : numberX(r.at, count);
          return (
            <li
              key={r.id}
              className={`mp-racer${r.ghost ? ' is-ghost' : ''}${r.you ? ' is-you' : ''}`}
              style={{ left: `calc(${x}% + ${r.aside || 0}px)`, zIndex: 10 - r.depth, '--lift': `${r.lift || 0}px`, '--tag': `${(r.depth || 0) * -14}px`, '--scale': r.scale ?? 1, '--bright': r.brightness ?? 1, '--mp-c': `var(--mob-c${Number(r.colour) % 8 || 0})` }}
              aria-label={r.finished ? COPY.rulerDone(r.name) : COPY.rulerAt(r.name, r.at, count)}
            >
              <span className="mp-racer__body" key={`${r.at}-${r.finished}`}>
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
