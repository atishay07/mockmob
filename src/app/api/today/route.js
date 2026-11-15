import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { todayReads } from '@/lib/server/todayReads';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// GET /api/today -> { version: 1, plan, papers, rhythm, goal, road, revise, facts, record }, each part { status, body } exactly as
// its own route answers (src/lib/server/todayReads.js). One auth check, one rate-limit count and every read together: Today
// used to make eight calls, each paying the network floor and its own auth (speed.md item 4). L7 (15 Nov 2026): the rate
// limit is answered before any read: a refused request does none of the 15 or so reads (the limit is in memory in
// production, so running it beside them saved nothing).
export async function GET(request) {
  const session = await auth(request);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const limit = await checkPersistentRateLimit(request, { route: '/api/today', limit: 60, keyParts: [userId] });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE });
  const parts = await todayReads(userId);
  return NextResponse.json({ version: 1, ...parts }, { headers: NO_STORE });
}
