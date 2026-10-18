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
