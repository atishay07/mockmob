import 'server-only';
// Production wiring for the Daily Five's account routes (src/lib/server/dailyFiveAccount.js has the rules) and the college
// board (src/lib/server/dailyTeam.js): Supabase (service role), the session, the database limiter, the same-origin rule and
// the token key. The routes under src/app/api/daily import dailyHandlers() or boardHandler() and nothing else.
import { auth, authWithStatus } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { mobileOptions } from '@/lib/server/mobileCors';
import { allowedWriteOrigin } from '@/lib/server/sameOriginWrite';
import { createDailyFive, createDailyWindows, dailyFiveSecret, dailyTokenKey } from '@/lib/server/dailyFive';
import { createDailyHandlers, createDailyStore } from '@/lib/server/dailyFiveAccount';
import { createBoardHandler, createTeamStore, seatOf } from '@/lib/server/dailyTeam';
import { sundayMockEnabled } from '@/lib/sundayFlag.mjs';
import { Database } from '@/../data/db';
import { readHeldQuestionIds } from '@/lib/server/heldQuestions';
import { answerRevise } from '@/lib/server/revise';
import { createDailyMine } from '@/lib/server/dailyFiveMine';
import { MINE_LIMITS, mineEnabled } from '@/lib/dailyFiveMine.mjs';

let cached = null;
let daily = null;
let board = null;
let store = null;
let mine = null;

const dailyStore = () => store || (store = createDailyStore({ db: () => supabaseAdmin() }));

/**
 * "Your five" (21 Nov 2026, src/lib/server/dailyFiveMine.js): GET /api/daily/mine, and the check's feedback into the student's
 * mistakes through the writers practice and Revise already use. Off with DAILY_MINE_ENABLED=false.
 */
function dailyMine() {
  if (mine) return mine;
  mine = createDailyMine({
    db: () => supabaseAdmin(),
    auth: (request) => auth(request),
    rateLimit: checkPersistentRateLimit,
    store: dailyStore(),
    key: dailyTokenKey(dailyFiveSecret()),
    five: (query) => dailyFive().five(query),
    held: (userId) => readHeldQuestionIds(supabaseAdmin(), userId),
    // The newest papers only, in the lean 'plan' shape the guided plan reads weak chapters from (src/lib/server/learning.js).
    attempts: (userId) => Database.getAttempts(userId, { limit: MINE_LIMITS.attempts, slim: 'plan' }),
    // Practice's own progress writer (data/db.js), as the repair check and the doubt thread call it.
    recordProgress: (args) => Database._recordAttemptProgress(args),
    answerRevise: (userId, body) => answerRevise(userId, body),
    enabled: () => mineEnabled(process.env),
  });
  return mine;
}

/** GET /api/daily/mine. */
export function mineHandler() {
  return dailyMine();
}

function dailyFive() {
  if (!daily) daily = createDailyFive({ windows: createDailyWindows({ db: () => supabaseAdmin() }), key: dailyTokenKey(dailyFiveSecret()) });
  return daily;
}

export function dailyHandlers() {
  if (cached) return cached;
  const key = dailyTokenKey(dailyFiveSecret());
  cached = createDailyHandlers({
    auth: (request) => auth(request),
    // The answer check tells a transient lookup failure from a signed-out visitor (dailyFiveAccount.js postCheck).
    authStatus: (request) => authWithStatus(request),
    rateLimit: checkPersistentRateLimit,
    // The proxy already refuses a cross-site write (src/proxy.js); the route checks it again with the same rule.
    originOk: (request) => allowedWriteOrigin({
      method: request.method,
      pathname: new URL(request.url).pathname,
      origin: request.headers.get('origin'),
      host: request.headers.get('host'),
      appOrigin: Object.keys(mobileOptions(request)).length > 0,
    }),
    store: dailyStore(),
    key,
    five: (query) => dailyFive().five(query),
    mobEnabled: () => process.env.MOB_ENABLED === 'true',
    // The seat on the admit card, shown to its owner only (dailyTeam.js seatOf): the token secret, under its own label.
    seat: (userId) => seatOf(dailyFiveSecret(), userId),
    mine: dailyMine(),
  });
  return cached;
}

/** GET /api/daily/board: the college board (public, aggregate, cached). */
export function boardHandler() {
  if (board) return board;
  board = createBoardHandler({
    rateLimit: checkPersistentRateLimit,
    store: createTeamStore({ db: () => supabaseAdmin() }),
    five: (query) => dailyFive().five(query),
    sundayOn: () => sundayMockEnabled(),
  });
  return board;
}
