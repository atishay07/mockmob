// For the Mob's extra-paper chooser: per chapter of a subject, the longest extra paper the bank can really build (moved out of
// src/lib/server/mob/deps.js, 20 Oct 2026, egress F11, so node:test can load it; the computation is unchanged). No 'server-only' and no
// alias imports: the database is passed in.
//
// A plain row count was not enough (go/no-go check 17 Oct: "10 ready" built nothing): the paper's selector also drops passage-linked,
// held and evidence-ineligible questions, takes one question per family and at most 2 per concept. So this reads the subject's pool,
// filters it exactly as the selector's full path does (data/practice_pick.js pickFromFullPool, quick mode, no student: no recency, no
// progress), and runs the same rankCandidates and pickWithConstraints per chapter for each length. `ready` is the longest length that
// fills, never a count the paper cannot reach.
//
// The read is the whole subject with every column (about 1 to 3 MB, 6 MB on an evidence-managed subject), so it is kept (egress F11):
// five minutes as before the check, then revalidated and reused while nothing it depends on changed:
//   the subject's rows        no row written since the read, none added or removed (data/subject_token.js, two head counts)
//   the family holds          the same set of held families (data/inventory_fingerprint.js holdsHash)
//   evidence expiry           the earliest evidence record still in the future when it was read has not passed (nothing is written
//                             when a record expires)
// and never longer than a day. Anything else, an error included, recomputes. The old bound was thirty minutes without a check, so a
// withdrawal is now seen sooner, not later.
import { readablePracticeQuestions } from './practice_library.js';
import { VISIBLE_QUESTION_FILTER } from './practice_source.js';
import { pickWithConstraints, rankCandidates } from './mock_question_selector.js';
import { isPassageLinkedQuestion } from './nta_question_selector.js';
import { getMode } from './test_modes.js';
import { isValidTopSyllabusPair } from './canonical_syllabus.js';
import { holdsHash, minFutureExpiry } from './inventory_fingerprint.js';
import { subjectMemoFor } from './subject_token.js';
import { EXTRA_LENGTHS } from '../src/lib/mob/model.mjs';

const MEMO_NAME = 'mob-chapter-counts';

/** The chapters with the longest extra paper each can fill: [{ chapter, ready }]. One whole-subject read. */
export async function computeChapterCounts(db, subject, { lengths: given = EXTRA_LENGTHS, onRows = null } = {}) {
  const rows = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const { data, error } = await db.from('questions').select('*').eq('subject', subject).eq('is_deleted', false)
      .or(VISIBLE_QUESTION_FILTER).gte('score', -2).order('id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  if (onRows) onRows(rows);
  const mode = getMode('quick');
  const pool = await readablePracticeQuestions(rows.filter((row) => row.chapter && !isPassageLinkedQuestion(row)), db, { requireEvidence: false });
  const byChapter = new Map();
  for (const row of pool) { if (!byChapter.has(row.chapter)) byChapter.set(row.chapter, []); byChapter.get(row.chapter).push(row); }
  const lengths = [...given].sort((a, b) => b - a);
  const out = [];
  for (const [chapter, list] of byChapter) {
    if (!isValidTopSyllabusPair(subject, chapter)) continue;
    const ranked = rankCandidates(list, { mode });
    const ready = lengths.find((n) => n <= list.length && pickWithConstraints(ranked, n, mode).length >= n) || 0;
    out.push({ chapter, ready });
  }
  return out;
}

/** computeChapterCounts behind the memo above. `memo` may be passed (tests); the default is one per database client. */
export function cachedChapterCounts(db, subject, { memo = subjectMemoFor(db, MEMO_NAME), now = Date.now, lengths } = {}) {
  return memo.get(db, subject, subject, async (ctx) => {
    const readAt = now();
    const out = await computeChapterCounts(db, subject, { lengths, onRows: (rows) => { ctx.meta = { ...ctx.meta, minExpiresAt: minFutureExpiry(rows, readAt) }; } });
    return out;
  }, {
    capture: async (client) => ({ holds: await holdsHash(client) }),
    unchanged: async (client, entry, at) => {
      if (!entry.meta || typeof entry.meta.holds !== 'string') return false;
      if (entry.meta.minExpiresAt !== null && entry.meta.minExpiresAt !== undefined && at >= entry.meta.minExpiresAt) return false;
      return (await holdsHash(client)) === entry.meta.holds;
    },
  });
}

export const forgetChapterCountsFor = (db, subject) => subjectMemoFor(db, MEMO_NAME).forget(subject);
