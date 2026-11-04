// One small signal between the landing's sample question and the hero keys. Once the first sample answer is in, the
// sample card's own key ("Next question") is the one to press, so at every width the hero's lime key steps down to the
// secondary style: one lime key in view (release 9, UI standard). On a phone the hero key is still on screen under the
// sticky nav while the sample is being answered, so a width gate left two lime keys in view there.
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
  // All five answered: from here the dock and the close band offer sign-up, not the sample again (L-009). A restart
  // of the sample does not take it back.
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

/**
 * The landing's one state-aware way in (L-006..L-009): what the hero key, the phone dock's one button and the close
 * band offer. A signed-in student goes back in; a guest who has answered all five is asked to sign up; any other guest
 * is offered the sample.
 */
export function wayIn({ signedIn = false, finished: done = false, released = false } = {}) {
  const home = { href: released ? '/recovery' : '/dashboard', label: released ? 'Find my first gap' : 'Go to Practice' };
  const signup = { href: released ? '/signup?next=%2Frecovery' : '/signup', label: 'Sign up free' };
  if (signedIn) return { state: 'signed-in', note: 'Welcome back.', dock: home, home, signup };
  if (done) return { state: 'finished', note: 'That’s all five.', dock: signup, home, signup };
  return { state: 'guest', note: 'Free to start.', dock: { href: '/#try-practice', label: 'Try a CUET question' }, home, signup };
}
