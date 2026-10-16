import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { getRevise } from '@/lib/server/revise';
import { capFrom } from '@/../data/revise';
import COPY from '@/../data/mistake_lab.copy.json';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Revise (feature wave F1; data/revise.js, spec tmp/mistake-lab-v4/SPEC.md 4.8): the student's own wrong answers come back
// after 1, 3, 7 and 21 days, at most 10 a day (`?cap=5` for 5). GET seeds the cards from the student's newest wrong answers
// (idempotent) and returns today's questions with the stem and options and NO key. It costs no credits and writes no attempts
// row. If the table is missing the body says state 'unavailable' and every surface hides itself.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!(await checkPersistentRateLimit(request, { route: '/api/me/revise', limit: 60, keyParts: [session.user.id] })).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE });
  }
  try {
    const cap = capFrom(new URL(request.url).searchParams.get('cap'));
    const out = await getRevise(session.user.id, { cap });
    return NextResponse.json(out.body, { status: out.http, headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/revise] GET failed:', e?.message);
    return NextResponse.json({ version: 1, state: 'unavailable', message: COPY.revise.unavailable, items: [] }, { status: 503, headers: NO_STORE });
  }
}
