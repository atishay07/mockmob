// The production deps of /api/me/streak (src/lib/server/streak.js): the session (web cookie or the app's Bearer token), the
// persistent rate limit, the app's CORS, and the chain service with the same reads the Mob den's chain uses (late papers left
// out, Daily Fives and repairs merged), so the den, Today, You and the top bar print one number. No Mob switch applies here.
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { mobileOptions } from '@/lib/server/mobileCors';
import { readLatePapersSoft } from '@/lib/server/latePapers';
import { createStreakExtrasReader, readStreakExtras } from '@/lib/server/streakDays';
import { createChainService } from '@/lib/server/chain';

async function rpc(name, params) {
  const { data, error } = await supabaseAdmin().rpc(name, params);
  if (error) throw error;
  return data;
}

let cached = null;
export function streakDeps() {
  if (!cached) {
    cached = {
      auth: (request) => auth(request),
      rateLimit: checkPersistentRateLimit,
      cors: mobileOptions,
      service: createChainService({
        rpc,
        latePapers: (userId) => readLatePapersSoft(supabaseAdmin(), { userId }),
        // The past days are kept per student for 10 minutes; only today's rows are read between (streakDays.js).
        extraDays: createStreakExtrasReader({ read: (userId, fromDay) => readStreakExtras(supabaseAdmin(), userId, fromDay) }),
      }),
    };
  }
  return cached;
}
