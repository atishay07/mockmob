// What the bank holds in a chapter, and how much of it this student has never seen (spec D.5-5).
// "Do these next" must not promise ten fresh questions in a chapter that holds four, so the plan is told, per chapter:
//   bank    questions a practice set can draw on in that chapter (the same visible filter the picker reads)
//   unseen  of those, the ones this student has no attempt on (user_question_progress.attempt_count 0 or no row),
//           the same test the picker ranks on (data/mock_question_selector.js rankCandidates)
// Egress: only counts. Each number is a head/count request (no rows come back from the bank), and the student's own
// seen questions are read as ids alone, one chapter at a time, to be counted back against the bank so a question
// that was deleted since is not subtracted from a chapter it no longer fills. Nothing here reads the bank.
// No client of its own and no 'server-only': the caller passes one, so node:test can load this.

// data/db.js VISIBLE_QUESTION_FILTER, as the picker reads it (a test pins the two together).
export const VISIBLE_QUESTION_FILTER = 'status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)';
export const INVENTORY_ID_CHUNK = 100;
export const INVENTORY_MAX_CHAPTERS = 8;
const PAGE = 1000;

const visibleChapter = (db, subject, chapter) => db.from('questions').select('id', { count: 'exact', head: true })
  .eq('subject', subject).eq('chapter', chapter).eq('is_deleted', false).or(VISIBLE_QUESTION_FILTER);

async function bankCount(db, subject, chapter) {
  const { count, error } = await visibleChapter(db, subject, chapter);
  if (error || !Number.isInteger(count)) throw error || new Error('no count');
  return count;
}

// The ids of the questions this student has attempted in the chapter, paged (a student's own rows only).
async function attemptedIds(db, userId, subject, chapter) {
  const ids = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('user_question_progress').select('question_id')
      .eq('user_id', userId).eq('subject', subject).eq('chapter', chapter).gt('attempt_count', 0)
      .order('question_id').range(from, from + PAGE - 1);
    if (error) throw error;
    ids.push(...(data || []).map((row) => row.question_id));
    if (!data || data.length < PAGE) break;
  }
  return ids;
}

// How many of those ids are still in the chapter's visible bank.
async function seenInBank(db, subject, chapter, ids) {
  let seen = 0;
  for (let i = 0; i < ids.length; i += INVENTORY_ID_CHUNK) {
    const { count, error } = await visibleChapter(db, subject, chapter).in('id', ids.slice(i, i + INVENTORY_ID_CHUNK));
    if (error || !Number.isInteger(count)) throw error || new Error('no count');
    seen += count;
  }
  return seen;
}

/**
 * readChapterInventory(db, { userId, subject, chapters, warn }) -> { [chapter]: { bank, unseen } }.
 * `subject` is the stored (internal) subject id the questions table uses. A chapter whose read fails is left out of
 * the answer, which the plan reads as "not known" and so leaves that row as it was; one failure never loses the rest.
 * At most INVENTORY_MAX_CHAPTERS chapters are read.
 */
export async function readChapterInventory(db, { userId, subject, chapters, warn = () => {} } = {}) {
  const out = {};
  if (!db || !userId || !subject || !Array.isArray(chapters)) return out;
  const names = [...new Set(chapters.filter((c) => typeof c === 'string' && c))].slice(0, INVENTORY_MAX_CHAPTERS);
  await Promise.all(names.map(async (chapter) => {
    try {
      const [bank, ids] = await Promise.all([bankCount(db, subject, chapter), attemptedIds(db, userId, subject, chapter)]);
      const seen = ids.length && bank ? await seenInBank(db, subject, chapter, ids) : 0;
      out[chapter] = { bank, unseen: Math.max(0, bank - seen) };
    } catch (error) {
      warn(chapter, error);
    }
  }));
  return out;
}
