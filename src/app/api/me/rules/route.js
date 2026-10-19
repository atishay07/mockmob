import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { loadRuleSources } from '@/lib/server/ruleBook';
import { PLAYBOOK_COPY, rulesBody } from '@/lib/server/playbook';
import { openAttemptsOnly } from '@/lib/server/answerHold';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// The Rule book (spec tmp/mistake-lab-v4/SPEC.md 4.10) and Across your mocks (4.9), for the Rule book page, You (app)
// and Analytics (web): { book, acrossMocks }. Every sentence is finished here, so the website and the app say the same.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try {
    // A Mob paper still open for the Mob stays out until it closes (src/lib/mob/paperHold.mjs).
    const attempts = openAttemptsOnly(await Database.getAttempts(session.user.id));
    const sources = await loadRuleSources(session.user.id, attempts);
    return NextResponse.json(rulesBody({ attempts, sources }), { headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/rules] GET failed:', e?.message);
    return NextResponse.json({ error: 'unavailable', message: PLAYBOOK_COPY.unavailable }, { status: 503, headers: NO_STORE });
  }
}
