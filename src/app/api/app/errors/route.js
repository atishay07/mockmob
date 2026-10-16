import { auth } from '@/lib/auth';
import { checkRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import { APP_ERRORS_RATE_LIMIT, handleAppErrorsPost } from '@/lib/server/appErrors';
import { loadConsentFor, recordAppErrors } from '@/lib/server/appErrorsStore';

// Self-hosted crash reports from the Android app. A small batch of scrubbed errors in, 202 out.
// Privacy: the student must be signed in and must have allowed usage data (the same consent as /api/events);
// the account id is used for that one lookup and then dropped. No user id, no IP and no user agent is stored
// or logged. The IP feeds only the in-memory rate limit. Same-day repeats of one error add to a counter.
// Kill switch: APP_ERRORS_ENABLED=off.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let userId = null;
  return handleAppErrorsPost(request, {
    env: process.env,
    rateLimit: (req) => {
      const result = checkRateLimit(req, APP_ERRORS_RATE_LIMIT);
      return { allowed: result.allowed, headers: rateLimitHeaders(result) };
    },
    authenticate: async (req) => {
      const session = await auth(req);
      userId = session?.user?.id || null;
      return !!userId;
    },
    loadConsent: () => loadConsentFor(userId),
    record: recordAppErrors,
  });
}
