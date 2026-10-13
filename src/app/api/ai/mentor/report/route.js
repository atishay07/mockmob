import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import { validateReport, storeReport } from '@/lib/server/aiReplyReport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' };

// POST { reason, reply, sessionId?, requestId? } -> the student reports one AI reply. Write-only:
// there is no read route, and the table has no browser access.
export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized', message: 'Please sign in.' }, { status: 401, headers: NO_STORE });
  const limit = checkRateLimit(request, { route: '/api/ai/mentor/report', limit: 10, keyParts: [session.user.id] });
  if (!limit.allowed) return NextResponse.json({ error: 'rate_limited', message: 'Please wait a moment before the next report.' }, { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(limit) } });
  let body;
  try { body = await request.json(); } catch { body = null; }
  const checked = validateReport(body, request.headers.get('idempotency-key'));
  if (!checked.ok) return NextResponse.json({ error: 'invalid_request', message: checked.message }, { status: 422, headers: NO_STORE });
  try {
    await storeReport(supabaseAdmin(), session.user.id, checked.value);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'unavailable', message: 'The report could not be saved. Try again shortly.' }, { status: 503, headers: NO_STORE });
  }
}
