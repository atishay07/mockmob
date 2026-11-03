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
}

// The sample's state for the desk (1104 decision 13): DemoDrill sends it after every answer and on a restart, and
// the desk listens. HeroMobi turns it into his bubble line and his act (heroTaps.mjs deskLine, deskAct); HeroRoom
// fills one bubble of Night's painted answer sheet per answer. detail: { state, answered }, where state is 'load',
// 'right', 'miss' or 'five' and answered is how many of the five are answered (0 to 5).
export const DEMO_STATE_EVENT = 'mm:demo-state';

export function sendDemoState(state, answered, target = typeof window === 'undefined' ? null : window) {
  target?.dispatchEvent?.(new CustomEvent(DEMO_STATE_EVENT, { detail: { state, answered } }));
}
