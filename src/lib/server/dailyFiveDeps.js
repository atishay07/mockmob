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

let cached = null;
let daily = null;
let board = null;

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
    store: createDailyStore({ db: () => supabaseAdmin() }),
    key,
    five: (query) => dailyFive().five(query),
    mobEnabled: () => process.env.MOB_ENABLED === 'true',
    // The seat on the admit card, shown to its owner only (dailyTeam.js seatOf): the token secret, under its own label.
    seat: (userId) => seatOf(dailyFiveSecret(), userId),
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
