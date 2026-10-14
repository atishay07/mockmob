import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { readAnswerReviews } from '@/services/recovery/answerReviews';
import { buildRecap } from '@/lib/server/recap';

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
    try { recap = buildRecap(attempt, await Database.getAttempts(session.user.id), reviews.answerReviews, reviews.answerReviewState); }
    catch (e) { console.warn('[api/attempts/:id] recap skipped:', e?.message); }
    return NextResponse.json({ ...attempt, ...reviews, recap }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[api/attempts/:id] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load attempt' }, { status: 500 });
  }
}
