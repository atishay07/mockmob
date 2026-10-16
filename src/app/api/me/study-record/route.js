import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { computeBests } from '@/lib/server/recap';
import { buildStudyRecord } from '@/lib/studyBadges';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// What the badges and personal bests need from the student's own papers, worked out here from the
// complete attempts list so the page never downloads every paper (lib/studyBadges.js is the same
// rule set as the app's; the rhythm half comes from /api/me/rhythm). Read-only, no credits, no writes.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized', message: 'Sign in to continue.' }, { status: 401, headers: NO_STORE });
  if (!(await checkPersistentRateLimit(request, { route: '/api/me/study-record', limit: 60, keyParts: [session.user.id] })).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE });
  }
  try {
    const attempts = await Database.getAttempts(session.user.id);
    return NextResponse.json(buildStudyRecord(attempts, computeBests(attempts)), { headers: NO_STORE });
  } catch (e) {
    console.error('[api/me/study-record] GET failed:', e);
    return NextResponse.json({ error: 'unavailable', message: 'Your badges and best marks could not be loaded.' }, { status: 503, headers: NO_STORE });
  }
}
