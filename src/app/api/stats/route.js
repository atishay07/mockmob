import { publicInventory } from '@/lib/server/inventory';
import { publicStatsView } from '@/lib/server/publicStats';
import { checkPersistentRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import {
  failRequestDiagnostics,
  finishRequestDiagnostics,
  startRequestDiagnostics,
} from '@/lib/server/requestDiagnostics';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/stats';
const STATS_RATE_LIMIT = 120;

function jsonWithDiagnostics(context, body, init) {
  const response = Response.json(body, init);
  finishRequestDiagnostics(context, { status: response.status });
  return response;
}

export async function GET(request) {
  const diagnostics = startRequestDiagnostics(request, ROUTE);
  try {
    const rateLimit = await checkPersistentRateLimit(request, {
      route: ROUTE,
      limit: STATS_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return jsonWithDiagnostics(
        diagnostics,
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }

    // Stored counts only (refreshed once a day). Without them, the same 503 "unavailable" answer as a failure.
    const inventory = await publicInventory();
    if (inventory?.state !== 'available') {
      return jsonWithDiagnostics(diagnostics, { state: 'unavailable', reason: inventory?.reason, error: 'Question counts unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    // Public subjects only: the stored total also holds thin subjects and the four papers CUET dropped.
    // The counts change once a day (the 21:30 UTC refresh), so Vercel's CDN keeps the answer for an hour and serves it stale for a
    // day while it refreshes (speed.md item 11): max-age alone was answered MISS on every visit. Browsers still keep it 30 s.
    return jsonWithDiagnostics(diagnostics, publicStatsView(inventory), { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=30', 'CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch (error) {
    failRequestDiagnostics(diagnostics, error);
    return Response.json({ state: 'unavailable', error: 'Question counts unavailable' }, { status: 503, headers: { 'Cache-Control':'no-store' } });
  }
}
