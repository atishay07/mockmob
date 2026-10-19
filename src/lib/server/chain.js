// The personal daily chain on the server (MOB-BUILD-SPEC-V3 2.3, 3.8): GET and PATCH /api/me/chain and the pause days.
// No 'server-only' and no '@/' imports, so node:test drives it on PGlite (data/tests/mob_v3.test.mjs). The chain is
// computed by src/lib/chain/chain.mjs from what chain_state reads; only the student's settings and a best that only
// rises are stored. Free and Pro are identical here.
import { MobError } from '../mob/model.mjs';
import { checkPause, computeChain } from '../chain/chain.mjs';
import { localDay } from './rhythm.js';

const DAY_MS = 86_400_000;
export const CHAIN_HISTORY_DAYS = 730;
const missingSchema = (e) => /PGRST20[25]|42883|42P01|does not exist|schema cache|Could not find the function/i.test(`${e?.code || ''} ${e?.message || ''}`);

/** deps: { rpc(name, params), now() -> ms } */
export function createChainService(deps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const call = async (name, params) => {
    try { return await deps.rpc(name, params); } catch (error) {
      if (error instanceof MobError) throw error;
      throw new MobError(missingSchema(error) ? 'MIGRATION' : 'UNAVAILABLE', { cause: error });
    }
  };
  const today = () => localDay(now(), 'Asia/Kolkata');

  /** The chain body, plus the raw daily counts for the unlock checks. Bumps the stored best when the run is longer. */
  async function read(userId) {
    const t = today();
    const from = localDay(now() - CHAIN_HISTORY_DAYS * DAY_MS, 'Asia/Kolkata');
    const s = await call('chain_state', { p_user_id: userId, p_from: from });
    const body = computeChain({
      daily: s?.daily || [], pauses: s?.pauses || [], fixesHeld: s?.fixes || [], today: t,
      hidden: s?.hidden === true, storedBest: Number(s?.best_days) || 0, seen: new Set(s?.seen || []),
    });
    if (body.best > (Number(s?.best_days) || 0)) await call('chain_best_bump', { p_user_id: userId, p_days: body.best }).catch(() => null);
    return { body, daily: s?.daily || [] };
  }

  return {
    read,
    async get(userId) { return (await read(userId)).body; },
    async patch(userId, body = {}) {
      if (typeof body.hidden !== 'boolean') throw new MobError('BODY_INVALID');
      await call('chain_prefs_set', { p_user_id: userId, p_hidden: body.hidden });
      return (await read(userId)).body;
    },
    async pauseSet(userId, body = {}) {
      const t = today();
      const current = (await read(userId)).body.pause;
      const checked = checkPause({ days: Array.isArray(body.days) ? body.days.slice(0, 31) : [], today: t, existing: current.days });
      if (!checked.ok) throw new MobError(checked.code);
      const r = await call('chain_pause_set', { p_user_id: userId, p_days: checked.days, p_today: t });
      if (r === 'past') throw new MobError('PAUSE_PAST');
      if (r === 'limit') throw new MobError('PAUSE_LIMIT');
      return (await read(userId)).body;
    },
    async pauseClear(userId, body = {}) {
      const days = Array.isArray(body.days) ? body.days.slice(0, 31).map(String) : [];
      if (!days.length || days.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) throw new MobError('BODY_INVALID');
      const r = await call('chain_pause_clear', { p_user_id: userId, p_days: days, p_today: today() });
      if (r === 'past') throw new MobError('PAUSE_PAST');
      return (await read(userId)).body;
    },
  };
}
