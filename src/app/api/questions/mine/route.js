import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/questions/mine — returns the current user's uploaded questions with status
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: appUserId, supabaseId } = session.user;

    // Questions can be authored via two paths:
    //   upload route  → stores author_id (Supabase UUID)
    //   addPending    → stores uploaded_by (app user ID)
    const filters = [];
    if (supabaseId) filters.push(`author_id.eq.${supabaseId}`);
    if (appUserId)  filters.push(`uploaded_by.eq.${appUserId}`);
    if (!filters.length) return NextResponse.json([]);

    const { data, error } = await supabaseAdmin()
      .from('questions')
      .select('id, body, question, subject, chapter, difficulty, status, created_at')
      .or(filters.join(','))
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json(
      data.map((r) => ({
        id: r.id,
        question: r.question ?? r.body ?? '—',
        subject: r.subject,
        chapter: r.chapter,
        difficulty: r.difficulty,
        status: r.status,
        createdAt: r.created_at,
      }))
    );
  } catch (e) {
    console.error('[api/questions/mine] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 });
  }
}
