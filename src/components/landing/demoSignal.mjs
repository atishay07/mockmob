// One small signal between the landing's sample question and the hero keys. Once the first sample answer is in, the
// sample card's own key ("Next question") is the one to press, so at every width the hero's lime key steps down to the
// secondary style: one lime key in view (release 9, UI standard). Its words never change ("Sign up free"), only its
// weight. On a phone the hero key is still on screen under the sticky nav while the sample is being answered, so a
// width gate left two lime keys in view there.
export const DEMO_ANSWERED_EVENT = 'mm:demo-answered';

let answered = false;

export function demoAnswered() {
  return answered;
}

export function markDemoAnswered(target = typeof window === 'undefined' ? null : window) {
  if (answered) return false;
  answered = true;
  target?.dispatchEvent?.(new Event(DEMO_ANSWERED_EVENT));
  return true;
}

export function subscribeDemoAnswered(listener, target = typeof window === 'undefined' ? null : window) {
  target?.addEventListener?.(DEMO_ANSWERED_EVENT, listener);
  return () => target?.removeEventListener?.(DEMO_ANSWERED_EVENT, listener);
}

/** The hero key's class: lime until the sample is answered, then the secondary style, at every width. */
export function heroKeyClass({ answered: isAnswered }) {
  return isAnswered ? 'mm-btn mm-btn--secondary' : 'mm-btn mm-btn--primary';
}

/** Test hook only. */
export function resetDemoSignal() {
  answered = false;
  finished = false;
}

// The sample's state for the desk (1104 decision 13): DemoDrill sends it after every answer and on a restart, and
// the desk listens. HeroMobi turns it into his bubble line and his act (heroTaps.mjs deskLine, deskAct); HeroRoom
// fills one bubble of Night's painted answer sheet per answer. detail: { state, answered }, where state is 'load',
// 'right', 'miss' or 'five' and answered is how many of the five are answered (0 to 5).
export const DEMO_STATE_EVENT = 'mm:demo-state';

let finished = false;

export function sendDemoState(state, answered, target = typeof window === 'undefined' ? null : window) {
  // All five answered: the sample's own end state offers sign-up (DemoDrill). A restart does not take it back.
  if (state === 'five' || answered >= 5) finished = true;
  target?.dispatchEvent?.(new CustomEvent(DEMO_STATE_EVENT, { detail: { state, answered } }));
}

/** True once a guest has answered all five sample questions on this page view. */
export function demoFinished() {
  return finished;
}

export function subscribeDemoState(listener, target = typeof window === 'undefined' ? null : window) {
  target?.addEventListener?.(DEMO_STATE_EVENT, listener);
  return () => target?.removeEventListener?.(DEMO_STATE_EVENT, listener);
}

/** The phone bar's volt key for a guest (round 4, owner LK135; the same on every public page, PublicDock): the way in in
 *  two words, and one true line under them (sign-up asks for no card: the close band's own "Free to start. No card needed."). */
export const DOCK_GO = Object.freeze({ label: 'Start free', sub: 'No card needed' });

/** The sample's way in: same-page, so DemoJump brings the question card on screen. */
export const SAMPLE = Object.freeze({ href: '/#try-practice', label: 'Try 5 questions first' });

/**
 * The landing's ways in (owner decision LK83/LK88, 5 Nov 2026; supersedes the 4 Nov "the dock follows the sample"
 * rule). Sign up and log in lead; the five questions are the sample.
 *   hero    guest: "Sign up free" (volt), "Try 5 questions first" (secondary), then "Have an account? Log in";
 *           signed in: one key back in.
 *   dock    guest: ghost "Log in" beside the volt "Start free" with its true line "No card needed" inside the key (round 4,
 *           owner LK135: the bar's CTA was weak; dock.css), the same from the hero to the footer; signed in: one key.
 *   close   guest: "Sign up free" and "Log in"; signed in: one key.
 * Nothing here reads the sample's state: a reader who answers the five never sees a key change its label.
 */
export function wayIn({ signedIn = false, released = false } = {}) {
  const home = Object.freeze({ href: released ? '/recovery' : '/dashboard', label: released ? 'Find my first gap' : 'Go to Practice' });
  const signup = Object.freeze({ href: released ? '/signup?next=%2Frecovery' : '/signup', label: 'Sign up free' });
  const login = Object.freeze({ href: '/login', label: 'Log in' });
  if (signedIn) return { state: 'signed-in', dock: { primary: home, secondary: null, sub: null }, home, signup, login };
  return { state: 'guest', dock: { primary: { href: signup.href, label: DOCK_GO.label }, secondary: login, sub: DOCK_GO.sub }, home, signup, login };
}
