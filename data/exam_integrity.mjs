// NTA mode integrity policy. Pure so it can be tested: two warnings, the third strike ends the session.
// This is a deterrent enforced in the browser; it is not a server-verified proctoring record.
export const INTEGRITY_STRIKES = 3;
export const INTEGRITY_GRACE_MS = 2500; // permission prompts and fullscreen changes right after start never count

export function applyViolation(count) {
  const next = Math.max(0, Math.floor(Number(count) || 0)) + 1;
  return { count: next, phase: next >= INTEGRITY_STRIKES ? 'terminated' : 'warning', remaining: Math.max(0, INTEGRITY_STRIKES - next) };
}

export function readStoredStrikes(raw) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? Math.min(n, INTEGRITY_STRIKES) : 0;
}

export const VIOLATION_LABEL = { hidden: 'You left the test tab', blur: 'The test window lost focus' };
