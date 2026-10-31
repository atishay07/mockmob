// How a Study card answers its rating (owner, 31 Oct: "some animation or something. When I press Got it"). Calm and quick,
// on one ease-out curve, transform and opacity only:
//   press      a small badge settles on the card's top-right corner (Got it a check, Easy a double check, both volt; Missed a
//              grey circle with an arrow turning back, since that card comes back soon). It leaves with the card.
//   Got it     the card leaves to the right, turning 6 degrees, gone in 280 ms
//   Easy       up and to the right, turning 8 degrees
//   Missed     it drops back 18 px, then slides left, turning back 3 degrees, gone in 260 ms (no shake, no red)
//   next       the next card rises from behind (10 px, from 0.97) in 240 ms, 70 ms after the old one starts to leave
//   reduced    no travel, turn or scale: the badge holds for 300 ms and the cards cross-fade over 120 ms
// The card that leaves is a ghost (studyFeel.js liftGhost, Learn's flyAway shares it) over the session, so the next card is
// already the real one: the keys, the focus and the screen reader move on at once.
// Pure numbers and keyframes (no React, no DOM at import time), so node can test them; the CSS (keycards.css, "Study motion")
// carries the same numbers.

import { liftGhost } from '../study/studyFeel.js';

export const STUDY_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

export const STUDY_MOTION = Object.freeze({
  revealMs: 220, quoteMs: 200, quoteDelayMs: 40, quoteRise: 8, lift: 2,
  badgeMs: 140, badgeFrom: 0.6, badgeSize: 28,
  leaveMs: Object.freeze({ 1: 260, 3: 280, 4: 280 }),
  nextMs: 240, nextDelayMs: 70, nextRise: 10, nextFrom: 0.97,
  endMs: 200, endStaggerMs: 40, endRows: 4, endRise: 8,
  reducedFadeMs: 120, reducedHoldMs: 300,
});

/** How long the rating keys stay shut after a rating is confirmed: the whole leave, so a double press cannot rate the next card. */
export const leaveMs = (rating) => STUDY_MOTION.leaveMs[rating] || STUDY_MOTION.leaveMs[3];

/** The badge a rating puts on the card: 'check' (Got it), 'double' (Easy), 'again' (Missed). */
export const badgeFor = (rating) => (rating === 4 ? 'double' : rating === 1 ? 'again' : 'check');

/**
 * Web Animations keyframes for the card leaving after `rating` (1 Missed, 3 Got it, 4 Easy). The opacity holds a little
 * longer than the travel, so the card is seen going rather than just vanishing.
 */
export function leaveKeyframes(rating, { reduced = false } = {}) {
  if (reduced) {
    // The badge holds on a still card, then the card fades as the next one fades in under it.
    const hold = (STUDY_MOTION.reducedHoldMs - STUDY_MOTION.reducedFadeMs) / STUDY_MOTION.reducedHoldMs;
    return [{ offset: 0, opacity: 1 }, { offset: hold, opacity: 1 }, { offset: 1, opacity: 0 }];
  }
  if (rating === 1) {
    // Two beats, each on the ease-out curve (the effect itself runs linear): it drops 18 px, then slides away to the left.
    return [
      { offset: 0, opacity: 1, transform: 'translate3d(0, 0, 0) rotate(0deg)', easing: STUDY_EASE },
      { offset: 0.3, opacity: 0.94, transform: 'translate3d(0, 18px, 0) rotate(0deg)', easing: STUDY_EASE },
      { offset: 1, opacity: 0, transform: 'translate3d(-40%, 18px, 0) rotate(-3deg)' },
    ];
  }
  const to = rating === 4 ? 'translate3d(90%, -24%, 0) rotate(8deg)' : 'translate3d(110%, 0, 0) rotate(6deg)';
  return [
    { offset: 0, opacity: 1, transform: 'translate3d(0, 0, 0) rotate(0deg)' },
    { offset: 0.35, opacity: 0.85 },
    { offset: 1, opacity: 0, transform: to },
  ];
}

/** The timing for a leave: the shared ease-out over 280 ms (260 for Missed); reduced motion holds the badge for 300 ms. */
export function leaveOptions(rating, { reduced = false } = {}) {
  if (reduced) return { duration: STUDY_MOTION.reducedHoldMs, easing: 'linear', fill: 'forwards' };
  return { duration: leaveMs(rating), easing: rating === 1 ? 'linear' : STUDY_EASE, fill: 'forwards' };
}

/**
 * Lifts the rated card (`card`, the .kc-play__card as the student left it) into a ghost in `host` (.kc-ghosts) and sends it
 * off. Returns the Animation, so the next rating can finish() it at once, or null when nothing was started.
 */
export function leaveCard(card, host, rating, { reduced = false } = {}) {
  const lifted = liftGhost(card, host, leaveKeyframes(rating, { reduced }), leaveOptions(rating, { reduced }), { className: 'kc-ghost' });
  if (!lifted) return null;
  lifted.ghost.setAttribute('data-leave', String(rating));
  return lifted.animation;
}
