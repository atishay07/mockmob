'use client';

// Plays the app's finish stamp on a figure (stampPlan.js holds the numbers and the reasons).
//
//   stampFigure({ figure, ring, landsIn })
//
// `figure` is the element that lifts and lands (scaled about its own centre); `ring`, when given, is an empty element
// centred behind it that draws the one ink ring as the figure lands. `landsIn` (ms from now) is when the figure should
// touch down: RollNumber's onRoll passes its own landing, so the stamp lands with the last digit. Web Animations only,
// all started in this task, so they share the roll's clock. Returns the animations (the caller may cancel them).
import { STAMP, figureKeyframes, ringGeometry, ringKeyframes } from './stampPlan.js';

export function stampFigure({ figure, ring = null, landsIn = STAMP.landMs } = {}) {
  if (!figure || typeof figure.animate !== 'function') return [];
  const start = Math.max(0, landsIn - STAMP.landMs);
  const out = [];
  const lift = figure.animate(figureKeyframes(), { duration: STAMP.figureMs, delay: start, easing: 'linear', fill: 'none' });
  lift.id = 'mk-stamp';
  out.push(lift);
  if (ring && typeof ring.animate === 'function') {
    const fontSize = parseFloat(getComputedStyle(figure).fontSize) || 56;
    const geometry = ringGeometry({ width: figure.offsetWidth, fontSize });
    const spread = ring.animate(ringKeyframes(geometry), { duration: STAMP.ms - STAMP.landMs, delay: start + STAMP.landMs, easing: 'linear', fill: 'none' });
    spread.id = 'mk-stamp-ring';
    out.push(spread);
  }
  return out;
}
