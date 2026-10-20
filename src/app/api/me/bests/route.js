import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { computeBests } from '@/lib/server/recap';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Best and latest marks per comparable format (same subject, mode, count, duration, scoring version).
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized', message: 'Sign in to continue.' }, { status: 401, headers: NO_STORE });
  try {
    // Bests read marks, mode, scoring version and the question ids of the snapshot (retakes), never the answers.
    // Through the summary function: the snapshot ids, the marks and the meta stay, the rest of each question does not travel.
    const attempts = await Database.getAttempts(session.user.id, { slim: 'summary' });
    return NextResponse.json({ bests: computeBests(attempts) }, { headers: NO_STORE });
  } catch (e) {
    console.error('[api/me/bests] GET failed:', e);
    return NextResponse.json({ error: 'unavailable', message: 'Your best marks could not be loaded.' }, { status: 503, headers: NO_STORE });
  }
}
