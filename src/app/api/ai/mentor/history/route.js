import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { supabaseAdmin } from '@/lib/supabase';
import { getUsageSnapshot } from '@/services/usage/getDailyUsage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const requestedSessionId = url.searchParams.get('sessionId');
  const sb = supabaseAdmin();

  try {
    let query = sb
      .from('mentor_sessions')
      .select('id, title, metadata, created_at, updated_at')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (requestedSessionId) {
      query = sb
        .from('mentor_sessions')
        .select('id, title, metadata, created_at, updated_at')
        .eq('user_id', session.user.id)
        .eq('id', requestedSessionId)
        .limit(1);
    }

    const { data: sessions, error: sessionError } = await query;
    if (sessionError) throw sessionError;

    const activeSession = sessions?.[0] || null;
    let messages = [];
    if (activeSession?.id) {
      const { data: rows, error: messageError } = await sb
        .from('mentor_messages')
        .select('id, role, content, structured_payload, created_at')
        .eq('user_id', session.user.id)
        .eq('session_id', activeSession.id)
        .order('created_at', { ascending: true })
        .limit(80);
      if (messageError) throw messageError;
      messages = (rows || []).map((row) => ({
        id: row.id,
        role: row.role,
        text: row.content,
        response: row.structured_payload,
        createdAt: row.created_at,
      }));
    }

    const snapshot = await getUsageSnapshot(dbUser);
    return NextResponse.json({
      ok: true,
      session: activeSession,
      sessions: sessions || [],
      messages,
      usageSnapshot: publicUsageSnapshot(snapshot),
    });
  } catch (err) {
    console.error('[mentor/history] failed:', err?.message || err);
    return NextResponse.json(
      {
        ok: false,
        error: 'mentor_history_unavailable',
        message: 'Mentor history is not available yet. Run the AI overlay migration if this persists.',
      },
      { status: 503 },
    );
  }
}

function publicUsageSnapshot(snapshot) {
  return {
    tier: snapshot.tier,
    isPaid: snapshot.isPaid,
    remaining: snapshot.remaining,
    aiWallet: snapshot.aiWallet,
    aiCreditBalance: snapshot.aiCreditBalance,
    includedAiCreditsRemaining: snapshot.includedAiCreditsRemaining,
    creditCosts: snapshot.creditCosts,
  };
}
