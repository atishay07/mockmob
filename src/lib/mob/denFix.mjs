// `v3.fix` on the den (V4 Now card steps 2 and 3; docs/brain/APP-API-CONTRACT.md 2.14): the one Fix it together step the signed-in
// member still has to take, from the Mob's real traps. Pure, no imports of the server, so node:test drives it
// (data/tests/mob_den_fix_1020.test.mjs). The rows come from public.mob_den_fix (migration 20261020152000_mob_den_fix): the Mob's
// traps whose Wednesday-check window has not closed, that the Mob has not fixed together yet and that still have a step left for this
// member (the database filters on their own answers before it takes the newest 5), newest game first, each with this member's own two
// facts (did they answer the fix question, did they answer the check). Nothing is invented here: a trap exists only
// when a closed game's picks made one (src/lib/server/mob/games.js ensureSettled), and the check window is the trap's own
// (check_opens_at, check_closes_at from checkWindow in games.mjs).
import { UUID_RE } from './model.mjs';

/** How many of the Mob's newest open traps the database sends. A Mob has a handful of games in a week. */
export const DEN_FIX_CANDIDATES = 5;

const ms = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : null; };

/**
 * What one trap asks of one member at `nowMs`:
 *   'check'  the Wednesday check is open and they have not answered it ("Take the check"; the app's Fix screen also starts at the check
 *            while it is open, so the card and the screen agree);
 *   'ready'  they have not answered the fix question ("Fix question 4 together"), up to the end of the check window (the server
 *            takes a fix answer until then);
 *   null     nothing is left for them: both answered, or the window is over.
 */
export function fixStateOf(row, nowMs) {
  const opens = ms(row?.check_opens_at);
  const closes = ms(row?.check_closes_at);
  if (opens === null || closes === null || !(nowMs <= closes)) return null;
  if (nowMs >= opens && row.check_answered !== true) return 'check';
  if (row.now_answered !== true) return 'ready';
  return null;
}

/**
 * The den's `fix` object, or null (no key at all): the newest game with something left for this member.
 * rows: public.mob_den_fix, newest game first. Returns { gameId, question (1-based, the number the student saw), state, checkOpensAt }.
 * `check` is only ever returned for a trap whose own check window is open at `nowMs`; with no such trap the server never says it.
 */
export function denFixView(rows, nowMs) {
  for (const r of Array.isArray(rows) ? rows : []) {
    if (typeof r?.game_id !== 'string' || !UUID_RE.test(r.game_id) || !Number.isInteger(r.q) || r.q < 0) continue;
    const state = fixStateOf(r, nowMs);
    if (!state) continue;
    return { gameId: r.game_id, question: r.q + 1, state, checkOpensAt: new Date(ms(r.check_opens_at)).toISOString() };
  }
  return null;
}
