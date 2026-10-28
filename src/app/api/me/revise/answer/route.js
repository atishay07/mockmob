import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { Database } from '@/../data/db';
import { answerRevise } from '@/lib/server/revise';
import { ruleForQuestion } from '@/lib/server/ruleBook';
import { capFrom } from '@/../data/revise';
import COPY from '@/../data/mistake_lab.copy.json';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// One Revise recall: POST { questionId, choice } with `choice` the index into the options GET /api/me/revise sent. The server
// grades, moves the card (data/revise.js gradeCard) and returns { correct, keyIndex, explanation (the stored one, no AI), box,
// dueDay, line, rule? } only after the answer. `rule` is the student's own rule from their repair of this question (ruleForQuestion), when
// there is one. No credits, no attempts row, nothing written to the student's progress.
export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!(await checkPersistentRateLimit(request, { route: '/api/me/revise/answer', limit: 120, keyParts: [session.user.id] })).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE });
  }
  const body = await request.json().catch(() => null);
  try {
    const cap = capFrom(new URL(request.url).searchParams.get('cap'));
    const out = await answerRevise(session.user.id, { questionId: body?.questionId, choice: body?.choice }, {
      cap, ruleFor: (userId, questionId) => ruleForQuestion(userId, questionId, { attemptsOf: () => Database.getAttempts(userId) }),
    });
    return NextResponse.json(out.body, { status: out.http, headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/revise/answer] POST failed:', e?.message);
    return NextResponse.json({ ok: false, error: 'unavailable', message: COPY.revise.unavailable }, { status: 503, headers: NO_STORE });
  }
}
