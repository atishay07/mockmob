import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { finaliseExpiredSessionsForUser, supabaseSessionStore } from '@/lib/server/sessionFinaliser';
import { reportFinalisedEpisodeCheck } from '@/lib/server/finaliseEpisodeCheck';
import { forgetBadges } from '@/lib/server/badgesStore';

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Abandoned mocks past their deadline become results the moment the student looks.
    const finalised = await finaliseExpiredSessionsForUser(supabaseSessionStore(supabaseAdmin(), { userId: session.user.id }), { onEpisodeCheck: reportFinalisedEpisodeCheck });
    if (finalised?.finalised) forgetBadges(session.user.id); // a result saved just now can earn a badge (BADGES-REFINE-1018)
    const attempts = await Database.getAttempts(session.user.id);
    return NextResponse.json(attempts);
  } catch (e) {
    console.error('[api/attempts] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load attempts' }, { status: 500 });
  }
}

// Compatibility endpoint: old client scores are never accepted.
export { PATCH as POST } from '@/app/api/sessions/route';
