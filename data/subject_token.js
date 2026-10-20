// A cheap, exact "has this subject changed since I read it" check (egress items F3, F10, F11, F13; 20 Oct 2026). No 'server-only'
// and no alias imports: the database is passed in, so node:test can load it.
//
// Two head counts (no body) on the questions of one subject:
//   count    every row of the subject (inserts and hard deletes change it)
//   touched  rows inserted or updated since `readAtMs` minus a margin. Every UPDATE bumps questions.updated_at (trigger
//            trg_questions_updated_at, BEFORE UPDATE FOR EACH ROW, migration 0005) and an INSERT carries now() (the column is NOT NULL
//            DEFAULT now()), so a row's content, status or score cannot change without `touched` seeing it. The margin covers a
//            transaction that committed late (now() is its start time) and the clock difference between Vercel and Postgres.
// A cache entry read at T with count C is still exact while touched === 0 and count === C. Any error is thrown: the caller reads
// again, which is what it did before this check existed.
export const TOUCH_MARGIN_MS = 15 * 60 * 1000;

async function headCount(query) {
  const { count, error } = await query;
  if (error || !Number.isInteger(count)) throw new Error('SUBJECT_TOKEN_UNAVAILABLE');
  return count;
}

const head = (db, subject) => db.from('questions').select('id', { count: 'exact', head: true }).eq('subject', subject);

/** Just the row count of the subject (taken before a read, so what arrives during the read is seen next time). */
export const subjectCount = (db, subject) => headCount(head(db, subject));

export async function subjectToken(db, subject, readAtMs) {
  const [count, touched] = await Promise.all([
    subjectCount(db, subject),
    headCount(head(db, subject).gte('updated_at', new Date(readAtMs - TOUCH_MARGIN_MS).toISOString())),
  ]);
  return { count, touched };
}

/** True when an entry read at `readAt` with `count` rows is still exact: nothing was written and no row came or went. */
export const tokenUnchanged = (token, entry) => token.touched === 0 && token.count === entry.count;
