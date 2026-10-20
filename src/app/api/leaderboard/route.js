import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { standingFor } from '@/lib/server/standing';
import { createBoardCache } from '@/../data/ttl_memo';

export const dynamic = 'force-dynamic';

// The board has one row per ranked student (about 800 rows, 120 KB, growing), and the answer is only the caller's own place. The
// rows are kept two minutes per server and never returned; the caller's own tests and points are read live (their scores only), so
// a student sees their new rank straight after a mock while others' rows are at most two minutes old (egress A13, F16).
const board = createBoardCache();

// Privacy: this used to return every ranked student's name, user id and photo to anyone, signed in or not.
// It now answers only "where do I stand": the caller's own rank, the number of ranked students, and the
// caller's own tests and average. No other student is identifiable from this response.
export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const rows = await board.rowsFor(session.user.id, {
      loadRows: () => Database.getLeaderboard({ withProfile: false }),
      loadOwn: async (id) => {
        const own = await Database.getAttempts(id, { columns: ['score'] });
        return { tests: own.length, totalScore: own.reduce((sum, a) => sum + (Number(a.score) || 0), 0) };
      },
    });
    return NextResponse.json(standingFor(rows, session.user.id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('[api/leaderboard] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load your standing' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
