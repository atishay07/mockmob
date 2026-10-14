import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { respondEpisode } from '@/lib/server/learning';
import { finaliseExpiredSessions, supabaseSessionStore, episodeCheckInput, FINALISE_BATCH } from '@/lib/server/sessionFinaliser';
import { releaseExpiredAiCredits } from '@/services/credits/releaseExpired';

export const maxDuration = 60;

function same(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

function authorised(request) {
  const cron = process.env.CRON_SECRET;
  const internal = process.env.INTERNAL_API_SECRET;
  if (cron && same(request.headers.get('authorization'), `Bearer ${cron}`)) return true;
  return Boolean(internal) && same(request.headers.get('x-internal-secret'), internal);
}

async function run(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!authorised(request)) return Response.json({ error: 'forbidden', message: 'Not allowed.' }, { status: 403, headers });
  // First, and on its own: give back the credits of AI repairs and replies that never finished (a killed function
  // leaves its reservation open). It cannot fail this job, and a slow finalisation below cannot starve it.
  let credits = { ok: false, released: 0 };
  try { credits = await releaseExpiredAiCredits(supabaseAdmin(), 100); } catch { /* reported in the response below */ }
  try {
    const result = await finaliseExpiredSessions(supabaseSessionStore(supabaseAdmin()), {
      limit: FINALISE_BATCH,
      onEpisodeCheck: async (row, scored) => {
        const { input, options } = episodeCheckInput(row, scored);
        await respondEpisode(row.user_id, row.selection_meta.episodeId, input, options);
      },
    });
    return Response.json({ ...result, aiCreditsReleased: credits.released, ...(credits.ok ? {} : { aiCreditsReleaseFailed: true }) }, { headers });
  } catch {
    return Response.json({ error: 'finalise_unavailable', message: 'Session finalisation could not run.' }, { status: 503, headers });
  }
}

// Vercel cron issues GET with Authorization: Bearer ${CRON_SECRET}; POST serves the internal header.
export const GET = run;
export const POST = run;
