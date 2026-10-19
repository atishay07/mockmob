"use client";
// L2 / M3, the countdown (spec 5.3 L2, 5.6 M3; Arena's stopwatch with Live's stamped paper numerals).
// Beats at 600 ms on the server clock so that Go lands on the room's startsAt for everyone. Each numeral is its own
// layer above the stopwatch art and the next starts only after the previous one is gone (no overlap). The stopwatch
// tilts 1.5 degrees per beat, the volt arc fills a third per beat, the heads bob 3 px, the scrim deepens. Go is a volt
// paper tile with one ring and four glints; 600 ms later the stage leaves and the first question rises.
// Reduced motion: the numerals cross-fade in place in 120 ms; the beats and the timing stay.
import { useEffect, useRef, useState } from 'react';
import { FoldHead } from '../play/PlayFold';
import { BEAT_MS, LIVE_COPY, countdownAt } from './liveModel.mjs';

const ARC_R = 41;
const ARC_LEN = 2 * Math.PI * ARC_R;

export function LiveCountdown({ startsAt, serverNow, heads, count, onOver }) {
  const [at, setAt] = useState(() => countdownAt(startsAt, serverNow()));
  const done = useRef(false);
  const over = useRef(onOver);
  useEffect(() => { over.current = onOver; }, [onOver]);

  useEffect(() => {
    let raf = 0;
    let last = null;
    const tick = () => {
      const next = countdownAt(startsAt, serverNow());
      if (next.stage !== last) {
        last = next.stage;
        setAt(next);
      }
      if (next.stage === 'over') {
        if (!done.current) { done.current = true; over.current?.(); }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startsAt, serverNow]);

  const stage = at.stage;
  const beat = stage === 'wait' ? 0 : stage === 'go' || stage === 'over' ? 3 : 4 - stage; // 1, 2, 3 beats filled
  const filled = Math.min(3, beat);
  const label = LIVE_COPY.countdownLabel(stage);
  const counting = stage !== 'wait';
  return (
    <div className={`lv-count is-${String(stage)}`} role="dialog" aria-modal="true" aria-labelledby="lv-count-n" style={{ '--beat': `${BEAT_MS}ms` }}>
      <div className="lv-count__scrim" aria-hidden="true" style={{ '--depth': counting ? Math.min(1, (filled + 1) / 4) : 0.2 }} />
      <ul className="lv-count__heads" aria-label={LIVE_COPY.inRoom(heads.length)}>
        {heads.map((h, i) => (
          <li key={h.memberId} className="lv-count__head" style={{ '--i': i }} data-bob={counting ? String(stage) : undefined}>
            <span className="lv-count__disc" style={{ '--mp-c': `var(--mob-c${Number(h.colour) % 8 || 0})` }}><FoldHead fold={h.fold} name={h.name} colour={h.colour} size={52} /></span>
            <span className="lv-count__name">{h.name}</span>
          </li>
        ))}
      </ul>
      <div className="lv-count__stage">
        <div className="lv-count__watch" data-tilt={filled % 2 ? 'r' : 'l'} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/art/hybrid-stopwatch.webp" alt="" width="596" height="768" decoding="async" draggable="false" />
          <svg className="lv-count__arc" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={ARC_R} className="lv-count__arc-track" />
            <circle cx="50" cy="50" r={ARC_R} className="lv-count__arc-fill" style={{ strokeDasharray: ARC_LEN, strokeDashoffset: ARC_LEN * (1 - filled / 3) }} />
          </svg>
        </div>
        <div className="lv-count__numeral" aria-live="assertive">
          {counting ? (
            <span key={String(stage)} id="lv-count-n" className={`lv-tile${stage === 'go' || stage === 'over' ? ' lv-tile--go' : ''}`}>
              <span className="lv-tile__n">{stage === 'over' ? LIVE_COPY.go : label}</span>
              {stage === 'go' ? (
                <>
                  <span className="lv-tile__ring" aria-hidden="true" />
                  {[0, 1, 2, 3].map((g) => <span key={g} className="lv-tile__glint" style={{ '--g': g }} aria-hidden="true" />)}
                </>
              ) : null}
            </span>
          ) : <span id="lv-count-n" className="mp-sr">{LIVE_COPY.getSet}</span>}
        </div>
      </div>
      <p className="lv-count__line">{LIVE_COPY.countdownLine(count)}</p>
    </div>
  );
}
