// In-product funnel steps for a signed-in student, counted once per person (first practice started and so on).
// Pure rules, no I/O: funnelOnceStore.js supplies the database call and after(). The funnel_daily table never
// receives an id: the id is only handed to funnel_count_once, which flags the step on the person's own users
// row and adds 1 to the aggregate counter in the same transaction (migration 20261016120000).
import { ONCE_PER_USER_STEPS } from '../funnelSteps.js';
import { funnelEnabled, platformFromUserAgent } from './funnel.js';

// Decide whether the server counts in-product steps for a signed-in user, and under which platform. Same
// privacy rules as the sign-up count (kill switch, Do Not Track, Global Privacy Control), no bot filter
// (the person is signed in). Only steps on the once-per-user list pass. headers is a Headers or null (no
// request in scope: counted as "other").
export function evaluateUserStepCount({ headers, steps, env = process.env } = {}) {
  if (!funnelEnabled(env)) return { ok: false, reason: 'disabled' };
  if (headers?.get?.('dnt') === '1' || headers?.get?.('sec-gpc') === '1') return { ok: false, reason: 'privacy_signal' };
  const list = [...new Set(Array.isArray(steps) ? steps : [steps])].filter((step) => ONCE_PER_USER_STEPS.includes(step));
  if (list.length === 0) return { ok: false, reason: 'unknown_step' };
  return { ok: true, steps: list, platform: platformFromUserAgent(headers?.get?.('user-agent')) };
}

// Fire-and-forget counter for in-product steps. countOnce(userId, steps, headers) returns nothing, never
// throws and never waits: the work is handed to schedule (Next's after() in production, so it finishes after
// the response is sent) and every failure is swallowed, so it can never block or fail the user's request.
// rpc(name, args) is the database call; each step is claimed by funnel_count_once, which flags the step on
// the user's own row and adds to the daily counter in one transaction, so a person counts once per step and
// the funnel table never holds an id. Only a database error code is ever logged.
export function createStepCounter({ rpc, schedule, env, warn = () => {} } = {}) {
  return function countOnce(userId, steps, headers = null) {
    try {
      if (typeof userId !== 'string' || !userId) return;
      const decision = evaluateUserStepCount({ headers, steps, env: env || process.env });
      if (!decision.ok) return;
      const work = async () => {
        for (const step of decision.steps) {
          try {
            const { error } = await rpc('funnel_count_once', { p_user_id: userId, p_step: step, p_platform: decision.platform });
            if (error) warn('[funnel] count once failed', error.code || 'unknown');
          } catch {
            warn('[funnel] count once failed', 'exception');
          }
        }
      };
      try { (schedule || ((fn) => { void fn(); }))(work); } catch { void work(); }
    } catch { /* counting never breaks a request */ }
  };
}

// Which once-per-user steps a finished /api/sessions call earns. kind is 'start' or 'finish' (given by the
// route, because /api/attempts re-exports the finish handler under POST).
// A resumed session (body.sessionId on POST) and the one-question delayed check (episode) are not a first
// practice. A timed mock is the full-length Full mock or NTA mode. result is what the route is about to send.
export function funnelStepsForSession({ kind, body, result } = {}) {
  if (kind === 'start') {
    if (!body || body.sessionId || body.episodeId) return [];
    if (!result || result.error) return [];
    return ['first_practice_started'];
  }
  if (kind === 'finish') {
    const meta = result?.selectionMeta;
    if (!result || result.error || !result.id || meta?.episodeId) return [];
    const steps = ['first_practice_finished'];
    if (['full', 'nta'].includes(result.mode || meta?.mode)) steps.push('first_mock_finished');
    return steps;
  }
  return [];
}
