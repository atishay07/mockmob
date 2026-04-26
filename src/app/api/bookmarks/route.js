import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';

const FREE_BOOKMARK_LIMIT = 25;

async function getBookmarkCount(userId) {
  const { count, error } = await supabaseAdmin()
    .from('question_bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count || 0;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin()
      .from('question_bookmarks')
      .select('question_id, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const ids = (data || []).map((row) => row.question_id);
    let questions = [];
    if (ids.length > 0) {
      const { data: questionRows, error: questionError } = await supabaseAdmin()
        .from('questions')
        .select('id, body, question, subject, chapter, difficulty, options, correct_answer, explanation, tags, upvotes, downvotes, score')
        .in('id', ids);
      if (questionError) throw questionError;
      const byId = new Map((questionRows || []).map((row) => [row.id, row]));
      questions = ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((row) => ({
          id: row.id,
          subject: row.subject,
          chapter: row.chapter,
          difficulty: row.difficulty,
          body: row.question ?? row.body,
          options: row.options || [],
          correct_answer: row.correct_answer,
          explanation: row.explanation,
          tags: row.tags || [],
          upvotes: row.upvotes || 0,
          downvotes: row.downvotes || 0,
          score: row.score || 0,
          saved: true,
        }));
    }

    return NextResponse.json({
      questionIds: ids,
      questions,
      count: data?.length || 0,
    });
  } catch (e) {
    console.error('[api/bookmarks] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load bookmarks' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const questionId = body?.questionId;
    const saved = Boolean(body?.saved);
    if (!questionId || typeof questionId !== 'string') {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    }

    const user = await Database.getUserById(session.user.id);
    const isPremium = user?.subscriptionStatus === 'active';

    if (!saved) {
      const { error } = await supabaseAdmin()
        .from('question_bookmarks')
        .delete()
        .eq('user_id', session.user.id)
        .eq('question_id', questionId);
      if (error) throw error;
      return NextResponse.json({
        saved: false,
        count: await getBookmarkCount(session.user.id),
        limit: isPremium ? null : FREE_BOOKMARK_LIMIT,
      });
    }

    const existingCount = await getBookmarkCount(session.user.id);
    if (!isPremium && existingCount >= FREE_BOOKMARK_LIMIT) {
      const { data: existing } = await supabaseAdmin()
        .from('question_bookmarks')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('question_id', questionId)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({
          error: 'Free bookmark limit reached',
          premiumHint: 'Premium unlocks unlimited saved questions.',
          limit: FREE_BOOKMARK_LIMIT,
        }, { status: 402 });
      }
    }

    const { error } = await supabaseAdmin()
      .from('question_bookmarks')
      .upsert({
        user_id: session.user.id,
        question_id: questionId,
        source: body?.source || 'explore',
      }, { onConflict: 'user_id,question_id' });

    if (error) throw error;

    return NextResponse.json({
      saved: true,
      count: await getBookmarkCount(session.user.id),
      limit: isPremium ? null : FREE_BOOKMARK_LIMIT,
    });
  } catch (e) {
    console.error('[api/bookmarks] POST failed:', e);
    return NextResponse.json({ error: 'Failed to update bookmark' }, { status: 500 });
  }
}
