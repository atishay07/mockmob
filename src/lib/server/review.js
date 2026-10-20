// Review on the server (LEARN-REVIEW-1017 packet P-LR0): ONE read-only join of everything Review draws, so the website and
// the app show the same mistakes, the same repairs and the same Revise count. No 'server-only' on purpose, so node:test can
// load it with a fake client; the clients are injected (src/app/api/me/review/route.js wires the real ones).
//
//   getReview(userId, deps)   GET /api/me/review: { http, body }. Writes NOTHING (no seeding of Revise cards, no ledger rows).
//
// It joins four reads of the student's own data:
//   attempts               the newest ATTEMPT_WINDOW papers: a slim read of all of them, and the heavy columns (details,
//                          questions_snapshot) only for the papers that have a wrong answer or a blank
//   ai_credit_reservations the saved repairs (committed score_recovery_repair, receipt.repair) and each repair's Check it held
//                          (receipt.check.right), the same rows src/lib/server/repairSaved.js reads, so a repaired mistake is
//                          never shown as open (F17, L12)
//   revise_cards           what is due in Revise today, by `mode` ('question' or 'again'); a missing `mode` column reads as 'question'
//   questions              the keys that are not trusted (withdrawn, held, disputed): those mistakes are left out of repairs
// The body never carries an answer key, an option or an explanation: a stem's first line, the pick's letter, states and dates.
//
// Failure rules (L12): a failed read of the papers or of the saved repairs is a 503 with state 'unavailable', never an empty
// body, because "could not look" must not read as "nothing to review" or as "nothing repaired yet" (the second would offer a
// paid repair twice). A failed read of Revise cards, of the lesson cards or of the keys degrades one part and says so
// (`reviseDue.unknown`), it never shows zero for unknown.
import { SUBJECTS } from '../../../data/subjects.js';
import { istDate, boxCounts } from '../../../data/revise.js';
import { paperKind } from '../../../data/result_next_move.mjs';
import { reviewBody } from '../../../data/review_input.mjs';
import { sourceLabels } from '../../components/recovery/repairRun.js';
import { mistakeKey, repairIdFromOperationKey } from './repairRecord.js';
import { repairFromReceipt, SAVED_WINDOW } from './repairSaved.js';
import { attemptHold } from '../mob/paperHold.mjs';
import { readSlimRows } from '../../../data/attempt_reads.js';

export const REVIEW_VERSION = 1;
/** The newest papers Review reads: all are listed, those with a miss are read in full. Older papers are left out and `partial` says so. */
export const ATTEMPT_WINDOW = 40;
const SLIM_PAGE = 1000; // the slim read of every attempt, to number "Mock 3" over the whole history
const HEAVY_CHUNK = 8;
const KEY_CHUNK = 100;
const STEM_MAX = 140;
const LETTERS = 'ABCDEFGH';

const UNAVAILABLE = 'Your mistakes did not load.';
const fail = (code, cause) => Object.assign(new Error(code), { code, cause });
const client = async (db) => db || (await import('../supabase')).supabaseAdmin();
const columnMissing = (error) => /42703|column .*does not exist|schema cache/i.test(`${error?.code || ''} ${error?.message || ''}`);
const tableMissing = (error) => /42P01|PGRST20[45]|relation .* does not exist|schema cache/i.test(`${error?.code || ''} ${error?.message || ''}`);

const sentence = (id = '') => { const t = String(id).replace(/_/g, ' ').trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
const subjectName = (id) => SUBJECTS.find((s) => s.id === id)?.name || sentence(id);
const iso = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/** The first line of a stem, whitespace folded, cut at STEM_MAX at a word. */
export function stemLine(question) {
  const first = String(question?.question ?? question?.body ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  const text = first.replace(/\s+/g, ' ');
  if (text.length <= STEM_MAX) return text;
  const cut = text.slice(0, STEM_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60)).trimEnd()}…`;
}

/** A key that must not be repaired against: the question is gone, withdrawn, held or under a content dispute. */
export const keyUnderReview = (row) => !row || row.is_deleted === true || ['pending', 'quarantined', 'rejected', 'invalid'].includes(row.status) || row.verification_state === 'disputed';

/**
 * The saved repairs, by the repair id (the hash of user, attempt and question): the newest acknowledgment and, when the
 * Check it held was answered, its outcome. reservations: [{ operation_key, updated_at, receipt }].
 */
export function repairsById(reservations) {
  const out = new Map();
  for (const r of reservations || []) {
    const repair = repairFromReceipt(r?.receipt);
    if (!repair) continue;
    const id = repairIdFromOperationKey(r.operation_key);
    const at = iso(r.updated_at);
    if (!id || !at) continue;
    let receipt = r.receipt;
    if (typeof receipt === 'string') { try { receipt = JSON.parse(receipt); } catch { receipt = null; } }
    const check = receipt?.check && typeof receipt.check === 'object' && typeof receipt.check.right === 'boolean'
      ? { right: receipt.check.right, answeredAt: iso(receipt.check.answeredAt) } : null;
    const have = out.get(id);
    out.set(id, { repairedAt: !have || at > have.repairedAt ? at : have.repairedAt, check: have?.check || check });
  }
  return out;
}

/**
 * The record GET /api/me/review is built from (the shape data/tests/fixtures/review/student.json documents). PURE.
 *   slim          [{ id, subject, correct, wrong, unattempted, total, completed_at, mode }] every attempt, newest first
 *   heavy         Map(attemptId -> { details, questions_snapshot }) for the papers with a miss
 *   reservations  committed repair reservations
 *   cards         [{ question_id, box, due_day, state, last_recalled_day, mode? }] or null when unreadable
 *   keyRows       Map(questionId -> { is_deleted, status, verification_state }) or null when unreadable
 *   dueCards      lesson cards due today, or null when unknown
 */
export function buildReviewRecord({ userId, slim = [], heavy = new Map(), reservations = [], cards = null, keyRows = null, dueCards = null, wallet = null, now = Date.now(), cap = 10 }) {
  const window = slim.slice(0, ATTEMPT_WINDOW);
  const labels = sourceLabels(slim.map((a) => ({ id: a.id, subject: a.subject, completedAt: Date.parse(a.completed_at), mode: a.mode || null })));
  const today = istDate(now);
  const repairs = repairsById(reservations);
  const cardOf = new Map((cards || []).map((c) => [c.question_id, c]));

  // A Mob paper still open for the Mob (src/lib/mob/paperHold.mjs) is listed with its marks and when its answers open, and
  // none of its questions becomes a mistake to fix until it closes.
  const holds = new Map();
  for (const a of window) { const hold = a.mobPaper ? attemptHold({ mobPaper: a.mobPaper }, now) : null; if (hold) holds.set(a.id, hold); }
  const papers = window.map((a) => ({
    id: a.id, name: labels.get(a.id) || 'Quick practice', subject: a.subject, subjectName: subjectName(a.subject),
    kind: paperKind(a.mode || null), mode: a.mode || null, at: iso(a.completed_at),
    questions: Number(a.total) || 0, right: Number(a.correct) || 0, wrong: Number(a.wrong) || 0, blank: Number(a.unattempted) || 0,
    score: (Number(a.correct) || 0) * 5 - (Number(a.wrong) || 0), of: (Number(a.total) || 0) * 5,
    ...(holds.has(a.id) ? { held: { until: holds.get(a.id).until, line: holds.get(a.id).short } } : {}),
  }));

  const chapters = new Map();
  const items = [];
  // Pass 1018: how many questions of each chapter each paper asked (right answers included), so Review prices a chapter
  // against the marks it had on offer. Only the papers with a miss are read in full; a paper with none lost no marks.
  const chapterQuestions = {};
  for (const a of window) {
    const body = holds.has(a.id) ? null : heavy.get(a.id);
    if (!body) continue;
    const asked = {};
    for (const q of Array.isArray(body.questions_snapshot) ? body.questions_snapshot : []) {
      if (!q || typeof q.id !== 'string') continue;
      const name = typeof q.chapter === 'string' && q.chapter.trim() ? q.chapter.trim() : 'Chapter';
      asked[`${a.subject}:${name}`] = (asked[`${a.subject}:${name}`] || 0) + 1;
    }
    chapterQuestions[a.id] = asked;
    const details = new Map((Array.isArray(body.details) ? body.details : []).filter((d) => d && typeof d.qid === 'string').map((d) => [d.qid, d]));
    (Array.isArray(body.questions_snapshot) ? body.questions_snapshot : []).forEach((q, index) => {
      if (!q || typeof q.id !== 'string') return;
      const d = details.get(q.id);
      if (d?.isCorrect === true) return;
      const wrong = d?.isCorrect === false && Number.isInteger(d?.givenIndex);
      const name = typeof q.chapter === 'string' && q.chapter.trim() ? q.chapter.trim() : 'Chapter';
      const chapterId = `${a.subject}:${name}`;
      if (!chapters.has(chapterId)) chapters.set(chapterId, { id: chapterId, name, subject: a.subject, subjectName: subjectName(a.subject) });
      const item = { paper: a.id, q: index + 1, qid: q.id, ch: chapterId, state: wrong ? 'open' : 'blank', stem: stemLine(q) };
      if (wrong) {
        item.pick = LETTERS[d.givenIndex] || null;
        const saved = repairs.get(mistakeKey(userId, a.id, q.id));
        if (saved) {
          item.repairedAt = saved.repairedAt;
          item.state = saved.check ? (saved.check.right ? 'held' : 'slipped') : 'repaired';
          if (saved.check) item.checkedAt = saved.check.answeredAt;
          const card = cardOf.get(q.id);
          if (card && card.state === 'active') item.reviseNext = card.due_day;
        }
      }
      // Only a wrong answer has a key worth distrusting: a blank is tried again free, and its key was not read.
      if (wrong && keyRows && keyUnderReview(keyRows.get(q.id)) && item.state !== 'held') item.keyState = 'under_review';
      items.push(item);
    });
  }

  // Revise: what is due today, by source. A card for a question is one card, whichever mode; Review again (mode 'again')
  // plays a repaired mistake before the key shows, so a question due in both plays once (data/review_input.mjs reviseDue).
  const active = (cards || []).filter((c) => c.state === 'active');
  const due = active.filter((c) => c.due_day <= today);
  const pendingChecks = items.filter((i) => i.state === 'repaired' && i.repairedAt && istDate(Date.parse(i.repairedAt)) < today).map((i) => `${i.paper}:${i.qid}`);
  const revise = {
    rotation: cards === null ? null : active.length,
    boxes: cards === null ? null : boxCounts(cards),
    cap,
    answeredToday: cards === null ? 0 : cards.filter((c) => c.last_recalled_day === today).length,
    sources: {
      questions: cards === null ? null : due.filter((c) => (c.mode || 'question') !== 'again').map((c) => c.question_id),
      again: cards === null ? null : due.filter((c) => c.mode === 'again').map((c) => c.question_id),
      checks: pendingChecks,
      cards: dueCards,
    },
  };

  const state = papers.length ? 'ready' : 'empty';
  return {
    state, now: new Date(now).toISOString(), wallet,
    papers, chapters: [...chapters.values()], chapterQuestions, items, revise,
    partial: slim.length > window.length || slim.length >= SLIM_PAGE,
    papersTotal: slim.length,
    papersBySubject: paperCounts(slim),
  };
}

/**
 * Every paper the slim read holds, counted per subject and kind: { [subject]: { total, kinds: { [kind]: n } } }. The list
 * shows only the newest ATTEMPT_WINDOW papers, so "Papers sat" and "Your first practice set in English" are counted here, over
 * the whole history (release 11 verifier L3 and M2), never over the window.
 */
export function paperCounts(slim = []) {
  const out = {};
  for (const a of slim) {
    const subject = String(a?.subject || '');
    if (!subject) continue;
    const kind = paperKind(a.mode || null);
    const g = out[subject] || (out[subject] = { total: 0, kinds: {} });
    g.total += 1;
    g.kinds[kind] = (g.kinds[kind] || 0) + 1;
  }
  return out;
}

async function readSlim(db, userId) {
  const res = await db.from('attempts')
    .select('id,subject,correct,wrong,unattempted,total,completed_at,mode:selection_meta->>mode,mobPaper:selection_meta->mobPaper')
    .eq('user_id', userId).order('completed_at', { ascending: false }).order('id').range(0, SLIM_PAGE - 1);
  if (res.error) throw fail('REVIEW_ATTEMPTS_UNAVAILABLE', res.error);
  return res.data || [];
}

async function readHeavy(db, userId, ids) {
  const out = new Map();
  // Review reads from a paper's snapshot only each question's id, chapter and stem (buildReviewRecord), so a database function
  // reduces it before it ships, for all the papers in ONE call (egress A6). Where no function is there, the old chunked table read.
  let viaFunction;
  try { viaFunction = await readSlimRows(db, userId, 'review', { ids }); } catch (e) { throw fail('REVIEW_ATTEMPTS_UNAVAILABLE', e); }
  if (viaFunction) {
    for (const row of viaFunction) out.set(row.id, { id: row.id, details: row.details, questions_snapshot: row.questions_snapshot });
    return out;
  }
  for (let i = 0; i < ids.length; i += HEAVY_CHUNK) {
    const res = await db.from('attempts').select('id,details,questions_snapshot').eq('user_id', userId).in('id', ids.slice(i, i + HEAVY_CHUNK));
    if (res.error) throw fail('REVIEW_ATTEMPTS_UNAVAILABLE', res.error);
    for (const row of res.data || []) out.set(row.id, row);
  }
  return out;
}

async function readReservations(db, userId) {
  const res = await db.from('ai_credit_reservations').select('operation_key,updated_at,receipt')
    .eq('user_id', userId).eq('state', 'committed').eq('action', 'score_recovery_repair')
    .not('receipt->repair', 'is', null).order('updated_at', { ascending: false }).limit(SAVED_WINDOW);
  if (res.error) throw fail('REVIEW_REPAIRS_UNAVAILABLE', res.error);
  return res.data || [];
}

/** The student's Revise cards, or null when they cannot be read (then Revise's counts are unknown, not zero). */
async function readCards(db, userId) {
  const cols = 'question_id,box,due_day,state,last_recalled_day';
  let res = await db.from('revise_cards').select(`${cols},mode`).eq('user_id', userId).limit(2000);
  if (res.error && columnMissing(res.error) && !tableMissing(res.error) && /mode/i.test(res.error.message || '')) {
    res = await db.from('revise_cards').select(cols).eq('user_id', userId).limit(2000); // the mode migration is not applied yet
  }
  if (res.error) return null;
  return res.data || [];
}

async function readKeys(db, ids) {
  const out = new Map();
  const list = [...new Set(ids)];
  for (let i = 0; i < list.length; i += KEY_CHUNK) {
    const res = await db.from('questions').select('id,status,is_deleted,verification_state').in('id', list.slice(i, i + KEY_CHUNK));
    if (res.error) return null;
    for (const row of res.data || []) out.set(row.id, row);
  }
  return out;
}

/**
 * The record GET /api/me/review and GET /api/me/revise are built from: one read of the papers, the saved repairs, the Revise
 * cards and the keys. Throws REVIEW_ATTEMPTS_UNAVAILABLE or REVIEW_REPAIRS_UNAVAILABLE when the papers or the repairs cannot be
 * read (never an empty record: L12). `cards` may be passed when the caller already read them (Revise seeds first); `undefined`
 * reads them here. A failed read of the cards, the lesson cards or the keys degrades one part (null = unknown).
 */
export async function loadReviewRecord(userId, { db, wallet = null, readDueCards = null, cap = 10, now = Date.now(), cards } = {}) {
  const c = await client(db);
  const slim = await readSlim(c, userId);
  const window = slim.slice(0, ATTEMPT_WINDOW);
  const heavy = await readHeavy(c, userId, window.filter((a) => ((Number(a.wrong) || 0) > 0 || (Number(a.unattempted) || 0) > 0) && !(a.mobPaper && attemptHold({ mobPaper: a.mobPaper }, now))).map((a) => a.id));
  const reservations = slim.some((a) => (Number(a.wrong) || 0) > 0) ? await readReservations(c, userId) : [];
  const wrongIds = [];
  for (const body of heavy.values()) {
    const details = Array.isArray(body.details) ? body.details : [];
    for (const d of details) if (d?.isCorrect === false && typeof d.qid === 'string') wrongIds.push(d.qid);
  }
  const [readCardsOut, keyRows, dueCards] = await Promise.all([
    cards === undefined ? readCards(c, userId).catch(() => null) : Promise.resolve(cards),
    wrongIds.length ? readKeys(c, wrongIds).catch(() => null) : Promise.resolve(new Map()),
    typeof readDueCards === 'function' ? Promise.resolve().then(readDueCards).catch(() => null) : Promise.resolve(null),
  ]);
  return buildReviewRecord({ userId, slim, heavy, reservations, cards: readCardsOut, keyRows, dueCards, wallet, now, cap });
}

/**
 * GET /api/me/review. Returns { http, body }. `wallet` is { aiCredits, aiRenews, practiceCredits, isPremium } or null (unknown),
 * `readDueCards` returns the lesson cards due today or null. Both are injected so a failed read never reaches this file.
 */
export async function getReview(userId, deps = {}) {
  let record;
  try {
    record = await loadReviewRecord(userId, deps);
  } catch (e) {
    return unavailable(e);
  }
  return { http: 200, body: { ...reviewBody(record), partial: record.partial, papersTotal: record.papersTotal, papersBySubject: record.papersBySubject } };
}

function unavailable(error) {
  return { http: 503, body: { version: REVIEW_VERSION, state: 'unavailable', message: UNAVAILABLE, cause: error?.code || 'unavailable' } };
}
