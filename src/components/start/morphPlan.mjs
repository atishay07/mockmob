// The Start sheet's container transform, as numbers (the app's MorphSheetRoute, flutter_app
// lib/core/widgets/bar/morph_sheet_route.dart, DOCK.md 5.4, MOTION.md C8). Pure: StartSheet.jsx plays it with Web
// Animations, morph-plan.test.mjs checks it.
//
// Opening (420 ms, the emphasized duration): the sheet's shape grows out of the Start key, a rounded rectangle clipped
// from the key's own box to the sheet's, on the app's grow curve (softer off the button than emphasized, so the shape is
// seen leaving the key instead of appearing beside it). The key's volt stays where it was and dissolves as the shape
// grows out of it (gone by 30%, swelling 20%). The content waits for the shape: it fades in over 38% to 78% of the
// morph, scaling from 0.94 about the key, so no line is ever cut by a shape still under 80% of its width.
// Closing (280 ms, accelerating): the shape gathers back into the key, the content is gone in the first 55%, and the
// key's volt gathers again over the last 30%. A swipe down still slides the sheet away from the finger.
// Reduced motion: a 120 ms fade each way, nothing moves.
//
// Where the key is not inside the sheet's box (the desktop sidebar's key, beside the panel), the sheet stands off by
// the difference at the start and travels home on the same curve, so the shape still starts on the key.

export const MORPH = Object.freeze({
  openMs: 420,
  closeMs: 280,
  /** The app's morphGrowCurve. */
  grow: [0.3, 0.55, 0.2, 1],
  /** The app's closeCurve: the shape gathers back into the key. */
  close: [0.3, 0, 0.8, 0.15],
  /** The app's glide, for the content and the key's volt. */
  glide: [0.15, 0.5, 0.5, 1],
  contentIn: Object.freeze([0.38, 0.78]),
  contentFrom: 0.94,
  /** Closing: the content is gone by this share of the close. */
  contentOutBy: 0.55,
  /** The key's volt is gone by this share of the open (and gathers over this last share of the close). */
  discBy: 0.3,
  discSwell: 0.2,
  /** The glass starts this thick and is whole by `glassBy` of the open. */
  glassFrom: 0.45,
  glassBy: 0.55,
  reducedMs: 120,
});

export const bezier = (c) => `cubic-bezier(${c.join(', ')})`;

const sample = (c, x) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bez = (a, b, t) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 50; i += 1) {
    t = (lo + hi) / 2;
    if (bez(c[0], c[2], t) < x) lo = t; else hi = t;
  }
  return bez(c[1], c[3], t);
};

/**
 * Where the shape starts. `key` and `box` are rects ({ left, top, width, height }) in the viewport; `keyRadius` is the
 * key's corner radius in px. Returns the sheet's stand-off ({ dx, dy }: where it starts, relative to where it rests) and
 * the clip at the start, in the sheet's own box: { top, right, bottom, left } insets (negative reaches outside it).
 */
export function morphFrom(key, box, keyRadius = 0) {
  const kr = key.left + key.width;
  const kb = key.top + key.height;
  const br = box.left + box.width;
  const bb = box.top + box.height;
  let dx = 0;
  let dy = 0;
  if (key.left < box.left) dx = key.left - box.left; else if (kr > br) dx = kr - br;
  if (key.top < box.top) dy = key.top - box.top; else if (kb > bb) dy = kb - bb;
  const left = key.left - (box.left + dx);
  const top = key.top - (box.top + dy);
  return {
    dx,
    dy,
    inset: { top, right: box.width - left - key.width, bottom: box.height - top - key.height, left },
    radius: Math.max(0, Math.min(keyRadius, key.width / 2, key.height / 2)),
  };
}

const px = (n) => `${Math.round(n * 100) / 100}px`;

/** clip-path inset() for the given insets and corner radii ([tl, tr, br, bl] in px). */
export function insetClip({ top, right, bottom, left }, radii) {
  return `inset(${px(top)} ${px(right)} ${px(bottom)} ${px(left)} round ${radii.map(px).join(' ')})`;
}

/** The sheet's own keyframes: the clip from the key to the sheet, with the stand-off travelling home. */
export function shapeKeyframes(from, sheetRadii, { closing = false } = {}) {
  const start = { clipPath: insetClip(from.inset, [from.radius, from.radius, from.radius, from.radius]), transform: `translate(${px(from.dx)}, ${px(from.dy)})` };
  const end = { clipPath: insetClip({ top: 0, right: 0, bottom: 0, left: 0 }, sheetRadii), transform: 'translate(0px, 0px)' };
  return closing ? [end, start] : [start, end];
}

/**
 * The glass thickening as it grows (the app's sheetTintAlpha: 45% at the first frame, so the page and the key still show
 * through the growing shape, resting density by 55% of the morph, on glide). Played as the sheet's opacity, which leaves
 * the scrim alone. Closing thins it again over the close's second half.
 */
export function glassKeyframes({ closing = false } = {}) {
  const open = [
    { offset: 0, opacity: MORPH.glassFrom, easing: bezier(MORPH.glide) },
    { offset: MORPH.glassBy, opacity: 1 },
    { offset: 1, opacity: 1 },
  ];
  if (!closing) return open;
  return [
    { offset: 0, opacity: 1 },
    { offset: 1 - MORPH.glassBy, opacity: 1, easing: bezier(MORPH.close) },
    { offset: 1, opacity: MORPH.glassFrom },
  ];
}

/** The content's keyframes (opacity and a scale from 0.94 about the key), over the whole morph. */
export function contentKeyframes({ closing = false } = {}) {
  const from = `scale(${MORPH.contentFrom})`;
  if (closing) {
    return [
      { offset: 0, opacity: 1, transform: 'none' },
      { offset: MORPH.contentOutBy, opacity: 0, transform: from },
      { offset: 1, opacity: 0, transform: from },
    ];
  }
  const [a, b] = MORPH.contentIn;
  return [
    { offset: 0, opacity: 0, transform: from },
    { offset: a, opacity: 0, transform: from, easing: bezier(MORPH.glide) },
    { offset: b, opacity: 1, transform: 'none' },
    { offset: 1, opacity: 1, transform: 'none' },
  ];
}

/**
 * The key's volt at the origin: full at the first frame, swelling 20% and gone by 30% of the open, its alpha falling
 * fastest at first ((1 - e)^2, e on glide), so it never sits half-faded over the glass. Closing plays it backwards over
 * the last 30%. Sampled, so the curve is the app's own.
 */
export function discKeyframes({ closing = false, samples = 8 } = {}) {
  const frames = [];
  for (let i = 0; i <= samples; i += 1) {
    const u = i / samples;
    const e = sample(MORPH.glide, u);
    const alpha = (1 - e) * (1 - e);
    frames.push({ offset: u * MORPH.discBy, opacity: Math.round(alpha * 1000) / 1000, transform: `scale(${Math.round((1 + MORPH.discSwell * e) * 1000) / 1000})` });
  }
  frames.push({ offset: 1, opacity: 0, transform: `scale(${1 + MORPH.discSwell})` });
  if (!closing) return frames;
  return frames.map((f) => ({ ...f, offset: Math.round((1 - f.offset) * 10000) / 10000 })).reverse();
}

/** Corner radii from a computed border-radius list ("26px 26px 0px 0px"), falling back to `fallback` px each. */
export function radiiOf(style, fallback = 24) {
  const read = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };
  if (!style) return [fallback, fallback, fallback, fallback];
  return [read(style.borderTopLeftRadius), read(style.borderTopRightRadius), read(style.borderBottomRightRadius), read(style.borderBottomLeftRadius)];
}
