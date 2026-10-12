import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRhythm } from '@/lib/server/appPrefs';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Study days, weekly goal, streak of met weeks, welcome-back flag and milestones from real records.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try { return NextResponse.json(await getRhythm(session.user.id), { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}
