// How a concept check feels (motion packet M4): answering inks the right answer with a drawn check
// and one soft click, a miss gets one gentle nudge and a short Mobi encouragement, a rated card
// flies off on a spring, and the pips fill on a spring. The app does the same, with the same words
// and numbers (flutter_app lib/features/learn/widgets: answer_inputs, feedback_mobi, step_swap,
// run_pips). The shared fixture data/fixtures/study_feel/feel.json is copied byte for byte into
// flutter_app/test/fixtures/learn_feel/, and a test on each side holds its own constants to it
// (data/tests/study_feel.test.mjs here, learn_feel_test.dart there).
//
// Pure helpers (no React, and no DOM at import time), so node can test them. The CSS carries the
// same numbers as custom properties on .sx-run (study.css), checked by the same test.

import { outgoingKeyframes, swapSpec } from '../../lib/motion/swap.js';

/** The shared numbers. Durations are in ms, distances in px (dp in the app). */
export const FEEL = Object.freeze({
  ink: Object.freeze({ ringMs: 320, checkMs: 320, leadMs: 60, checkAfterMs: 200, panelCheckMs: 160 }),
  nudge: Object.freeze({ amplitude: 4, cycles: 3, durationMs: 220 }),
  swap: Object.freeze({ arriveTravel: 24, flyTravel: 56, flyLift: 10, flyScale: 0.97, flyGoneAt: 0.55 }),
  mobi: Object.freeze({ rightAct: 'correct', missAct: 'encourage', gapMs: 2500, slot: 56, gate: 'learn:feedback' }),
});

/** The one short line under a miss or a skip. It never says how close it was, only that the answer is there. */
export const NUDGE_LINES = Object.freeze({
  miss: 'Good to find out here. The answer is below.',
  skipped: 'That is fine. The answer is below.',
});

/** What a checked answer turned out to be: 'right', 'miss', 'skipped', or 'shown' (a self-rated card has no verdict). */
export function resultKind(feedback) {
  if (!feedback || typeof feedback.correct !== 'boolean') return 'shown';
  if (feedback.correct) return 'right';
  return feedback.skipped ? 'skipped' : 'miss';
}

/** The line under the headline: a miss or a skip gets one, a right answer none (the headline and the check say it). */
export function nudgeLine(feedback) {
  const kind = resultKind(feedback);
  return kind === 'miss' ? NUDGE_LINES.miss : kind === 'skipped' ? NUDGE_LINES.skipped : null;
}

/** Index of the option the student picked, or null (typed answers, a skip, an unknown text). */
export function pickedIndex(item, feedback) {
  if (!item?.options || typeof feedback?.chosen !== 'string') return null;
  const index = item.options.indexOf(feedback.chosen);
  return index === -1 ? null : index;
}

/** Index of the right option once it has been revealed, or null. */
export function rightIndex(item) {
  return Number.isInteger(item?.answer) && item.options && item.answer >= 0 && item.answer < item.options.length ? item.answer : null;
}

/** When the right row starts inking (ms after the options swap): at once after a right answer, after the nudge after a miss. */
export function ringDelayMs(afterMiss) {
  return afterMiss ? FEEL.nudge.durationMs : FEEL.ink.leadMs;
}

/** When its check starts drawing (ms): a little after the outline has begun. */
export const checkDelayMs = (afterMiss) => ringDelayMs(afterMiss) + FEEL.ink.checkAfterMs;

/** The sideways nudge at progress t (0 to 1): the app's MmShake.offsetAt, 4 px, 3 cycles, decaying to rest. */
export function nudgeOffset(t) {
  if (t <= 0 || t >= 1) return 0;
  return FEEL.nudge.amplitude * Math.sin(t * FEEL.nudge.cycles * 2 * Math.PI) * (1 - t);
}

/** A flying card's opacity at the spring's progress t: fully gone at flyGoneAt, well before the spring settles. */
export const flyOpacity = (t) => Math.min(1, Math.max(0, 1 - t / FEEL.swap.flyGoneAt));

/** A flying card's transform at the spring's progress t. */
export function flyTransform(t) {
  const x = -FEEL.swap.flyTravel * t;
  const y = -FEEL.swap.flyLift * t;
  const scale = 1 - (1 - FEEL.swap.flyScale) * t;
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

/**
 * Web Animations keyframes for a rated card flying off. The animation's own easing is the spring
 * (the app's smooth spring as a CSS linear() curve), so the offsets here are in spring progress:
 * the opacity reaches 0 at flyGoneAt and the flight carries on to rest at 1.
 */
export function flyKeyframes() {
  return [
    { offset: 0, opacity: 1, transform: flyTransform(0) },
    { offset: FEEL.swap.flyGoneAt, opacity: 0 },
    { offset: 1, opacity: 0, transform: flyTransform(1) },
  ];
}

/** The right reaction act for a result, or null when a result has no reaction (a self-rated card). */
export function reactionAct(kind) {
  return kind === 'right' ? FEEL.mobi.rightAct : kind === 'miss' || kind === 'skipped' ? FEEL.mobi.missAct : null;
}

/** Mobi stands beside the words only under Celebrations Full: Quiet and Off keep the words alone. */
export const mobiShownFor = (celebrations) => celebrations === 'full';

/**
 * One soft click for a right answer, by the same rules as the app's light haptic and the lamp
 * objects' tick: Android Chrome only, Touch feedback on, page visible. Nothing fires for a miss,
 * and the caller only asks once the server has acknowledged the answer.
 */
export function softClick() {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    if (!/Android/i.test(navigator.userAgent || '')) return false;
    if (document.visibilityState !== 'visible' || document.documentElement.dataset.touch === 'off') return false;
    try { if (window.localStorage.getItem('mm:touch:v1') === 'off') return false; } catch { /* storage blocked: the default is on */ }
    return navigator.vibrate([8]);
  } catch {
    return false; // A device that refuses is fine.
  }
}

/**
 * Lifts a finished stage into a ghost that leaves while the next step arrives. `kind` is 'fly' (a
 * rated card, on the spring) or 'axis' (any other step: it drifts a fifth of the arrival's travel and
 * gives way once the new step is half there, by the swap kit's overlap rule); `host` is the empty,
 * aria-hidden, absolutely-positioned box in the run (.sx-ghosts); `reduced` skips it all.
 *
 * The ghost is a visual copy: inert, hidden from screen readers, with no ids and no focus stops, and
 * it removes itself when its animation ends. Call it before the new step renders, so the copy is
 * the step as the student left it. Returns the ghost node, or null when nothing was started.
 */
export function flyAway(stage, host, kind, { reduced = false } = {}) {
  if (reduced || !stage || !host) return null;
  try {
    const here = stage.getBoundingClientRect();
    const box = host.getBoundingClientRect();
    if (!here.width || !here.height) return null;
    let keyframes;
    let options;
    if (kind === 'fly') {
      keyframes = flyKeyframes();
      options = springOptions();
    } else {
      const out = outgoingKeyframes(swapSpec('axis', { dir: 1, travel: FEEL.swap.arriveTravel }));
      keyframes = out.keyframes;
      options = { duration: out.durationMs, easing: 'linear', fill: 'forwards' };
    }
    const ghost = stage.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    ghost.querySelectorAll('[tabindex]').forEach((n) => n.removeAttribute('tabindex'));
    ghost.querySelectorAll('button, a, input, textarea, select').forEach((n) => { n.tabIndex = -1; });
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    ghost.removeAttribute('data-arrive');
    ghost.classList.add('sx-ghost');
    Object.assign(ghost.style, { position: 'absolute', margin: '0', left: `${here.left - box.left}px`, top: `${here.top - box.top}px`, width: `${here.width}px`, pointerEvents: 'none' });
    host.appendChild(ghost);
    const animation = ghost.animate(keyframes, options);
    const done = () => ghost.remove();
    animation.finished.then(done, done);
    return ghost;
  } catch {
    return null;
  }
}

const FALLBACK_EASING = 'cubic-bezier(0.23, 1, 0.32, 1)';

/** Timing for a spring-driven flight: the app's smooth spring as a linear() curve over its own settle time. */
function springOptions() {
  let easing = FALLBACK_EASING;
  let duration = 360;
  try {
    const style = getComputedStyle(document.documentElement);
    const curve = style.getPropertyValue('--mm-spring-smooth').trim();
    const ms = parseFloat(style.getPropertyValue('--mm-spring-smooth-dur'));
    if (curve && window.CSS?.supports?.('animation-timing-function', curve)) easing = curve;
    if (Number.isFinite(ms) && ms > 0) duration = ms;
  } catch { /* Fall back to the out curve over 360 ms. */ }
  return { duration, easing, fill: 'forwards' };
}
