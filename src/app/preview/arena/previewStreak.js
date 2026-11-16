// The daily streak in the preview (17 Nov 2026): GET /api/me/streak and POST/DELETE /api/me/streak/pause, computed by the real
// chain code (src/lib/chain/chain.mjs) from illustrative days, never a real account. &streak= picks the student:
//   new (no practice yet), day3 (3 days, the first rest pass), covered (yesterday kept by a rest pass, today counted),
//   makeup (yesterday still open, 4 of 10 today), paused (exam pause days, today one of them), day30 (30 days, today counted),
//   error (the read fails). Default: 12 days, one pass, 2 answered today. Pause days set here live in this tab only.
import { DAY_GOAL, MAKE_UP_EVERY, MAKE_UP_GOAL, PASS_EVERY, PASS_FIRST_AT, PASS_PER_FIXES, checkPause, computeChain } from '@/lib/chain/chain.mjs';

const DAY = 86_400_000;
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const add = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const run = (from, n, answered = (i) => 8 + ((i * 7) % 13)) => Array.from({ length: n }, (_, i) => ({ day: add(from, i), answered: typeof answered === 'function' ? answered(i) : answered }));

function fixtureInput(kind, T) {
  switch (kind) {
    case 'new': return { daily: [], pauses: [] };
    case 'day3': return { daily: [...run(add(T, -3), 3), { day: T, answered: 2 }], pauses: [] };
    case 'covered': return { daily: [...run(add(T, -10), 9), { day: T, answered: 6 }], pauses: [] };
    case 'makeup': return { daily: [...run(add(T, -3), 2), { day: T, answered: 4 }], pauses: [] };
    case 'paused': return { daily: [...run(add(T, -9), 7)], pauses: [add(T, -2), add(T, -1), T, add(T, 1), add(T, 2)] };
    case 'day30': return { daily: [...run(add(T, -30), 30).filter((d) => d.day !== add(T, -12)), { day: T, answered: 14 }], pauses: [] };
    default: return { daily: [...run(add(T, -12), 12).filter((d) => d.day !== add(T, -5)), { day: T, answered: 2 }], pauses: [] };
  }
}

const body = (input, T) => ({
  ...computeChain({ ...input, today: T }),
  rule: { answers: DAY_GOAL, makeUp: MAKE_UP_GOAL, makeUpEvery: MAKE_UP_EVERY, passFirstAt: PASS_FIRST_AT, passEvery: PASS_EVERY, passPerFixes: PASS_PER_FIXES },
});

/** Returns a Promise<Response> for the streak routes, or null for any other route. */
export function previewStreak(url, method, init, fixture, json) {
  if (url.pathname !== '/api/me/streak' && url.pathname !== '/api/me/streak/pause') return null;
  const kind = fixture.get('streak') || (fixture.get('student') === 'new' ? 'new' : 'ready');
  if (kind === 'error') return json({ error: { code: 'UNAVAILABLE', message: 'Your streak did not load. Try again shortly.' } }, 503);
  const T = istToday();
  const memo = (window.__previewStreak ||= {});
  if (!memo[kind]) memo[kind] = fixtureInput(kind, T);
  const input = memo[kind];
  if (url.pathname === '/api/me/streak' && method === 'GET') return json(body(input, T));
  if (url.pathname === '/api/me/streak/pause' && (method === 'POST' || method === 'DELETE')) {
    let sent = {};
    try { sent = JSON.parse(init?.body || '{}'); } catch { /* empty */ }
    const days = Array.isArray(sent.days) ? sent.days.map(String) : [];
    if (method === 'POST') {
      const future = input.pauses.filter((d) => d > T);
      const checked = checkPause({ days, today: T, existing: future });
      if (!checked.ok) return json({ error: { code: checked.code, message: checked.code === 'PAUSE_LIMIT' ? 'You have used the 14 pause days this season allows.' : 'Pause days have to be after today.' } }, checked.code === 'PAUSE_LIMIT' ? 409 : 422);
      input.pauses = [...new Set([...input.pauses, ...checked.days])].sort();
    } else {
      input.pauses = input.pauses.filter((d) => d <= T || !days.includes(d));
    }
    return json(body(input, T));
  }
  return json({ error: { code: 'BODY_INVALID', message: 'Something in the request was not right. Try again.' } }, 400);
}
