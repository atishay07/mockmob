// companionModel: the pure rules behind the phone scroll companion (MobiCompanion.jsx, round 14, 13 Nov 2026).
// No DOM here, so node --test can pin every number the component reads.

export const COMPANION = {
  heightPx: 56, // his figure's height
  headPx: 26, // what still shows above the bar when he tucks down off a control
  gapPx: 14, // above the screen's foot when no bar is under him
  insetPx: 16, // in from the right end of the bar
  heroShare: 0.6, // he first appears once the reader has scrolled this share of a screen
  settleMs: 250, // the wait before he comes back after stepping out (no flicker)
  restMs: 260, // the lean eases back this long after the scroll stops
  poseGapMs: 600, // at most one pose change in this window
  slowSpeed: 0.3, // a pose is committed only under this speed (or at rest)
  leanDeg: 5, // the most he leans
  stretch: 0.06, // the most a flick stretches him (scaleY 1.06)
  flick: 0.6, // the speed where the stretch starts
  bubbleMs: 3000, // the hello stays this long (short: it stands over the page while it shows)
  bubbleScrollPx: 400, // or until the reader scrolls this far
  bubbleKey: 'mm:companion-hello:v1',
};

// The section whose box holds the point 55 % down the screen decides his pose.
export const SECTION_POSES = {
  hero: 'attentive',
  colleges: 'attentive',
  statement: 'thinking',
  'key-cards': 'pointing',
  'exam-experience': 'reading',
  compass: 'pointing',
  'du-eligibility': 'pointing',
  'on-instagram': 'greeting',
  pricing: 'attentive',
  faq: 'thinking',
};
export const DEFAULT_POSE = 'idle';
export const POSES = ['greeting', 'attentive', 'thinking', 'pointing', 'celebrating', 'encouraging', 'idle', 'reading'];

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** A section's key: its id, else the class that names it (the hero, the statement and the close have no id). */
export function sectionKey({ id = '', classes = [] } = {}) {
  if (id) return id;
  const list = Array.isArray(classes) ? classes : String(classes).split(/\s+/);
  if (list.includes('lp-hero')) return 'hero';
  if (list.includes('lp-statement')) return 'statement';
  if (list.includes('lp-close')) return 'close';
  if (list.includes('lp-sec--band')) return 'faq';
  return '';
}

export const poseForSection = (key) => SECTION_POSES[key] || DEFAULT_POSE;

/** Scroll speed from one frame: px per ms, scaled so a brisk thumb is about 1, clamped to -1..1 (down is positive). */
export function velocity(dy, dtMs) {
  if (!Number.isFinite(dy) || !dy) return 0;
  const dt = Math.max(16, Number.isFinite(dtMs) ? dtMs : 16);
  return clamp(dy / dt / 1.4, -1, 1);
}

/** Lean (degrees, from his feet) and stretch (added to scaleY) for a speed. He leans against the travel: back as the page runs down. */
export function lean(v) {
  const s = clamp(Number(v) || 0, -1, 1);
  const deg = Math.round(s * COMPANION.leanDeg * 100) / 100;
  const fast = clamp((Math.abs(s) - COMPANION.flick) / (1 - COMPANION.flick), 0, 1);
  return { deg: deg || 0, stretch: Math.round(fast * COMPANION.stretch * 1000) / 1000 };
}

/**
 * Commit a new pose? Only a different one, only while the scroll is slow or resting, and never within poseGapMs of the
 * last change. Returns the ms to wait when only the gap blocks it (so the caller can try again then), else 0.
 */
export function poseDecision({ current, wanted, speed = 0, resting = false, now = 0, lastAt = -Infinity }) {
  if (!wanted || wanted === current) return { commit: false, waitMs: 0 };
  if (!resting && Math.abs(speed) >= COMPANION.slowSpeed) return { commit: false, waitMs: 0 };
  const since = now - lastAt;
  if (since < COMPANION.poseGapMs) return { commit: false, waitMs: Math.ceil(COMPANION.poseGapMs - since) };
  return { commit: true, waitMs: 0 };
}

/** Should he be on screen? Out for any other Mobi, a bar that carries one, the Ask sheet, the hero's first screen, the footer. */
export function wantShown({ scrollY = 0, viewport = 0, otherMobi = false, barOn = false, askOpen = false, footer = false, navOpen = false } = {}) {
  if (!viewport || scrollY < viewport * COMPANION.heroShare) return false;
  return !otherMobi && !barOn && !askOpen && !footer && !navOpen;
}

/** Where his feet stand, in px above the screen's foot: on the dock's top edge when it is up, else his resting gap (CSS). */
export function floorLift({ docked = false, dockHeight = 0, restBottom = COMPANION.gapPx } = {}) {
  if (!docked || !(dockHeight > 0)) return 0;
  return Math.max(0, Math.round(dockHeight - restBottom));
}

/** The control check: is any of the elements under him something a reader taps? (tag names and roles, lower case) */
const TAPPABLE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary', 'label', 'video', 'audio']);
const TAPPABLE_ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'slider', 'option', 'menuitem']);
export function isTappable({ tag = '', role = '' } = {}) {
  return TAPPABLE_TAGS.has(String(tag).toLowerCase()) || TAPPABLE_ROLES.has(String(role).toLowerCase());
}

/** The hello bubble: shown once a browser session, and it leaves after bubbleMs or a scroll of bubbleScrollPx. */
export function bubbleGone({ shownAt = 0, now = 0, fromY = 0, y = 0 }) {
  return now - shownAt >= COMPANION.bubbleMs || Math.abs(y - fromY) > COMPANION.bubbleScrollPx;
}
