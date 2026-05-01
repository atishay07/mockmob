import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const title = typeof body?.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 80)
      : 'New Mentor session';
    const { data, error } = await supabaseAdmin()
      .from('mentor_sessions')
      .insert({
        user_id: session.user.id,
        title,
        metadata: { source: 'manual_new_session' },
      })
      .select('id, title, metadata, created_at, updated_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, session: data, messages: [] });
  } catch (err) {
    console.error('[mentor/session/new] failed:', err?.message || err);
    return NextResponse.json(
      {
        error: 'mentor_session_create_failed',
        message: 'Could not create a new Mentor session. Run the AI overlay migration if this persists.',
      },
      { status: 503 },
    );
  }
}
