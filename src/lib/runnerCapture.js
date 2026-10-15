// What the timed runner records for the Mistake Lab (spec tmp/mistake-lab-v4/SPEC.md 6): every event of the paper's
// record is built here, so the runner (src/app/(app)/test/TestPageClient.jsx) only says what happened.
//
// Capture is invisible data. Nothing here renders, holds React state, prevents or stops an event, or changes what the
// student sees or when; inside a timed NTA paper the page, its timer and its integrity guard behave exactly as they
// did before capture (data/tests/runner_nta_ui.test.mjs renders the NTA runner with and without capture and
// compares the page after every step). The server checks every event (data/recovery.js scoreSession) and
// data/paper_trace.js reads them after submit.
//
// The events, each with seq (rising by one), qid (the question on screen) and at (ms on the paper clock):
//   answer {answer}   mark {marked}   visit {via?}   strike {option, on}   away   back   end {reason}
import { useEffect } from 'react';
import { END_REASONS, MAX_SESSION_EVENTS, VISIT_VIA } from '@/../data/recovery';

/** The capture this runner sends, as `client.appVersion`: "runner.2", with the build's commit when known. */
export const RUNNER_CAPTURE = 2;
const COMMIT = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '').slice(0, 12);
export const RUNNER_VERSION = /^[0-9a-f]{7,12}$/.test(COMMIT) ? `runner.${RUNNER_CAPTURE}+${COMMIT}` : `runner.${RUNNER_CAPTURE}`;

/**
 * The next event of the record, or null when none may be added (no start yet, no question, the 5,000-event cap,
 * or a value the server would refuse). `clock` is { startedAt, now, limitMs }: `at` is ms since the device's start
 * and never earlier than the previous event. Only an end is held to the paper's limit (limitMs, the paper's own
 * length); every other type keeps its own time, exactly as before.
 *   answer: the served index or null   mark: true or false   visit: how it was reached (VISIT_VIA) or nothing
 *   strike: { option, on }             away, back: nothing  end: END_REASONS
 * A time-up end is the limit itself. The runner submits when its countdown shows 0:00, which it does for the whole
 * last second, so the device's own clock reads up to a second short of the limit; time ran out at the limit.
 */
export function nextEvent(events, clock, qid, type, value) {
  if (!Array.isArray(events) || !clock?.startedAt || !qid || events.length >= MAX_SESSION_EVENTS) return null;
  const prior = events.at(-1);
  const elapsed = clock.now - clock.startedAt;
  const limited = Number.isFinite(clock.limitMs);
  const base = (at) => ({ seq: (prior?.seq || 0) + 1, qid, type, at: Math.max(prior?.at || 0, at) });
  switch (type) {
    case 'answer': return { ...base(elapsed), answer: value };
    case 'mark': return { ...base(elapsed), marked: value === true };
    case 'visit': return VISIT_VIA.includes(value) ? { ...base(elapsed), via: value } : base(elapsed);
    case 'strike':
      return Number.isInteger(value?.option) && value.option >= 0 && typeof value.on === 'boolean' ? { ...base(elapsed), option: value.option, on: value.on } : null;
    case 'away': case 'back': return base(elapsed);
    case 'end':
      if (!END_REASONS.includes(value)) return null;
      return { ...base(!limited ? elapsed : value === 'time_up' ? clock.limitMs : Math.min(elapsed, clock.limitMs)), reason: value };
    default: return null;
  }
}

/**
 * The question on screen as the record has it: the question the last event named (the paper trace credits time to
 * it until the next event), else the runner's current question. On a passage page this is the question last
 * answered or marked; elsewhere it is the one question shown.
 */
export function onScreenQid(events, fallback) {
  return (Array.isArray(events) ? events.at(-1)?.qid : null) || fallback || null;
}

/**
 * Why the paper ends: the reason named now, else the reason of an end already in the record (a submit retried after
 * a failure keeps its first reason, so a time-up stays a time-up), else a plain submit.
 */
export function endReason(events, named) {
  if (END_REASONS.includes(named)) return named;
  const earlier = Array.isArray(events) ? events.findLast((e) => e?.type === 'end') : null;
  return END_REASONS.includes(earlier?.reason) ? earlier.reason : 'submit';
}

/** The submit's additive fields (spec 6, item 6): which runner, its start on this device, and how the paper ended. */
export function captureMeta({ startedAt, endedBy }) {
  return {
    client: { platform: 'web', appVersion: RUNNER_VERSION, ...(Number.isFinite(startedAt) && startedAt > 0 ? { startedAt: Math.round(startedAt) } : {}) },
    ...(END_REASONS.includes(endedBy) ? { endedBy } : {}),
  };
}

/**
 * Time away from the paper, in every mode: calls onPresence('away') when the tab is hidden and onPresence('back')
 * when it is shown again (and 'away' at once if it starts hidden). It only listens. The NTA integrity guard keeps
 * its own listener (src/components/arena/ExamIntegrityGuard.jsx) and is not touched or informed.
 */
export function usePresenceCapture(enabled, onPresence) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;
    const read = () => onPresence(document.visibilityState === 'hidden' ? 'away' : 'back');
    document.addEventListener('visibilitychange', read);
    if (document.visibilityState === 'hidden') onPresence('away');
    return () => document.removeEventListener('visibilitychange', read);
  }, [enabled, onPresence]);
}
