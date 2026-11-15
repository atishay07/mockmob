import 'server-only';
// Production wiring for the Daily Five's account routes (src/lib/server/dailyFiveAccount.js has the rules): Supabase (service
// role), the session, the database limiter, the same-origin rule and the token key. The routes under src/app/api/daily import
// dailyHandlers() and nothing else.
import { auth, authWithStatus } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { mobileOptions } from '@/lib/server/mobileCors';
import { allowedWriteOrigin } from '@/lib/server/sameOriginWrite';
import { createDailyFive, createDailyWindows, dailyFiveSecret, dailyTokenKey } from '@/lib/server/dailyFive';
import { createDailyHandlers, createDailyStore } from '@/lib/server/dailyFiveAccount';

let cached = null;

export function dailyHandlers() {
  if (cached) return cached;
  const key = dailyTokenKey(dailyFiveSecret());
  const daily = createDailyFive({ windows: createDailyWindows({ db: () => supabaseAdmin() }), key });
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
    five: (query) => daily.five(query),
    mobEnabled: () => process.env.MOB_ENABLED === 'true',
  });
  return cached;
}
