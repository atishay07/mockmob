// The app's finish stamp, as numbers the web plays (flutter_app lib/features/practice/widgets/finish_ceremony.dart,
// MOTION.md 4.7, a T2 moment). Pure: stampFigure.js turns these into Web Animations, stamp-plan.test.mjs checks them.
//
// The figure lifts a little and lands: scale 1 to 1.12 over the first 80 ms (ease-out), back down to 1 by 240 ms
// (ease-in cubic: it is pressed onto the paper), then a small settle (to 0.985 and back) by 420 ms. As it lands one
// ink ring spreads from behind it and thins as it fades, over the 600 ms after the landing. No flash, no sweep, no
// second ring. The app's 14 shards are not ported: on the web's smaller figure they read as a toy (see
// docs/design-decisions/web-1105-motion.md).

/** Flutter's curves, as cubic-bezier control points. */
export const FLUTTER = Object.freeze({
  easeOut: [0, 0, 0.58, 1],
  easeInCubic: [0.55, 0.055, 0.675, 0.19],
  easeOutCubic: [0.215, 0.61, 0.355, 1],
});

export const STAMP = Object.freeze({
  /** The whole stamp: 240 ms to the landing, then 600 ms of ring. */
  ms: 840,
  /** The figure's own stamp, inside `ms`. */
  figureMs: 420,
  /** The figure touches down here (ms). */
  landMs: 240,
  /** Lift ends here (ms). */
  liftMs: 80,
  /** How far the figure lifts before it lands. */
  lift: 0.12,
});

const bez = (a, b, t) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;

/** A cubic-bezier easing at x (0 to 1). */
export function cubic([x1, y1, x2, y2], x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 50; i += 1) {
    t = (lo + hi) / 2;
    const at = bez(x1, x2, t);
    if (Math.abs(at - x) < 1e-7) break;
    if (at < x) lo = t; else hi = t;
  }
  return bez(y1, y2, t);
}

const css = (c) => `cubic-bezier(${c.join(', ')})`;

/** The figure's scale `ms` into the stamp (the app's FinishCeremony.figureScale). */
export function figureScale(ms) {
  const { liftMs, landMs, figureMs, lift } = STAMP;
  if (ms <= 0 || ms >= figureMs) return 1;
  if (ms < liftMs) return 1 + lift * cubic(FLUTTER.easeOut, ms / liftMs);
  if (ms < landMs) return 1 + lift * (1 - cubic(FLUTTER.easeInCubic, (ms - liftMs) / (landMs - liftMs)));
  const s = Math.min(1, Math.max(0, (ms - landMs) / (figureMs - landMs)));
  return 1 - 0.015 * Math.sin(Math.PI * s) * (1 - s);
}

/**
 * The figure's keyframes over STAMP.figureMs: the lift and the landing keep the app's own curves (as per-keyframe
 * easings), the settle is sampled.
 */
export function figureKeyframes(samples = 8) {
  const { liftMs, landMs, figureMs, lift } = STAMP;
  const frames = [
    { offset: 0, transform: 'scale(1)', easing: css(FLUTTER.easeOut) },
    { offset: liftMs / figureMs, transform: `scale(${1 + lift})`, easing: css(FLUTTER.easeInCubic) },
    { offset: landMs / figureMs, transform: 'scale(1)', easing: 'linear' },
  ];
  for (let i = 1; i <= samples; i += 1) {
    const ms = landMs + ((figureMs - landMs) * i) / samples;
    frames.push({ offset: ms / figureMs, transform: `scale(${round(figureScale(ms))})`, easing: 'linear' });
  }
  return frames;
}

/**
 * The ring `a` of the way through its 600 ms (0 at the landing): an ellipse about the figure's centre that spreads and
 * thins and fades as it goes, on the app's curve (ease-out cubic), line (5 to 0.8, scaled by `stroke`) and fade (0.85
 * to 0). Where it starts and how far it spreads are the web's (ringGeometry): the app's ring, 0.42 of the ink height
 * about the centre, is sized for its 112 sp figure; on the web's 44 to 64 px score it drew a stray circle round the
 * middle digit, so here it starts on the figure's own outline and spreads outward from it.
 */
export function ringAt(a, { rx0, ry0, spread, rxMax = Infinity, ryMax = Infinity, stroke = 1 }) {
  const t = cubic(FLUTTER.easeOutCubic, Math.min(1, Math.max(0, a)));
  return {
    rx: Math.min(rx0 + spread * t, rxMax),
    ry: Math.min(ry0 + spread * t, ryMax),
    width: (5 * (1 - t) + 0.8) * stroke,
    alpha: 0.85 * (1 - t),
  };
}

/** The ring's keyframes for an absolutely placed box with a border (width and height include the line, so the line is centred on the ellipse). */
export function ringKeyframes(geometry, samples = 14) {
  const frames = [];
  for (let i = 0; i <= samples; i += 1) {
    const a = i / samples;
    const { rx, ry, width, alpha } = ringAt(a, geometry);
    frames.push({
      offset: a,
      width: `${round(2 * rx + width)}px`,
      height: `${round(2 * ry + width)}px`,
      borderWidth: `${round(width)}px`,
      opacity: round(alpha),
    });
  }
  return frames;
}

/**
 * The ring's geometry for a figure `width` px wide drawn at `fontSize` px: it starts round the digits (their ink is
 * about 0.71 of the size tall; an ellipse through a box's corners is about 1.2 to 1.3 times its half sides) and spreads
 * a quarter of the size beyond that; above and below it stays within `room` px of the ink, so it never reaches the
 * lines over and under the score. The line keeps the app's proportion (5 dp on its 112 sp figure).
 */
export function ringGeometry({ width, fontSize, room = 14 }) {
  const size = Number(fontSize) || 56;
  const ink = size * 0.71;
  const rx0 = (Math.max(Number(width) || 0, ink) / 2) * 1.18 + size * 0.04;
  const ry0 = (ink / 2) * 1.3;
  return { rx0, ry0, spread: size * 0.25, ryMax: ink / 2 + room, stroke: size / 112 };
}

/** Whether a finished set earns the ring (the app's FinishTone good or great: 70% of the questions right or more). */
export function earnsRing({ right = 0, wrong = 0, blank = 0 } = {}) {
  const total = right + wrong + blank;
  return total > 0 && right / total >= 0.7;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
