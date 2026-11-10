import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import { createDemoSample, parseDemoQuery } from '@/lib/server/demoSample';
import {
  failRequestDiagnostics,
  finishRequestDiagnostics,
  startRequestDiagnostics,
} from '@/lib/server/requestDiagnostics';

// GET /api/sample?subject=<slug>&set=<0..5>: five live questions of one CUET subject for the home page's sample card
// ("Not your subject?", round 4 H3, LK123). Public, no sign-in. It returns only what the card shows (the stem, four
// options, the right one's place, the reason, the chapter and any verified past-paper year and relationship). The rules, bounded window and egress are in
// src/lib/server/demoSample.js.
//
// Caching: the answer for a subject and set is the same for everyone and changes only when the bank does, so the CDN keeps
// it a day and serves it stale for a week while it refreshes (the whole key space is 15 subjects x 6 sets); browsers keep
// it five minutes. Anything that is not an answer (a bad query, the limit, a thin subject, a failure) is never cached.
// Every answer is tagged `demo-sample` (and `demo-sample-<slug>`). Runbook: after pulling or freezing a question, run
// `vercel cache dangerously-delete --tag demo-sample` (90 entries at most, so no stampede); each server then reads its
// window again within DEMO_POOL_TTL_MS (an hour), or at once on a redeploy (docs/design-decisions/web-r4-demo.md).

export const dynamic = 'force-dynamic';

const ROUTE = '/api/sample';
const SAMPLE_RATE_LIMIT = 30;
const NO_STORE = { 'Cache-Control': 'no-store' };
const CACHED = { 'Cache-Control': 'public, max-age=300', 'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' };
const cacheTags = (slug) => ({ 'Vercel-Cache-Tag': `demo-sample,demo-sample-${slug}` });

const sample = createDemoSample({ db: () => supabaseAdmin() });

function reply(context, status, body, headers) {
  const response = Response.json(body, { status, headers });
  finishRequestDiagnostics(context, { status });
  return response;
}

export async function GET(request) {
  const diagnostics = startRequestDiagnostics(request, ROUTE);
  try {
    // Checked first: a query that names no offered subject or set never reaches the limiter or the database.
    const query = parseDemoQuery(request.nextUrl.searchParams);
    if (!query.ok) return reply(diagnostics, 400, { error: query.error }, NO_STORE);

    const limit = await checkPersistentRateLimit(request, { route: ROUTE, limit: SAMPLE_RATE_LIMIT, fallback: 'memory' });
    if (!limit.allowed) return reply(diagnostics, 429, { error: 'Too many requests' }, { ...NO_STORE, ...rateLimitHeaders(limit) });

    const answer = await sample.get(query);
    if (!answer) return reply(diagnostics, 503, { state: 'unavailable', error: 'Not enough questions in this subject for a sample yet' }, NO_STORE);
    return reply(diagnostics, 200, answer, { ...CACHED, ...cacheTags(query.slug) });
  } catch (error) {
    failRequestDiagnostics(diagnostics, error);
    return Response.json({ state: 'unavailable', error: 'Sample unavailable' }, { status: 503, headers: NO_STORE });
  }
}
