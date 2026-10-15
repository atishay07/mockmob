import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { readAnswerReviews } from '@/services/recovery/answerReviews';
import { buildRecap } from '@/lib/server/recap';
import { buildMissedBefore } from '@/components/recovery/repairRun.js';
import { resultHistory } from '@/../data/mock_swot';
import { readCohort } from '@/../data/cohort_picks';

export async function GET(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const attempt = await Database.getAttemptById(id);
    if (!attempt || attempt.userId !== session.user.id) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    const reviews = await readAnswerReviews(attempt);
    // Everything read from the history is additive: if the history cannot be read, the result still loads
    // without it. Each part fails on its own (data/mock_swot.js resultHistory):
    //  - recap: tone and the previous comparable attempt;
    //  - missedBefore: real wrong answers to the same question in the student's other attempts;
    //  - mistakeInsights: "From your record" lines under each repair (server-built sentences); {} until the answer
    //    checks are ready, as the SWOT says checks_pending;
    //  - lab: the Mistake Lab ledger, first-pick re-mark and How others answered (data/mistake_lab.js; null until the
    //    answer checks are ready); the SWOT then leaves out what the ledger already shows;
    //  - swot: the post-mock SWOT and "Do these next" (left out entirely when SWOT_ENABLED=off).
    const history = await resultHistory({
      attempt,
      answerReviews: reviews.answerReviews,
      answerReviewState: reviews.answerReviewState,
      loadAttempts: () => Database.getAttempts(session.user.id),
      recapOf: buildRecap,
      missedBeforeOf: buildMissedBefore,
      cohortOf: readCohort,
      swotEnabled: process.env.SWOT_ENABLED !== 'off',
      warn: (part, e) => console.warn(`[api/attempts/:id] ${part} skipped:`, e?.message),
    });
    return NextResponse.json({ ...attempt, ...reviews, ...history }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[api/attempts/:id] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load attempt' }, { status: 500 });
  }
}
