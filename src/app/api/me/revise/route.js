import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { getRevise } from '@/lib/server/revise';
import { loadReviewRecord } from '@/lib/server/review';
import { studyRecord } from '@/lib/server/study';
import { capFrom } from '@/../data/revise';
import COPY from '@/../data/mistake_lab.copy.json';
import { keyCardsEnabled } from '@/lib/server/keycards';
import { keycardsService } from '@/lib/server/keycardsHttp';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Revise (feature wave F1; data/revise.js, spec tmp/mistake-lab-v4/SPEC.md 4.8): the student's own wrong answers come back
// after 1, 3, 7 and 21 days, at most 10 a day (`?cap=5` for 5). GET seeds the cards from the student's newest wrong answers
// (idempotent) and returns today's questions with the stem and options and NO key. It costs no credits and writes no attempts
// row. If the table is missing the body says state 'unavailable' and every surface hides itself.
// With `?queue=1` the body also carries `queue` (LEARN-REVIEW-1017 5.8, src/components/revise/reviseQueue.js): Revise as one queue over the due
// questions, the repaired mistakes, the pending Check it held and the lesson cards due, deduped by question and capped.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!(await checkPersistentRateLimit(request, { route: '/api/me/revise', limit: 60, keyParts: [session.user.id] })).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE });
  }
  try {
    const cap = capFrom(new URL(request.url).searchParams.get('cap'));
    const userId = session.user.id;
    // `?queue=1` (the Revise run) adds the merged queue; Review's entry row reads the plain body and stays cheap.
    const wantsQueue = new URL(request.url).searchParams.get('queue') === '1';
    // Key cards due (KEYCARDS-BUILD-SPEC.md 2e): only while KEY_CARDS_ENABLED is on; a failed read leaves them out.
    const readKeyCards = keyCardsEnabled() ? async () => (await keycardsService()).reviseSource(userId) : null;
    const out = await getRevise(userId, {
      cap,
      keyCards: wantsQueue ? null : readKeyCards,
      queue: !wantsQueue ? null : {
        loadRecord: (id, deps) => loadReviewRecord(id, deps),
        // Lesson cards due today, and how many a recall run would play (due plus new cards of lessons already read, for
        // ?source=cards: Today's "Lock in new cards" lands there). None when Concepts is off, unknown (null) when the read fails.
        readDueCards: async () => {
          const record = await studyRecord(userId, { allSubjects: true });
          if (record?.state === 'disabled') return { due: 0, available: 0 };
          if (!Number.isFinite(record?.progress?.dueCards)) return null;
          return { due: record.progress.dueCards, available: Array.isArray(record.queue?.items) ? record.queue.items.length : record.progress.dueCards };
        },
        ...(readKeyCards ? { readKeyCards } : {}),
      },
    });
    return NextResponse.json(out.body, { status: out.http, headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/revise] GET failed:', e?.message);
    return NextResponse.json({ version: 1, state: 'unavailable', message: COPY.revise.unavailable, items: [] }, { status: 503, headers: NO_STORE });
  }
}
