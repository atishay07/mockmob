// Haptics on the web: the same small vocabulary the app has, with the vibrate patterns it shares through
// shared/motion-tokens.json (generated into src/lib/motion/tokens.g.js as `haptics`).
//
//   tick         a key, a choice, a tap on an object      settle   something comes to rest
//   open         a sheet or a story opens                 warn     a limit was reached
//   confirm      the server has acknowledged a save       segmentTick  one step of a scrub or dial
//   toggle(on)   a switch flips (a firmer tick on, a softer one off)
//
// Rules, the app's: only where the browser can vibrate (Android Chrome), only with Touch feedback on
// (Look and feel; html[data-touch='off'] and the mm:touch:v1 key), only while the page is visible, and
// never on a wrong answer or an error. `confirm` is for after the server answered, not when the
// student pressed. gestureStart and gestureEnd are empty patterns, so they do nothing here.
//
// Nothing is imported from React: this is plain functions, safe to call from any handler and to test.

import { haptics } from './motion/tokens.g.js';

export const TOUCH_KEY = 'mm:touch:v1';

/** The vibrate pattern for a haptic's name, or an empty array for a name that is not one. */
export function hapticPattern(name) {
  const pattern = haptics[name];
  return pattern ? Array.from(pattern) : [];
}

/**
 * Whether a haptic may play in this environment: { navigator, document, storage }, each optional.
 * Pure, so the rules can be tested without a browser.
 */
export function mayVibrate({ navigator: nav, document: doc, storage } = {}) {
  try {
    if (!nav || typeof nav.vibrate !== 'function') return false;
    if (!/Android/i.test(nav.userAgent || '')) return false;
    if (doc) {
      if (doc.visibilityState && doc.visibilityState !== 'visible') return false;
      if (doc.documentElement?.dataset?.touch === 'off') return false;
    }
    if (storage?.getItem?.(TOUCH_KEY) === 'off') return false;
    return true;
  } catch {
    return false;
  }
}

function browserEnv() {
  if (typeof window === 'undefined') return {};
  let storage = null;
  try { storage = window.localStorage; } catch { /* Storage blocked: Touch feedback stays on, its default. */ }
  return { navigator: window.navigator, document: window.document, storage };
}

/** Plays a haptic by name. Returns true when the browser was asked to vibrate. */
export function haptic(name, env = browserEnv()) {
  const pattern = hapticPattern(name);
  if (!pattern.length || !mayVibrate(env)) return false;
  try { return Boolean(env.navigator.vibrate(pattern)); } catch { return false; }
}

export const tick = () => haptic('tick');
export const settle = () => haptic('settle');
export const open = () => haptic('open');
export const warn = () => haptic('warn');
export const confirm = () => haptic('confirm');
export const segmentTick = () => haptic('segmentTick');
export const toggle = (on) => haptic(on ? 'toggleOn' : 'toggleOff');
