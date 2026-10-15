// The web motion kit: one motion language with the app. Every duration, curve and spring comes from
// shared/motion-tokens.json (the app reads the same file) through scripts/gen-motion-tokens.mjs, which
// writes the CSS custom properties at the top of src/app/motion-kit.css (imported by globals.css)
// and ./tokens.g.js for scripts. Springs are the app's physics: presses sink on the snappy spring and
// let go with a lift, numbers roll and remember, lines ink, rows fold, swaps overlap, drags carry the
// finger's speed, and pages move as the phone's router does.
export { useCountUp, useCountUpState } from './useCountUp';
export { useInView } from './useInView';
export { useSwipeCommit } from './useSwipeCommit';
export { useDragCommit, createDragController } from './useDragCommit';
export { useScrub, createScrubController } from './useScrub';
export { SwapKey, useSwapKey } from './SwapKey';
export { drawOn, isMotionReduced } from './draw';
export { foldExit } from './fold';
export { pressScaleFor } from './dragPolicy';
export { scrubIndex, scrubX, scrubKeyIndex } from './scrub';
export { clearNumberMemory, numberDirection, recallNumber, rememberNumber } from './numberMemory';
export { VT, VIEW_TRANSITION_PROPS, transitionFor, transitionTypesFor, isTestPath } from './placeTransition';
export { MOTION_TOKENS_VERSION, counts, curves, durations, ease, easeReverse, numbers, pressLift, springs, transitions } from './tokens.g.js';

// Class names, so a typo cannot silently drop a motion.
export const MK = {
  press: 'mk-press', // the app's press: sinks on the snappy spring, lets go with a lift
  pressWide: 'mk-press--wide', // a wide surface sinks about 8 px, not 4 percent
  shake: 'mk-shake', // add once to say "not that"; remove on animationend
  draw: 'mk-draw', // stroke inks on (the path needs pathLength="1")
  pop: 'mk-pop', // arrives from 0.97 with a fade
  rise: 'mk-rise', // fades in rising 14 px
  stagger: 'mk-stagger', // children rise in order (set --i on each child; capped at the eighth)
  swipe: 'mk-swipe', // follows --mk-swipe-x
  drag: 'mk-drag', // useDragCommit's element
  swap: 'mk-swap', // SwapKey's box
  num: 'mk-num', // a remembered number: put useCountUpState's ink on data-ink
  scrub: 'mk-scrub', // useScrub's element
};
