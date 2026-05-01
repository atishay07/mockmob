import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json_body' }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1500) : '';
  const response = body.response && typeof body.response === 'object' ? body.response : null;
  if (!message || !response?.reply) {
    return NextResponse.json({ error: 'message_and_response_required' }, { status: 400 });
  }

  try {
    const sb = supabaseAdmin();
    let effectiveSessionId = typeof body.sessionId === 'string' ? body.sessionId : null;

    if (effectiveSessionId) {
      const { data: existing } = await sb
        .from('mentor_sessions')
        .select('id')
        .eq('id', effectiveSessionId)
        .eq('user_id', session.user.id)
        .maybeSingle();
      effectiveSessionId = existing?.id || null;
    }

    if (!effectiveSessionId) {
      const { data, error } = await sb
        .from('mentor_sessions')
        .insert({
          user_id: session.user.id,
          title: message.slice(0, 56),
          metadata: { mode: body.mode || 'guide', source: 'local_assistant' },
        })
        .select('id')
        .single();
      if (error) throw error;
      effectiveSessionId = data?.id || null;
    } else {
      await sb
        .from('mentor_sessions')
        .update({ updated_at: new Date().toISOString(), metadata: { mode: body.mode || 'guide' } })
        .eq('id', effectiveSessionId)
        .eq('user_id', session.user.id);
    }

    if (!effectiveSessionId) throw new Error('session_missing');

    await sb.from('mentor_messages').insert([
      { session_id: effectiveSessionId, user_id: session.user.id, role: 'user', content: message },
      {
        session_id: effectiveSessionId,
        user_id: session.user.id,
        role: 'assistant',
        content: String(response.reply).slice(0, 4000),
        structured_payload: response,
      },
    ]);

    return NextResponse.json({ ok: true, sessionId: effectiveSessionId });
  } catch (err) {
    console.warn('[mentor/local] persistence skipped:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'mentor_local_persist_failed' }, { status: 503 });
  }
}
