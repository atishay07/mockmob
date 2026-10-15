import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { atlasForAttempts } from '@/lib/server/trapAtlas';
import { buildTrapsMeet } from '@/../data/trap_atlas';
import COPY from '@/../data/mistake_lab.copy.json';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// "Traps you meet" (spec tmp/mistake-lab-v4/SPEC.md 4.11), for the Rule book and Find, on the website and in the app: how
// often the student picked a wrong option that carries a named trap, with every sentence finished here
// (data/trap_atlas.js buildTrapsMeet, contract_traps_v1.json `sheet`). Read-only, no model call, no credit. If the atlas
// cannot be read, the rows still come from the question formats; a failure of the student's own attempts is a 503.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!(await checkPersistentRateLimit(request, { route: '/api/me/traps', limit: 60, keyParts: [session.user.id] })).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE });
  }
  try {
    const attempts = await Database.getAttempts(session.user.id);
    let atlas = null;
    try { atlas = await atlasForAttempts(attempts); } catch (e) { console.warn('[api/me/traps] atlas skipped:', e?.message); }
    return NextResponse.json(buildTrapsMeet({ attempts, atlas }), { headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/traps] GET failed:', e?.message);
    return NextResponse.json({ error: 'unavailable', message: COPY.traps.unavailable }, { status: 503, headers: NO_STORE });
  }
}
