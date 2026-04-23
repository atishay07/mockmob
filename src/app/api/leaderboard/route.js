import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';

export async function GET() {
  try {
    const leaderboard = await Database.getLeaderboard();
    return NextResponse.json(leaderboard);
  } catch (e) {
    console.error('[api/leaderboard] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
