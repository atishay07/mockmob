import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { readAnswerReviews } from '@/services/recovery/answerReviews';
import { buildRecap } from '@/lib/server/recap';
import { buildMissedBefore } from '@/components/recovery/repairRun.js';

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
    // The recap is additive: if the history cannot be read, the result still loads without it.
    let recap = null;
    // Same additive rule for "missed this before": real wrong answers to the same question in the student's other attempts.
    let missedBefore = {};
    try {
      const allAttempts = await Database.getAttempts(session.user.id);
      try { recap = buildRecap(attempt, allAttempts, reviews.answerReviews, reviews.answerReviewState); }
      catch (e) { console.warn('[api/attempts/:id] recap skipped:', e?.message); }
      try { missedBefore = buildMissedBefore(allAttempts, attempt.id); }
      catch (e) { console.warn('[api/attempts/:id] missedBefore skipped:', e?.message); }
    } catch (e) { console.warn('[api/attempts/:id] history skipped:', e?.message); }
    return NextResponse.json({ ...attempt, ...reviews, recap, missedBefore }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[api/attempts/:id] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load attempt' }, { status: 500 });
  }
}
