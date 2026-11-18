// The tour deck's motion, as plain functions (TourDeck.jsx draws them; deckMotion.test.mjs proves them).
//
// The deck is a pile of cards inside a held scroll story. `deckProgress` turns how far the page has scrolled through the
// hold into a position in the pile (0 = the first tool on top, 1 = the second, ...), and `deckPose` turns one card's
// distance from the top of the pile into its transform. Nothing here reads the page.

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

/** How fast the pile catches up with the scroll, as a time constant in ms. A finger's drag is followed almost one to one;
 *  a mouse's step (the page jumps to the next rest in one frame) is eased over about 400 ms. */
export const DECK_TAU = Object.freeze({ touch: 55, mouse: 130 });

/** The share of each step's scroll at its two ends where the pile barely moves, so a card that has landed stays put while
 *  the page creeps (a detent), and most of the travel happens in the middle of the step. */
export const DECK_REST = 0.07;

/** A card under the pile shows this many edges before it is gone. */
export const DECK_DEPTH = 3;

const smooth = (f) => f * f * (3 - 2 * f);

/**
 * Where the pile is, from the scroll.
 * @param scrolled px the page has travelled past the start of the hold (negative before it)
 * @param hold     px the hold lasts (the track's height less the stage's)
 * @param count    how many cards
 * @param reduced  reduced motion: whole cards only
 */
export function deckProgress(scrolled, hold, count, reduced = false) {
  const last = Math.max(0, count - 1);
  if (!(hold > 0) || last === 0) return 0;
  const raw = clamp(scrolled / hold, 0, 1) * last;
  if (reduced) return Math.round(raw);
  const whole = Math.min(last, Math.floor(raw));
  const part = raw - whole;
  const eased = smooth(clamp((part - DECK_REST) / (1 - 2 * DECK_REST), 0, 1));
  return whole + eased;
}

const GONE = Object.freeze({ transform: 'translate3d(0, 104%, 0)', opacity: '0', shade: '0', hidden: true });

/**
 * One card's pose. `t` is its distance from the top of the pile: 0 on top, negative while it is still rising from the
 * pile's foot (-1 = not dealt yet), positive once other cards lie on it (1 = one card over it).
 * Rising: the card travels its own height up from the foot and tips flat as it lands (its foot comes toward the reader).
 * Covered: it sinks one `peek` up and a twentieth smaller per card laid on it, darkens a little, and after DECK_DEPTH
 * cards it has faded out. Only transform and opacity; the origin is the card's top centre (r18-tour-deck.css).
 */
export function deckPose(t, { peek = 12, reduced = false } = {}) {
  let at = t;
  if (reduced) {
    if (at < -0.5) return GONE;
    at = Math.max(0, Math.round(at));
  }
  if (at <= -1) return GONE;
  if (at < 0) {
    const left = -at; // 1 at the foot, 0 landed
    return {
      transform: `translate3d(0, ${(left * 104).toFixed(2)}%, 0) rotateX(${(left * 7).toFixed(2)}deg)`,
      opacity: '1',
      shade: '0',
      hidden: false,
    };
  }
  const depth = Math.min(at, DECK_DEPTH);
  if (depth >= DECK_DEPTH) return { transform: `translate3d(0, ${(-peek * DECK_DEPTH).toFixed(1)}px, 0) scale(${(1 - 0.05 * DECK_DEPTH).toFixed(4)})`, opacity: '0', shade: '0', hidden: true };
  const fade = depth > DECK_DEPTH - 1 ? DECK_DEPTH - depth : 1;
  return {
    transform: depth === 0 ? 'translate3d(0, 0, 0)' : `translate3d(0, ${(-peek * depth).toFixed(1)}px, 0) scale(${(1 - 0.05 * depth).toFixed(4)})`,
    opacity: fade.toFixed(3),
    shade: Math.min(0.22, depth * 0.09).toFixed(3),
    hidden: false,
  };
}
