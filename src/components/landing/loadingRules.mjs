// The home page's loading-motion kit (R3-D10, owner LK112, 5 Nov 2026; research preparoo B8). Pure rules, no React and no
// browser, so node --test holds them (loadingKit.test.mjs); LoadingKit.jsx plays them and loading-kit.css draws them.
//
//   Count-up   a TRUE number (the bank, the price per mock) climbs from 0 once, when 40% of it is in view: 1,900 ms on an
//              ease-out quart, about Preparoo's 1,990 ms. The server and the first paint always print the real value, so a
//              reader without script, a search engine and a screen reader get the number, never a made-up zero; the roll only
//              runs for a number that enters from off screen (one already in view at load simply stays).
//   Shimmer    a skeleton for a block that is still loading (async): a soft band sweeps across it 4 times, 1.2 s each, then
//              it rests (the app's skeleton rule, WA-03, as du-shimmer). Neutral tint, never volt; transform only.
//   Stagger    rows of a demo arrive one after another: a 6 px rise and fade over 160 ms, 70 ms apart.
// Reduced motion (the device setting or the site's own switch): the number is simply there, the skeleton is still, rows appear.

export const COUNT_UP = Object.freeze({ ms: 1900, share: 0.4 });
export const SHIMMER = Object.freeze({ ms: 1200, passes: 4 });
export const STAGGER = Object.freeze({ step: 70, ms: 160, rise: 6 });

/** Ease-out quart: fast at first, settling softly on the true value. */
export const easeOutQuart = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 4;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const round = (v, decimals) => {
  const f = 10 ** Math.max(0, Math.floor(decimals) || 0);
  return Math.round(v * f) / f;
};

/** The number shown `elapsed` ms into a count-up from `from` to `to`; exactly `to` at and after the end. */
export function countAt(elapsed, { to, from = 0, ms = COUNT_UP.ms, decimals = 0 } = {}) {
  const target = Number(to);
  if (!Number.isFinite(target)) return to;
  const t = ms > 0 ? clamp01(elapsed / ms) : 1;
  if (t >= 1) return target;
  return round(from + (target - from) * easeOutQuart(t), decimals);
}

/**
 * What a count-up does on its first look at the screen: 'show' (the value stays as printed: motion is reduced, the value is
 * not a number, or 40% of it is already in view) or 'arm' (it starts from `from` and rolls once 40% of it comes into view).
 */
export function countPlan({ value, ratio = 0, reduced = false, share = COUNT_UP.share } = {}) {
  if (reduced || !Number.isFinite(Number(value))) return 'show';
  return ratio >= share ? 'show' : 'arm';
}

/** "16,020" (Indian grouping by default), with a fixed number of decimals when asked ("3.30"). */
export function formatCount(value, { locale = 'en-IN', decimals = 0 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** The delay of row `i` in a staggered list. */
export const staggerDelay = (i) => Math.max(0, Math.floor(Number(i) || 0)) * STAGGER.step;
