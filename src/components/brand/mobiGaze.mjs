// Where Mobi's eyes go, as pure numbers (1104 P2, decisions 4 and 5), so node --test can hold them
// (homeHero.test.mjs). MobiReact (idle="css", gaze) and HeroMobi (the glance at the headline) use these.
//
// The eyes' group takes one translate in the drawing's own units (the figure is 168 units tall), so a screen distance
// is divided by the drawn scale. The gaze follows a fine pointer by at most GAZE_MAX_PX on screen; the glance looks
// GLANCE_PX toward the headline when a typed phrase completes.

/** Fine pointers only: the gaze never runs on a phone (no listener at all there). */
export const GAZE_MEDIA = '(hover: hover) and (pointer: fine)';
/** The farthest the gaze moves his eyes, in screen pixels. */
export const GAZE_MAX_PX = 2.5;
/** The distance (screen px from his eyes) at which the gaze reaches its full offset. */
export const GAZE_REACH_PX = 280;
/** His CSS blink, every this many ms while he rests (idle="css"). */
export const BLINK_EVERY_MS = 4200;
/** The glance toward the headline: how far (screen px), in, hold and back (ms). */
export const GLANCE = Object.freeze({ px: 2, inMs: 140, holdMs: 260, outMs: 160 });

const round = (v) => Math.round(v * 100) / 100 || 0;

/** His eye point in a box (client px): the middle, 45 % down (the visor). */
export function eyePoint(box) {
  return [box.left + box.width / 2, box.top + box.height * 0.45];
}

/**
 * An eye offset of `px` screen pixels from his eye point toward [x, y], in drawing units, rounded to 0.01. `reach`
 * (screen px) scales it down for a target closer than that; 0 means always the full `px`.
 */
export function eyeOffsetToward([x, y], box, px, reach = 0) {
  if (!box || !box.height) return [0, 0];
  const [ex, ey] = eyePoint(box);
  const dx = x - ex;
  const dy = y - ey;
  const d = Math.hypot(dx, dy);
  if (!d) return [0, 0];
  const len = (reach > 0 ? Math.min(1, d / reach) : 1) * px;
  const units = 168 / box.height;
  return [round((dx / d) * len * units), round((dy / d) * len * units)];
}

/** The gaze for a pointer at [x, y] (client px): at most GAZE_MAX_PX on screen, full from GAZE_REACH_PX away. */
export function gazeOffset(at, box) {
  return eyeOffsetToward(at, box, GAZE_MAX_PX, GAZE_REACH_PX);
}

/** The glance toward a target box (the h1): GLANCE.px on screen toward its centre. */
export function glanceOffset(target, box) {
  if (!target) return [0, 0];
  return eyeOffsetToward([target.left + target.width / 2, target.top + target.height / 2], box, GLANCE.px);
}
