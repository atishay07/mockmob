import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { todayReads } from '@/lib/server/todayReads';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// GET /api/today -> { version: 1, plan, papers, rhythm, goal, road, revise, facts, record }, each part { status, body } exactly as
// its own route answers (src/lib/server/todayReads.js). One auth check, one rate-limit count and every read together: Today
// used to make eight calls, each paying the network floor and its own auth (speed.md item 4). The rate limit runs beside
// the reads: they are reads (Revise's seeding and the expired-session finaliser are idempotent), so nothing is lost by
// starting them, and a refused count still answers 429.
export async function GET(request) {
  const session = await auth(request);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const [limit, parts] = await Promise.all([
    checkPersistentRateLimit(request, { route: '/api/today', limit: 60, keyParts: [userId] }),
    todayReads(userId),
  ]);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE });
  return NextResponse.json({ version: 1, ...parts }, { headers: NO_STORE });
}
