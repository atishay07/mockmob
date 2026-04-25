import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export const dynamic = 'force-dynamic';

/**
 * GET /api/questions/feed
 *
 * Simple paginated feed of live questions — direct query, no question_scores dependency.
 *
 * Query params:
 *   subject  (required)
 *   chapter  (optional)
 *   limit    (default 20, max 50)
 *   offset   (default 0)
 *
 * Response: { questions: [...], total: number, hasMore: boolean }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    if (!subject) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    }

    const chapter = searchParams.get('chapter') || null;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10), 1), MAX_LIMIT);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);

    const baseSelect = 'id, body, question, subject, chapter, difficulty, options, correct_answer, explanation, tags, ai_tier, ai_score, verification_state';
    const buildQuery = (withVotes) => {
      let next = supabaseAdmin()
        .from('questions')
        .select(withVotes ? `${baseSelect}, upvotes, downvotes, score` : baseSelect, { count: 'exact' })
        .eq('is_deleted', false)
        .or('status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)')
        .eq('subject', subject);

      if (chapter) next = next.eq('chapter', chapter);
      if (withVotes) {
        next = next
          .gte('score', 0)
          .order('score', { ascending: false });
      }

      return next
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    };

    let { data, count, error } = await buildQuery(true);
    if (error && (error.code === '42703' || /score|upvotes|downvotes|column .* does not exist/i.test(error.message || ''))) {
      ({ data, count, error } = await buildQuery(false));
    }
    if (error) throw error;
    const session = await auth().catch(() => null);
    const voteMap = session?.user?.id
      ? await Database.getUserVotes(session.user.id, (data || []).map((r) => r.id))
      : new Map();

    return NextResponse.json({
      questions: (data || []).map((r) => ({
        id: r.id,
        subject: r.subject,
        chapter: r.chapter,
        difficulty: r.difficulty,
        body: r.question ?? r.body,
        options: r.options || [],
        correct_answer: r.correct_answer,
        explanation: r.explanation,
        tags: r.tags || [],
        ai_tier: r.ai_tier,
        ai_score: r.ai_score,
        verification_state: r.verification_state,
        upvotes: r.upvotes || 0,
        downvotes: r.downvotes || 0,
        score: r.score || 0,
        userVote: voteMap.get(r.id) || null,
      })),
      total: count ?? 0,
      hasMore: (offset + limit) < (count ?? 0),
    });
  } catch (e) {
    console.error('[api/questions/feed] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
  }
}
