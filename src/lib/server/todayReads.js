import 'server-only';
// Today's eight reads in one answer (speed.md item 4, LK28): GET /api/today authenticates once, takes one rate-limit count and
// runs these together. Each part answers { status, body } exactly as its own route does, so the page keeps one status per
// read (a failed part is an error there, never a zero) and its per-part refreshes still call the old routes:
//   plan     /api/learning/plan            papers   /api/attempts/summary?limit=20   rhythm   /api/me/rhythm
//   goal     /api/me/goal                  road     /api/me/road                     revise   /api/me/revise
//   facts    /api/me/timed-mock            record   /api/me/repair-record?limit=100
// A change to one of those routes' GET bodies belongs here too (data/tests/today_bundle.test.mjs pins the calls).
import { supabaseAdmin } from '@/lib/supabase';
import { learningRecord } from '@/lib/server/learning';
import { learningFailure } from '@/lib/server/learningHttp';
import { listAttemptSummaries } from '@/lib/server/attemptSummary';
import { finaliseExpiredSessionsForUser, supabaseSessionStore } from '@/lib/server/sessionFinaliser';
import { reportFinalisedEpisodeCheck } from '@/lib/server/finaliseEpisodeCheck';
import { forgetBadges } from '@/lib/server/badgesStore';
import { getGoal, getRhythm } from '@/lib/server/appPrefs';
import { getRoad } from '@/lib/server/studyRoad';
import { getRevise } from '@/lib/server/revise';
import { timedMockFacts } from '@/lib/server/timedMock';
import { getRepairRecord, parseLimit } from '@/lib/server/repairRecord';
import { keyCardsEnabled } from '@/lib/server/keycards';
import { keycardsService } from '@/lib/server/keycardsHttp';
import { capFrom } from '@/../data/revise';
import COPY from '@/../data/mistake_lab.copy.json';

const ok = (body) => ({ status: 200, body });
const unavailable = { status: 503, body: { error: 'unavailable' } };

export const TODAY_PARTS = ['plan', 'papers', 'rhythm', 'goal', 'road', 'revise', 'facts', 'record'];

const reads = {
  async plan(userId) {
    try { return ok(await learningRecord(userId, { subject: null, minutes: 0 })); }
    catch (error) { return learningFailure(error); }
  },
  async papers(userId) {
    try {
      const finalised = await finaliseExpiredSessionsForUser(supabaseSessionStore(supabaseAdmin(), { userId }), { onEpisodeCheck: reportFinalisedEpisodeCheck });
      if (finalised?.finalised) forgetBadges(userId); // a result saved just now can earn a badge (BADGES-REFINE-1018)
      const result = await listAttemptSummaries(supabaseAdmin(), userId, { cursor: null, limit: '20' });
      if (result.error) return { status: 400, body: { error: 'bad_cursor' } };
      return ok(result);
    } catch (e) {
      console.error('[api/today] papers failed:', e);
      return { status: 503, body: { error: 'unavailable', message: 'Could not load your attempts. Try again.' } };
    }
  },
  async rhythm(userId) {
    try { return ok(await getRhythm(userId)); } catch { return unavailable; }
  },
  async goal(userId) {
    try { return ok(await getGoal(userId)); } catch { return unavailable; }
  },
  async road(userId) {
    try { return ok(await getRoad(userId)); } catch { return unavailable; }
  },
  async revise(userId) {
    try {
      // The plain Revise body (no ?queue=1), with today's key cards while KEY_CARDS_ENABLED is on.
      const readKeyCards = keyCardsEnabled() ? async () => (await keycardsService()).reviseSource(userId) : null;
      const out = await getRevise(userId, { cap: capFrom(null), keyCards: readKeyCards, queue: null });
      return { status: out.http, body: out.body };
    } catch (e) {
      console.warn('[api/today] revise failed:', e?.message);
      return { status: 503, body: { version: 1, state: 'unavailable', message: COPY.revise.unavailable, items: [] } };
    }
  },
  async facts(userId) {
    try { return ok(await timedMockFacts(userId, supabaseAdmin())); }
    catch (e) {
      console.warn('[api/today] timed-mock failed:', e?.message);
      return unavailable;
    }
  },
  async record(userId) {
    try { return ok({ repairs: await getRepairRecord(userId, { limit: parseLimit('100') }) }); }
    catch { return { status: 503, body: { error: 'unavailable' } }; }
  },
};

/** Every part at once; a part that fails answers its own error status and never holds the others. */
export async function todayReads(userId) {
  const answers = await Promise.all(TODAY_PARTS.map((name) => reads[name](userId).catch(() => unavailable)));
  return Object.fromEntries(TODAY_PARTS.map((name, i) => [name, answers[i]]));
}
