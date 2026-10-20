import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { finaliseExpiredSessionsForUser, supabaseSessionStore } from '@/lib/server/sessionFinaliser';
import { reportFinalisedEpisodeCheck } from '@/lib/server/finaliseEpisodeCheck';
import { forgetBadges } from '@/lib/server/badgesStore';
import { isMarksView, isSummaryView, marksItem, readAttemptListSummary, SUMMARY_UNAVAILABLE } from '@/lib/server/attemptListSummary';
import { attemptForClient, heldAttemptView, readHeldMobPapersSafe } from '@/lib/server/answerHold';

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Abandoned mocks past their deadline become results the moment the student looks.
    const finalised = await finaliseExpiredSessionsForUser(supabaseSessionStore(supabaseAdmin(), { userId: session.user.id }), { onEpisodeCheck: reportFinalisedEpisodeCheck });
    if (finalised?.finalised) forgetBadges(session.user.id); // a result saved just now can earn a badge (BADGES-REFINE-1018)
    // ?view=summary (the Android app's list call): the same array with only what the app reads, never the heavy snapshot fields.
    // No param: the full attempts, byte for byte as before (the website and older apps).
    // A Mob paper still open for the Mob is listed with its marks only (src/lib/mob/paperHold.mjs). The summary rows no longer
    // carry the Mob tag, so the held ones are read once beside them.
    if (isSummaryView(request)) {
      const [rows, held] = await Promise.all([readAttemptListSummary(supabaseAdmin(), session.user.id), readHeldMobPapersSafe(supabaseAdmin(), session.user.id, Date.now(), 'api/attempts')]);
      return NextResponse.json(held.byId.size ? rows.map((r) => (held.byId.has(r.id) ? heldAttemptView(r, held.byId.get(r.id)) : r)) : rows);
    }
    // ?view=marks (the website's Profile: a count and an average): the id, the score and the time of each paper, about 100 bytes
    // a paper instead of the whole row. Held Mob papers keep their marks, as in every other view of the list.
    if (isMarksView(request)) {
      const rows = await Database.getAttempts(session.user.id, { columns: ['id', 'score', 'completed_at'] });
      return NextResponse.json(rows.map(marksItem));
    }
    const attempts = await Database.getAttempts(session.user.id);
    return NextResponse.json(attempts.map((a) => attemptForClient(a)));
  } catch (e) {
    if (e?.code === SUMMARY_UNAVAILABLE) {
      return NextResponse.json({ error: 'Your attempts are taking longer than usual to load. Try again in a moment.', retryable: true }, { status: 503, headers: { 'Retry-After': '5' } });
    }
    console.error('[api/attempts] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load attempts' }, { status: 500 });
  }
}

// Compatibility endpoint: old client scores are never accepted.
export { PATCH as POST } from '@/app/api/sessions/route';
