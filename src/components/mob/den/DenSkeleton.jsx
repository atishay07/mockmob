"use client";
// D6 on the web: the den while it loads, and when it failed (MOB-BUILD-SPEC-V3 5.3 D6).
// Loading: the room with its lamp at its real size, paper blocks for the name, the chain chip and the pennant, no Folds,
// then blocks the size of what sat under the room last time on this device (the card, the quest strip), pulsing 1.0 to
// 0.6 on the 1200 ms sweep (still under reduced motion). The den replaces it in place: nothing below moves, and the room
// does not rise again (DenStage `warm`). Failed: the same room, still, with "Your Mob didn't load." and "Try again".
// The sizes come from this device's last den (denShape.js); the root layout's first script puts them on <html> before
// the first paint, so even a server-drawn skeleton has them: the Mob switcher row (data-den-switch) and the blocks.
import { skeletonBlocks } from '@/lib/mob/v3/denSkeleton.mjs';
import { DenCopy } from '@/lib/mob/v3/denCopy.mjs';
import { DenStage } from './DenStage';
import './den.css';

function SwitcherBlocks() {
  return (
    <div className="mob-switch den-skel-switch" aria-hidden="true">
      <span className="den-skel den-skel--tab" />
      <span className="den-skel den-skel--tab den-skel--tab-wide" />
    </div>
  );
}

/** shape: readDenShape(); width: the window's width (for the band); failed: { message, onRetry } or null. */
export default function DenSkeleton({ shape, width, failed = null }) {
  const blocks = skeletonBlocks(shape, width);
  if (shape?.kind === 'start' && !failed) {
    return (
      <div className="den den--start den--skeleton" aria-hidden="true">
        <DenStage skeleton />
        <span className="den-skel den-skel--lead" />
        <span className="den-skel den-skel--keys" />
      </div>
    );
  }
  return (
    <>
      {!failed ? <SwitcherBlocks /> : null}
      <div className={`den den--skeleton${failed ? ' den--failed' : ''}`}>
        <DenStage skeleton still={Boolean(failed)} />
        {failed ? (
          <section className="den-card" role="alert" aria-labelledby="den-failed-h">
            <span className="den-card__corner" aria-hidden="true" />
            <h2 id="den-failed-h" className="den-card__title">{DenCopy.failed}</h2>
            {failed.message ? <p className="den-card__line">{failed.message}</p> : null}
            <div className="den-card__keys">
              <button type="button" className="mob-key den-key" onClick={failed.onRetry}>{DenCopy.tryAgain}</button>
            </div>
          </section>
        ) : blocks.map((h, i) => (
          <span key={i} className={`den-skel ${i === 0 ? 'den-skel--card' : 'den-skel--strip'}`} style={{ height: `var(--den-skel-b${i}, ${h}px)` }} aria-hidden="true" />
        ))}
      </div>
    </>
  );
}
