// NTA mode integrity policy. Pure so it can be tested: two warnings, the third strike ends the session.
// This is a deterrent enforced in the browser; it is not a server-verified proctoring record.
// The owner's rule (13 Oct, W-023): a real tab or app switch counts at once; a brief interruption under 3 s (a notification
// taking focus for a moment) does not; three warnings in all and no other grace.
export const INTEGRITY_STRIKES = 3;
/** How long the window may lose focus, with the tab still showing, before it counts. */
export const BRIEF_INTERRUPTION_MS = 3000;

export function applyViolation(count) {
  const next = Math.max(0, Math.floor(Number(count) || 0)) + 1;
  return { count: next, phase: next >= INTEGRITY_STRIKES ? 'terminated' : 'warning', remaining: Math.max(0, INTEGRITY_STRIKES - next) };
}

export function readStoredStrikes(raw) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? Math.min(n, INTEGRITY_STRIKES) : 0;
}

export const VIOLATION_LABEL = { hidden: 'You left the test tab', blur: 'The test window lost focus', fullscreen: 'You exited fullscreen', reload: 'The session was restored' };

export function createIntegrityMonitor({ count = 0, onViolation, onTerminate, briefMs = BRIEF_INTERRUPTION_MS, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id) }) {
  let strikes = readStoredStrikes(count); let active = false; let away = false; let pending = null;
  const cancelBlur = () => { if (pending !== null) { clearTimer(pending); pending = null; } };
  const monitor = {
    enter() { active = true; away = false; cancelBlur(); },
    // Focus is back: a blur that has not yet lasted briefMs is forgiven, and the next leave can count again.
    returned() { away = false; cancelBlur(); },
    stop() { active = false; cancelBlur(); },
    violation(reason) {
      if (!active || away || strikes >= INTEGRITY_STRIKES) return null;
      cancelBlur();
      away = true;
      const violation = { reason, ...applyViolation(strikes) }; strikes = violation.count;
      onViolation?.(violation);
      if (violation.phase === 'terminated') onTerminate?.();
      return violation;
    },
    // The window lost focus but the tab still shows: it counts only if focus has not come back within briefMs.
    // `stillAway` lets the page re-check the real focus when the timer fires.
    lostFocus(stillAway = () => true) {
      if (!active || away || strikes >= INTEGRITY_STRIKES || pending !== null) return;
      pending = setTimer(() => { pending = null; if (stillAway()) monitor.violation('blur'); }, briefMs);
    },
    get pendingBlur() { return pending !== null; },
    get count() { return strikes; },
  };
  return monitor;
}
