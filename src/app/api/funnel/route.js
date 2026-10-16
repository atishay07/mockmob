import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import { evaluateFunnelRequest, funnelEnabled, FUNNEL_RATE_LIMIT, MAX_BODY_BYTES } from '@/lib/server/funnel';
import { incrementFunnel } from '@/lib/server/funnelStore';

// Aggregate landing funnel. Accepts one step name and adds 1 to today's counter for that step and for
// the platform category the server derives from the User-Agent (desktop, android_web, ios_web,
// android_app, other). signup_complete is refused here: the server counts it itself (src/lib/auth.ts).
// Privacy: no cookie is read or set, no user id, no IP and no user agent is stored or logged; only the
// platform category is kept. The IP feeds only
// the in-memory rate limit (never the persistent limiter, which would write a hashed IP to the database). Every outcome except a rate limit is an empty 204, so the bot filter cannot be
// probed from outside. Kill switch: counting runs only when FUNNEL_ENABLED is "true".
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const quiet = { 'Cache-Control': 'no-store' };
const noContent = () => new NextResponse(null, { status: 204, headers: quiet });

export async function POST(request) {
  if (!funnelEnabled()) return noContent();
  const limit = checkRateLimit(request, FUNNEL_RATE_LIMIT);
  if (!limit.allowed) return new NextResponse(null, { status: 429, headers: { ...quiet, ...rateLimitHeaders(limit) } });
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return noContent();
  let bodyText = '';
  try { bodyText = await request.text(); } catch { return noContent(); }
  const decision = evaluateFunnelRequest({ headers: request.headers, bodyText });
  if (!decision.ok) return noContent();
  await incrementFunnel(decision.step, decision.platform);
  return noContent();
}
