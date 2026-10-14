// The web motion kit. Same feel as the app: springs on press, numbers that roll, lines that ink,
// rows that fold away. Styles live in src/app/motion-kit.css (imported by globals.css).
export { useCountUp } from './useCountUp';
export { useInView } from './useInView';
export { useSwipeCommit } from './useSwipeCommit';
export { drawOn, isMotionReduced } from './draw';
export { foldExit } from './fold';

// Class names, so a typo cannot silently drop a motion.
export const MK = {
  press: 'mk-press', // spring press and release
  shake: 'mk-shake', // add once to say "not that"; remove on animationend
  draw: 'mk-draw', // stroke inks on (the path needs pathLength="1")
  pop: 'mk-pop', // scale-in with a small overshoot
  rise: 'mk-rise', // fade and lift in
  stagger: 'mk-stagger', // children rise in order (set --i on each child)
  swipe: 'mk-swipe', // follows --mk-swipe-x
};
