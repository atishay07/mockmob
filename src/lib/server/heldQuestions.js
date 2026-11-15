// The questions whose key one reader may not see on a list that shows keys: the Explore feed and Saved (security pass
// 15 Nov 2026, L3 and the Saved finding). It adds no rule of its own; it gathers, for one reader, the holds that already keep
// keys closed elsewhere:
//   1. a Mob paper the reader finished that is still held (answerHold.readHeldMobPapers, as Review, Revise and Learn read it);
//   2. what a Mob keeps out of every draw and review while it is open (src/lib/server/mob/games.js heldIds): in every Mob the
//      reader is in, this week's paper, the extra papers that have not closed and the games that have not closed. So a member
//      who is sitting the paper, or has not sat it yet, cannot read its key on Explore either;
//   3. the reader's own timed session that is still running on the server (recovery_sessions: state active, before its
//      deadline). A device-held session keeps no server row (practiceSessions.js), so it cannot be seen here.
// No 'server-only' and no '@/' imports, so node:test drives it (data/tests/sec_1115_feed_hold.test.mjs).
import { readHeldMobPapers } from './answerHold.js';
import { mobWeek } from '../mob/model.mjs';

// A table that is not there (an environment without the Mob or durable-session migrations) holds nothing.
const missingTable = (error) => ['42P01', 'PGRST205'].includes(error?.code);

async function rowsOf(query) {
  const { data, error } = await query;
  if (error && !missingTable(error)) throw error;
  return error ? [] : data || [];
}

const addIds = (set, list) => {
  for (const id of Array.isArray(list) ? list : []) {
    const value = id && typeof id === 'object' ? id.id : id;
    if (typeof value === 'string' && value) set.add(value);
  }
};

/**
 * The question ids held for `userId` at `now`, as a Set. Throws a database error other than a missing table: the caller
 * decides what a failed read means (the feed and Saved answer 500, so no key is sent while the holds are unknown).
 */
export async function readHeldQuestionIds(db, userId, now = Date.now()) {
  const held = new Set();
  if (!db || !userId) return held;
  const at = new Date(now).toISOString();
  const [papers, memberships, sessions] = await Promise.all([
    readHeldMobPapers(db, userId, now),
    rowsOf(db.from('mob_members').select('mob_id').eq('user_id', userId)),
    rowsOf(db.from('recovery_sessions').select('questions').eq('user_id', userId).eq('state', 'active').gt('expires_at', at).limit(5)),
  ]);
  for (const qid of papers.qids) held.add(qid);
  for (const row of sessions) addIds(held, row.questions);
  const mobs = [...new Set(memberships.map((row) => row.mob_id).filter(Boolean))];
  if (mobs.length) {
    const [paper, extras, games] = await Promise.all([
      rowsOf(db.from('mob_papers').select('question_ids').in('mob_id', mobs).eq('week_start', mobWeek(now))),
      rowsOf(db.from('mob_extras').select('question_ids').in('mob_id', mobs).gt('closes_at', at)),
      rowsOf(db.from('mob_games').select('question_ids').in('mob_id', mobs).gt('closes_at', at)),
    ]);
    for (const row of [...paper, ...extras, ...games]) addIds(held, row.question_ids);
  }
  return held;
}
