import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { isPaidUser, readAIWallet } from '@/services/credits/aiCreditWallet';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { getReview } from '@/lib/server/review';
import { studyRecord } from '@/lib/server/study';
import { istDate } from '@/lib/server/credits';
import { capFrom } from '@/../data/revise';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Review in one read (LEARN-REVIEW-1017, packet P-LR0; src/lib/server/review.js): the student's papers, every mistake across
// them with its paper, its time and its saved repair, the receipt (found, repaired, retested, still right), what Revise has
// due today and the chapters priced in marks. READ-ONLY: it seeds no Revise cards, writes no ledger row and spends nothing.
// It never carries an answer key, an option or an explanation. `?cap=5` sets Revise's daily cap to 5 (default 10).
// A failed read of the papers or of the saved repairs answers 503 { state: 'unavailable' }, never the empty state.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized', message: 'Please sign in.' }, { status: 401, headers: NO_STORE });
  if (!(await checkPersistentRateLimit(request, { route: '/api/me/review', limit: 60, keyParts: [session.user.id], fallback: 'memory' })).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '30' } });
  }
  const userId = session.user.id;
  try {
    const cap = capFrom(new URL(request.url).searchParams.get('cap'));
    // The wallet and the lesson cards are best effort: unknown is null, never zero.
    const wallet = await Database.getUserById(userId).then(async (user) => {
      if (!user) return null;
      const ai = await readAIWallet(user);
      const known = Boolean(ai?.known) && Number.isFinite(Number(ai.total));
      return {
        aiCredits: known ? Math.trunc(Number(ai.total)) : null,
        aiRenews: known && ai.resetAt ? istDate(ai.resetAt) : null,
        practiceCredits: Number.isFinite(Number(user.creditBalance)) ? Math.trunc(Number(user.creditBalance)) : null,
        isPremium: isPaidUser(user),
      };
    }).catch(() => null);
    const out = await getReview(userId, {
      cap, wallet,
      // Lesson cards due today (Revise source 4): none when Concepts is off, unknown (null) when the read fails.
      readDueCards: async () => {
        const record = await studyRecord(userId, { allSubjects: true });
        return record?.state === 'disabled' ? 0 : Number.isFinite(record?.progress?.dueCards) ? record.progress.dueCards : null;
      },
    });
    return NextResponse.json(out.body, { status: out.http, headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/review] GET failed:', e?.code || e?.message);
    return NextResponse.json({ version: 1, state: 'unavailable', message: 'Your mistakes did not load.' }, { status: 503, headers: NO_STORE });
  }
}
