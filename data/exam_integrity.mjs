// NTA mode integrity policy. Pure so it can be tested: two warnings, the third strike ends the session.
// This is a deterrent enforced in the browser; it is not a server-verified proctoring record.
export const INTEGRITY_STRIKES = 3;

export function applyViolation(count) {
  const next = Math.max(0, Math.floor(Number(count) || 0)) + 1;
  return { count: next, phase: next >= INTEGRITY_STRIKES ? 'terminated' : 'warning', remaining: Math.max(0, INTEGRITY_STRIKES - next) };
}

export function readStoredStrikes(raw) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? Math.min(n, INTEGRITY_STRIKES) : 0;
}

export const VIOLATION_LABEL = { hidden: 'You left the test tab', blur: 'The test window lost focus', fullscreen: 'You exited fullscreen', reload: 'The session was restored' };

export function createIntegrityMonitor({ count = 0, onViolation, onTerminate }) {
  let strikes = readStoredStrikes(count); let active = false; let away = false;
  return {
    enter() { active = true; away = false; },
    returned() { away = false; },
    stop() { active = false; },
    violation(reason) {
      if (!active || away || strikes >= INTEGRITY_STRIKES) return null;
      away = true;
      const violation = { reason, ...applyViolation(strikes) }; strikes = violation.count;
      onViolation?.(violation);
      if (violation.phase === 'terminated') onTerminate?.();
      return violation;
    },
    get count() { return strikes; },
  };
}
