// The facts behind "your first full mock in each subject is free" (data/first_full_mock.js decides; this file reads and writes).
// Takes the Supabase client (the routes pass the admin client), so the tests run it over a real Postgres. No migration: it uses
// two tables production already has, attempts (read) and learning_allowances (one row per free start, its primary key is the lock).
import { toPublicSubjectId } from '../../../data/cuet_controls.js';
import { FIRST_FULL_MOCK_PERIOD, FULL_PAPER_MODES, firstFullMockKind, firstFullMockState, firstFullMockTakenError, fullSampleKind } from '../../../data/first_full_mock.js';
import { SUNDAY_TAG } from '../sundayMock.mjs';

const UNIQUE_VIOLATION = '23505';
const failed = (cause) => Object.assign(new Error('SESSION_CREATE_FAILED'), { cause });
const settle = (query) => Promise.resolve(query).catch((error) => ({ error }));

/** Every spelling a saved attempt may carry for one subject: General Test was saved as 'general_test' before it became 'gat'. */
export function subjectSpellings(subject) {
  return [...new Set([subject, toPublicSubjectId(subject)].filter((s) => typeof s === 'string' && s))];
}

const claimRow = (db, userId, kind) => db.from('learning_allowances').select('reference')
  .eq('user_id', userId).eq('kind', kind).eq('period', FIRST_FULL_MOCK_PERIOD).maybeSingle();

/**
 * { fullPapers, claim, sample } for one student and one internal subject id. fullPapers is the count of saved Full mock and NTA
 * mode attempts in the subject (null when the read failed); claim is { reference } when the free row exists, null when it does
 * not, undefined when the read failed; sample is true when a full-sample row exists for the subject (the durable-only free
 * full mock this rule folds in). Two reads, in parallel, both on indexed keys. Never throws.
 * A Sunday Mock (src/lib/sundayMock.mjs; saved in Full mock mode, tagged selection_meta.mobPaper.mobId = SUNDAY_TAG) is not the
 * student's own Full mock and never uses up the free one: when the count is not 0 a third read counts the Sunday papers among
 * them and takes them off. If that read fails the count stays as it was (the free mock is then treated as used, as before).
 */
export async function readFirstFullMockFacts(db, { userId, subject }) {
  const kind = firstFullMockKind(subject);
  if (!db || !userId || !kind) return { fullPapers: null, claim: undefined, sample: false };
  const sample = fullSampleKind(subject);
  const [papers, rows] = await Promise.all([
    settle(db.from('attempts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).in('subject', subjectSpellings(subject)).in('selection_meta->>mode', FULL_PAPER_MODES)),
    settle(db.from('learning_allowances').select('kind,period,reference').eq('user_id', userId).in('kind', [kind, sample])),
  ]);
  const list = rows?.error || !Array.isArray(rows?.data) ? null : rows.data;
  const held = list?.find((row) => row.kind === kind && row.period === FIRST_FULL_MOCK_PERIOD) || null;
  let fullPapers = papers?.error || !Number.isInteger(papers?.count) ? null : papers.count;
  if (fullPapers > 0) {
    const sunday = await sundayFullPapers(db, { userId, subject });
    if (Number.isInteger(sunday)) fullPapers = Math.max(0, fullPapers - sunday);
  }
  return {
    fullPapers,
    claim: list === null ? undefined : held ? { reference: String(held.reference) } : null,
    sample: Boolean(list?.some((row) => row.kind === sample)),
  };
}

/** How many of the student's saved Full mock and NTA papers in the subject are Sunday Mock papers, or null when unread. */
async function sundayFullPapers(db, { userId, subject }) {
  try {
    const r = await db.from('attempts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).in('subject', subjectSpellings(subject)).in('selection_meta->>mode', FULL_PAPER_MODES)
      .contains('selection_meta', { mobPaper: { mobId: SUNDAY_TAG } });
    return r?.error || !Number.isInteger(r?.count) ? null : r.count;
  } catch { return null; }
}

/** The state for a quote (no session yet) or a start (its session id): 'available' | 'mine' | 'used' | 'unknown'. */
export async function firstFullMockFor(db, { userId, subject, sessionId = null }) {
  return firstFullMockState(await readFirstFullMockFacts(db, { userId, subject }), { sessionId });
}

/**
 * Takes the free row for this session (the device-held start path; the durable path takes it inside start_learning_session).
 * Returns 'claimed' (this start took it), 'mine' (this session already held it: a replay or a double tap) or 'taken' (another
 * start holds it, so this one is charged as before). Throws SESSION_CREATE_FAILED when the row can be neither written nor read,
 * so nothing is charged and the student can try again; a paper the quote called free is never charged silently.
 */
export async function claimFirstFullMock(db, { userId, subject, sessionId }) {
  const kind = firstFullMockKind(subject);
  if (!kind || !userId || !sessionId) throw failed(new Error('first_full_mock_claim_input'));
  const inserted = await settle(db.from('learning_allowances')
    .insert({ user_id: userId, kind, period: FIRST_FULL_MOCK_PERIOD, reference: String(sessionId) }));
  if (!inserted?.error) return 'claimed';
  if (String(inserted.error.code) !== UNIQUE_VIOLATION) throw failed(inserted.error);
  const held = await settle(claimRow(db, userId, kind));
  if (held?.error || !held?.data) throw failed(held?.error || new Error('first_full_mock_claim_missing'));
  return String(held.data.reference) === String(sessionId) ? 'mine' : 'taken';
}

/**
 * Gives the free row back after a durable start that took it and then failed to make its session (SESS-FOLLOWUP 4, 15 Nov
 * 2026): the row is taken outside start_learning_session's transaction, so a failed session start would otherwise leave the
 * subject's free full mock spent on a paper that never existed. Deleted only while no recovery_sessions row has this id (a
 * parallel replay of the same start that did make the session keeps it). Never throws; true when the row was given back. A read
 * or delete that fails keeps the row, as before this rule: reopening the same paper then still starts it free.
 */
export async function releaseFirstFullMock(db, { userId, subject, sessionId }) {
  const kind = firstFullMockKind(subject);
  if (!db || !kind || !userId || !sessionId) return false;
  const session = await settle(db.from('recovery_sessions').select('id').eq('id', String(sessionId)).maybeSingle());
  if (session?.error || session?.data) return false;
  const gone = await settle(db.from('learning_allowances').delete()
    .eq('user_id', userId).eq('kind', kind).eq('period', FIRST_FULL_MOCK_PERIOD).eq('reference', String(sessionId)));
  return !gone?.error;
}

/**
 * Was this start already paid for? A device-held start charged on the code before this rule (same generation key, so the same
 * `practice_<id>` reference) keeps its charge and does not spend the free row on a paper that was paid. Throws on a failed read.
 */
export async function startAlreadyPaid(db, { userId, reference }) {
  const read = await settle(db.from('credit_transactions').select('reference').eq('user_id', userId).eq('reference', reference).maybeSingle());
  if (read?.error) throw failed(read.error);
  return Boolean(read?.data);
}

/**
 * The device-held start's decision, after its question set is built: true when this start is the free one (charge nothing),
 * false when it is charged exactly as before (not the rule's start, or a start paid before the rule shipped). `state` is
 * firstFullMockFor's answer for this session. A start that read 'available' and then finds the row taken by another start in
 * the moment between (another device or tab) throws FIRST_FULL_MOCK_TAKEN: its own read said free, so it is never charged
 * without a warning (release 11 verifier L1); nothing is charged and the client asks for a new quote.
 */
export async function takeFirstFullMock(db, { userId, subject, sessionId, reference, state }) {
  if (state === 'mine') return true;
  if (state !== 'available') return false;
  if (await startAlreadyPaid(db, { userId, reference })) return false;
  const claimed = await claimFirstFullMock(db, { userId, subject, sessionId });
  if (claimed === 'taken') throw firstFullMockTakenError();
  return claimed === 'claimed' || claimed === 'mine';
}
