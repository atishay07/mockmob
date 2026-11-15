import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import { createDailyFive, createDailyWindows, dailyFiveSecret, dailyTokenKey, parseDailyQuery } from '@/lib/server/dailyFive';
import { msUntilNextDay } from '@/lib/dailyFive.mjs';
import {
  failRequestDiagnostics,
  finishRequestDiagnostics,
  startRequestDiagnostics,
} from '@/lib/server/requestDiagnostics';

// GET /api/daily?day=<n>: today's Daily Five (src/lib/dailyFive.mjs), the same five CUET questions for every visitor, for the
// public page /daily. Public, no sign-in. Every question comes from the public sample's windows (readDailyWindow, the sample's
// own window step for step; the rules in src/lib/server/dailyFive.js and src/lib/server/demoSample.js), in the sample's shape,
// each with its sealed token for a signed-in student's save (POST /api/daily/me). No question id leaves.
//
// Caching: the day is in the address and only today is served, so the CDN keeps one answer per day, until 12:00 am IST and no
// longer (no stale serving: after midnight the old day is refused here and the page asks for the new one). Browsers keep it
// five minutes at most. Anything that is not an answer (a bad or past day, the limit, too few questions, a failure) is never
// cached. Every answer is tagged `demo-sample` and `daily-five`, so the sample's runbook purge
// (`vercel cache dangerously-delete --tag demo-sample`, src/app/api/sample/route.js) clears these too.

export const dynamic = 'force-dynamic';

const ROUTE = '/api/daily';
const DAILY_RATE_LIMIT = 30;
const NO_STORE = { 'Cache-Control': 'no-store' };
const CACHE_TAGS = { 'Vercel-Cache-Tag': 'demo-sample,daily-five' };

/** Cached until the IST day ends: the CDN for the rest of the day, a browser for five minutes at most. */
function untilMidnight(now) {
  const seconds = Math.max(1, Math.floor(msUntilNextDay(now) / 1000));
  return { 'Cache-Control': `public, max-age=${Math.min(300, seconds)}`, 'CDN-Cache-Control': `public, s-maxage=${seconds}` };
}

const daily = createDailyFive({ windows: createDailyWindows({ db: () => supabaseAdmin() }), key: dailyTokenKey(dailyFiveSecret()) });

function reply(context, status, body, headers) {
  const response = Response.json(body, { status, headers });
  finishRequestDiagnostics(context, { status });
  return response;
}

export async function GET(request) {
  const diagnostics = startRequestDiagnostics(request, ROUTE);
  try {
    // Checked first: a day that is not today never reaches the limiter or the database. The answer names today, so a page on
    // a wrong clock can ask again.
    const query = parseDailyQuery(request.nextUrl.searchParams);
    if (!query.ok) return reply(diagnostics, 400, { error: query.error, day: query.today.day, date: query.today.date }, NO_STORE);

    const limit = await checkPersistentRateLimit(request, { route: ROUTE, limit: DAILY_RATE_LIMIT, fallback: 'memory' });
    if (!limit.allowed) return reply(diagnostics, 429, { error: 'Too many requests' }, { ...NO_STORE, ...rateLimitHeaders(limit) });

    const answer = await daily.get(query);
    if (!answer) return reply(diagnostics, 503, { state: 'unavailable', error: 'Not enough questions for today’s five yet' }, NO_STORE);
    return reply(diagnostics, 200, answer, { ...untilMidnight(Date.now()), ...CACHE_TAGS });
  } catch (error) {
    failRequestDiagnostics(diagnostics, error);
    return Response.json({ state: 'unavailable', error: 'Daily Five unavailable' }, { status: 503, headers: NO_STORE });
  }
}
