import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { timedMockFacts } from '@/lib/server/timedMock';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// What the "first timed mock" line needs (data/first_timed_mock.js): { sessions, mocks, timedMocks, subject } counted
// from the signed-in student's own saved sessions. Read-only; no model, no credits. A failed read is a 503, which the
// page treats as "say nothing": an unknown count is never shown as zero.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!(await checkPersistentRateLimit(request, { route: '/api/me/timed-mock', limit: 60, keyParts: [session.user.id] })).allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE });
  }
  try { return NextResponse.json(await timedMockFacts(session.user.id, supabaseAdmin()), { headers: NO_STORE }); }
  catch (e) {
    console.warn('[api/me/timed-mock] GET failed:', e?.message);
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
}
