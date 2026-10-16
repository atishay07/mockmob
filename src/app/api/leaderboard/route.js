import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { standingFor } from '@/lib/server/standing';

export const dynamic = 'force-dynamic';

// Privacy: this used to return every ranked student's name, user id and photo to anyone, signed in or not.
// It now answers only "where do I stand": the caller's own rank, the number of ranked students, and the
// caller's own tests and average. No other student is identifiable from this response.
export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const rows = await Database.getLeaderboard();
    return NextResponse.json(standingFor(rows, session.user.id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('[api/leaderboard] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load your standing' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
