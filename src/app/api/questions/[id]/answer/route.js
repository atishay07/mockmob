import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { auth } from '@/lib/auth';
import { readablePracticeQuestions } from '@/../data/practice_library';
import { attachBankPassages } from '@/../scripts/pipeline/lib/bankSnapshot.mjs';
import { gradeFeedAnswer } from '@/../data/explore_feed';
import { verifyFeedTicket } from '@/lib/server/feedTicket';
import { checkPersistentRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';

const ROUTE = '/api/questions/[id]/answer';
// A student answers about once every few seconds; this leaves room for a fast reader and not for a scraper walking the bank.
const SIGNED_OUT_LIMIT = 30;
const SIGNED_IN_LIMIT = 90;

export const dynamic = 'force-dynamic';

const refuse = (error, status, headers) => NextResponse.json({ error }, { status, headers });

/**
 * POST /api/questions/[id]/answer   { choice: "B" | null, ticket?: string }
 *
 * The feed sends a question without its key or explanation. This is where the student gets them, after answering:
 * choice is the option key picked, or null for "show the answer". Signed-in callers (cookie or app bearer) need nothing
 * more; a signed-out visitor sends the `ticket` the feed attached to that question.
 *
 * Response: { state: 'correct' | 'incorrect' | 'revealed', correct_answer, explanation }
 */
export async function POST(request, { params }) {
  const { id: questionId } = await params;
  const session = await auth(request).catch(() => null);
  const userId = session?.user?.id || null;

  const limit = await checkPersistentRateLimit(request, {
    route: ROUTE,
    limit: userId ? SIGNED_IN_LIMIT : SIGNED_OUT_LIMIT,
    keyParts: [userId || 'anon'],
  });
  if (!limit.allowed) return refuse('Too many requests', 429, rateLimitHeaders(limit));

  let body;
  try { body = await request.json(); } catch { return refuse('Invalid JSON body.', 400); }
  const choice = body?.choice ?? null;
  if (choice !== null && (typeof choice !== 'string' || !choice || choice.length > 8)) return refuse('choice must be an option key or null.', 400);
  if (!userId && !verifyFeedTicket(body?.ticket, questionId)) return refuse('This question has expired. Reload the page to answer it.', 403);

  try {
    const db = supabaseAdmin();
    const { data: row, error } = await db.from('questions').select('*').eq('id', questionId).eq('is_deleted', false).maybeSingle();
    if (error) throw error;
    // The same rows the feed serves: live, or verified and active, and past the readable-key and quality checks.
    const servable = row && (row.status === 'live' || (row.verification_state === 'verified' && row.exploration_state === 'active'));
    const [question] = servable ? await readablePracticeQuestions(await attachBankPassages(db, [row]), db) : [];
    if (!question) return refuse('Question not found.', 404);

    const graded = gradeFeedAnswer(question, choice);
    if (graded.state === 'invalid') return refuse('That is not one of the options.', 400);
    if (graded.state === 'unavailable') return refuse('The answer is unavailable.', 409);
    return NextResponse.json(
      { state: graded.state, correct_answer: graded.correctKey, explanation: graded.explanation },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error('[api/questions/answer] POST failed:', e);
    return refuse('Failed to check the answer', 500);
  }
}
