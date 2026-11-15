import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { supabaseAdmin } from '@/lib/supabase';
import { localExchangeRow, sanitiseLocalReply } from '@/lib/server/mentorLocal';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { aiLimit, savedModeOf } from '@/services/ai/mentorModes';

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
  // L7, L10 (15 Nov 2026): the per-student limit before any database read (src/services/ai/mentorModes.js).
  if (!(await checkPersistentRateLimit(request, aiLimit('local', session.user.id))).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1500) : '';
  // Client-built text: rebuilt from a whitelist and stored only as client-sourced data (see mentorLocal.js).
  const response = sanitiseLocalReply(body.response);
  if (!message || !response) {
    return NextResponse.json({ error: 'message_and_response_required' }, { status: 400 });
  }

  try {
    const sb = supabaseAdmin();
    let effectiveSessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
    let keepThread = false;

    if (effectiveSessionId) {
      const { data: existing } = await sb
        .from('mentor_sessions')
        .select('id,metadata')
        .eq('id', effectiveSessionId)
        .eq('user_id', session.user.id)
        .maybeSingle();
      effectiveSessionId = existing?.id || null;
      // A paid doubt's row keeps its thread (metadata.thread): a free ask in the same panel only touches updated_at.
      keepThread = Boolean(existing?.metadata?.thread);
    }

    if (!effectiveSessionId) {
      const { data, error } = await sb
        .from('mentor_sessions')
        .insert({
          user_id: session.user.id,
          title: message.slice(0, 56),
          metadata: { mode: savedModeOf(body.mode), source: 'local_assistant' },
        })
        .select('id')
        .single();
      if (error) throw error;
      effectiveSessionId = data?.id || null;
    } else {
      await sb
        .from('mentor_sessions')
        // L10: the mode from the known set only ('guide' otherwise), never the client's value as sent.
        .update({ updated_at: new Date().toISOString(), ...(keepThread ? {} : { metadata: { mode: savedModeOf(body.mode) } }) })
        .eq('id', effectiveSessionId)
        .eq('user_id', session.user.id);
    }

    if (!effectiveSessionId) throw new Error('session_missing');

    // One user-role row; never an assistant turn, so no server path can mistake it for a model reply.
    const { error: insertError } = await sb.from('mentor_messages').insert(
      localExchangeRow({ sessionId: effectiveSessionId, userId: session.user.id, message, response }),
    );
    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, sessionId: effectiveSessionId });
  } catch (err) {
    console.warn('[mentor/local] persistence skipped:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'mentor_local_persist_failed' }, { status: 503 });
  }
}
