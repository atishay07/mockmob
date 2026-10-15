// Mistake Repair, the check (CEO decision, 16 Oct 2026): after the explanation, the student answers ONE fresh,
// unseen, published bank question on the same idea, marked by the server against today's key. It is included in the
// repair's credit (no second charge), stores its result on the repair's committed reservation receipt, writes the
// student's progress for that question, and sends the rule to Revise.
//
// PURE: no I/O. src/services/recovery/repairCheck.js reads and writes; this file holds the rules, so a fixture can
// prove them (data/tests/repair_check.test.mjs, data/tests/fixtures/repair4/*.json).
//
// Truth rules held here:
//  - the question is never generated: it is a candidate the caller already read from the bank and passed through the
//    publication gate (readablePracticeQuestions: evidence, answer integrity, family holds);
//  - it is never one the student has seen: not in the seen set the caller built (progress, attempts, interactions,
//    sessions), not the mistake itself, not in the mistake's family, not a near copy of its stem;
//  - held, disputed, quarantined and key-disputed questions are excluded again here, so a gate change upstream cannot
//    let one through;
//  - the pick is deterministic (a stable hash tie-break), so a reload shows the same question;
//  - marking uses today's key text, read again at the moment of the answer.
import { createHash } from 'node:crypto';
import { correctIndexOf } from './mistake_repair.js';
import { verifyAnswerIntegrity } from './answer_integrity.js';
import { isPassageLinkedQuestion } from './nta_question_selector.js';
import { contentTokens, jaccard, ntaKeyDispute, ntaQuarantine, NEAR_DUPLICATE_STEM_JACCARD } from './nta_item_checks.js';
import { plainOptionTexts } from './option_text.js';
import { optionHash } from './cohort_picks.js';

export const CHECK_VERSION = 1;
/** One question, four options (answer integrity requires four). */
export const CHECK_OPTION_COUNT = 4;
/** The bank explanation shown after the answer is cut here, at a sentence end, like the repair's reference text. */
export const CHECK_EXPLANATION_CAP = 900;
export const CHECK_REQUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;

/** Why there is no check, in words a student can read. Codes are stable for the clients. */
export const CHECK_REASONS = Object.freeze({
  no_unseen: 'No unseen question on this idea yet.',
  passage_format: 'This one needs its reading passage, so there is no short check for it.',
  repair_first: 'The check comes with the repair. Explain this mistake first.',
  not_saved: 'This repair was not saved, so there is no check to open. Nothing was charged.',
  lookup_failed: 'We could not confirm which questions you have already seen, so we are not offering one. Nothing was charged.',
  check_unavailable: 'The check is not available right now. Nothing was charged.',
  check_changed: 'That question is no longer available for the check. Open it again to get a new one.',
  invalid_pick: 'Pick one of the four options.',
});
export const checkReasonMessage = (code) => CHECK_REASONS[code] || CHECK_REASONS.check_unavailable;

const text = (value) => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim());
const lower = (value) => text(value).toLowerCase();
const stemOf = (row) => text(row?.question ?? row?.body);
const familyOf = (row) => row?.family_id || row?.familyId || row?.template_id || row?.evidence?.record?.family_id || null;
const hash = (value) => createHash('sha256').update(String(value)).digest('hex');

/** The question's format, for "same format when possible": its stored type, else a form read from the stem. */
export function formatOf(row) {
  const type = lower(row?.question_type ?? row?.questionType);
  if (type) return type;
  const stem = stemOf(row);
  if (/\bassertion\b/i.test(stem) && /\breason\b/i.test(stem)) return 'assertion_reason';
  if (/\blist[\s-]*i\b/i.test(stem) || /\bmatch (the )?(following|list|column)/i.test(stem)) return 'match';
  if (/\b(statement|statements)\s*(i|1)\b/i.test(stem) || /\bconsider the (following )?statements\b/i.test(stem)) return 'statements';
  return 'mcq';
}

const idOf = (row) => String(row?.id ?? '');

/**
 * Why this candidate cannot be the check, or null when it can. `mistake` is the live row of the question the student
 * got wrong; `seen` and `excluded` are sets of question ids.
 */
export function rejectReason(row, { mistake, seen = new Set(), excluded = new Set(), mistakeTokens = null } = {}) {
  const id = idOf(row);
  if (!id) return 'no_id';
  if (id === idOf(mistake)) return 'same_question';
  if (!row || row.is_deleted) return 'deleted';
  if (['pending', 'quarantined', 'rejected', 'invalid'].includes(row.status) || row.verification_state === 'disputed') return 'held';
  if (row.exploration_state === 'pending_review') return 'held';
  if (excluded.has(id) || ntaKeyDispute(id) || ntaQuarantine(id) || ntaQuarantine(id.replace(/-/g, ''))) return 'held';
  if (seen.has(id)) return 'seen';
  if (isPassageLinkedQuestion(row)) return 'passage';
  if (!stemOf(row)) return 'no_stem';
  if (row.is_cuet_syllabus === false) return 'off_syllabus';
  if (!verifyAnswerIntegrity(row).accepted) return 'integrity';
  const family = familyOf(row);
  const mistakeFamily = familyOf(mistake);
  if (family && mistakeFamily && family === mistakeFamily) return 'same_family';
  if (row.duplicate_group_id && mistake?.duplicate_group_id && row.duplicate_group_id === mistake.duplicate_group_id) return 'same_family';
  if (row.content_hash && mistake?.content_hash && row.content_hash === mistake.content_hash) return 'same_family';
  const tokens = mistakeTokens ?? contentTokens(stemOf(mistake));
  if (tokens.size && jaccard(tokens, contentTokens(stemOf(row))) >= NEAR_DUPLICATE_STEM_JACCARD) return 'near_copy';
  return null;
}

/** "concept" when the concept id matches, "topic" when the topic text matches, else "chapter". */
export function basisOf(row, mistake) {
  const conceptId = text(mistake?.concept_id ?? mistake?.conceptId);
  if (conceptId && conceptId === text(row?.concept_id ?? row?.conceptId)) return 'concept';
  const topic = lower(mistake?.topic);
  if (topic && topic === lower(row?.topic)) return 'topic';
  return 'chapter';
}
const BASIS_RANK = { concept: 0, topic: 1, chapter: 2 };

/** The honest line for what the check question shares with the mistake. */
export function basisLine(basis, mistake) {
  if (basis === 'concept') return `Same concept: ${text(mistake?.concept) || text(mistake?.topic) || text(mistake?.chapter)}`;
  if (basis === 'topic') return `Same topic: ${text(mistake?.topic)}`;
  return `Same chapter: ${text(mistake?.chapter)}`;
}

/**
 * Picks the one check question. Candidates are rows the caller read from the same subject and chapter and passed
 * through the publication gate. Order: same concept, then same topic, then same chapter; within that, the same format
 * first; then a stable hash of (user, mistake, candidate), so a reload shows the same question and different students
 * and mistakes spread over the pool.
 *
 * Returns { ok:true, row, basis, basisLine, pool:{ ofChapter, unseen } } or { ok:false, reason, pool }.
 * `pool.ofChapter` is every candidate considered; `pool.unseen` is how many of them could be the check (the count and
 * its denominator, shown on a "none" so the student can see why).
 */
export function selectCheckQuestion({ mistake, candidates = [], seen = new Set(), excluded = new Set(), userId = '', mistakeKey = '' } = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const pool = { ofChapter: list.length, unseen: 0 };
  if (isPassageLinkedQuestion(mistake)) return { ok: false, reason: 'passage_format', pool };
  const mistakeTokens = contentTokens(stemOf(mistake));
  const eligible = list.filter((row) => rejectReason(row, { mistake, seen, excluded, mistakeTokens }) === null);
  pool.unseen = eligible.length;
  if (!eligible.length) return { ok: false, reason: 'no_unseen', pool };
  const format = formatOf(mistake);
  const ranked = eligible.map((row) => ({ row, basis: basisOf(row, mistake), sameFormat: formatOf(row) === format, tie: hash(`${userId}|${mistakeKey}|${idOf(row)}`) }))
    .sort((a, b) => BASIS_RANK[a.basis] - BASIS_RANK[b.basis] || Number(b.sameFormat) - Number(a.sameFormat) || (a.tie < b.tie ? -1 : a.tie > b.tie ? 1 : 0));
  const top = ranked[0];
  return { ok: true, row: top.row, basis: top.basis, basisLine: basisLine(top.basis, mistake), sameFormat: top.sameFormat, pool, eligibleIds: ranked.map((r) => idOf(r.row)) };
}

/** Whether `checkQuestionId` is still an acceptable check for this mistake (any of the eligible ones, not only the first). */
export function checkIsStillOffered(selection, checkQuestionId) {
  return selection?.ok === true && selection.eligibleIds.includes(String(checkQuestionId));
}

/**
 * The display order of the options: a seeded permutation, never the stored order, so the answer is not "the one that was
 * third last time". order[i] is the stored index of the option shown in place i. The same seed always gives the same
 * order, so a reload and the marking agree without the client sending the order back.
 */
export function shuffledOrder(seed, count = CHECK_OPTION_COUNT) {
  const order = Array.from({ length: count }, (_, i) => i);
  let stream = hash(`order|${seed}`);
  const next = () => { stream = hash(stream); return parseInt(stream.slice(0, 8), 16); };
  for (let i = count - 1; i > 0; i -= 1) {
    const j = next() % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (count > 1 && order.every((stored, i) => stored === i)) order.push(order.shift());
  return order;
}

/** The question as the student sees it before answering: stem and shuffled options, NO key, no explanation. */
export function checkQuestionView(row, order) {
  const texts = plainOptionTexts(row.options);
  return {
    id: idOf(row),
    subject: row.subject ?? null,
    chapter: row.chapter ?? null,
    topic: row.topic ?? null,
    question: stemOf(row),
    format: formatOf(row),
    options: order.map((stored, index) => ({ index, text: text(texts[stored]) })),
  };
}

/** The bank explanation, cut at a sentence end. Empty when the bank has none. */
export function bankExplanation(row, cap = CHECK_EXPLANATION_CAP) {
  const raw = typeof row?.explanation === 'string' ? row.explanation : typeof row?.explanation?.text === 'string' ? row.explanation.text : '';
  const clean = raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean || clean.length <= cap) return clean;
  const head = clean.slice(0, cap + 1);
  let cut = -1;
  for (const m of head.matchAll(/[.?!](?=\s)/g)) if (m.index + 1 <= cap) cut = m.index + 1;
  if (cut > 0) return clean.slice(0, cut);
  const space = head.lastIndexOf(' ', cap);
  return clean.slice(0, space > 0 ? space : cap);
}

/**
 * Marks one answer against the question's key as it stands now. `pick` is the DISPLAY index the student chose;
 * `order` maps display to stored. Returns { ok:true, right, pickedStored, keyStored, keyDisplay, keyText, pickedText,
 * keyHash } or { ok:false, reason }.
 */
export function markCheck({ row, order, pick }) {
  if (!Number.isInteger(pick) || pick < 0 || pick >= order.length) return { ok: false, reason: 'invalid_pick' };
  if (!verifyAnswerIntegrity(row).accepted) return { ok: false, reason: 'check_changed' };
  const keyStored = correctIndexOf(row);
  if (!Array.isArray(row.options) || keyStored < 0 || keyStored >= row.options.length || row.options.length !== order.length) return { ok: false, reason: 'check_changed' };
  const texts = plainOptionTexts(row.options);
  const pickedStored = order[pick];
  return {
    ok: true,
    right: pickedStored === keyStored,
    pickedStored, keyStored,
    keyDisplay: order.indexOf(keyStored),
    keyText: text(texts[keyStored]), pickedText: text(texts[pickedStored]),
    keyHash: optionHash(row.options[keyStored]),
  };
}

/**
 * The one-sentence outcome. It says what happened on one question and where it came from; it never claims the idea is
 * learned, never forecasts and never says what the mark "would have been".
 */
export function outcomeLine({ right, basis, revise }) {
  const where = basis === 'concept' ? 'the same concept' : basis === 'topic' ? 'the same topic' : 'the same chapter';
  if (right) return `Right on a new question from ${where}. One question is a check, not a measure.`;
  return revise?.scheduled
    ? `Missed on a new question from ${where}. It is in Revise ${revise.whenLabel || 'soon'}.`
    : `Missed on a new question from ${where}. Read the key and the explanation below.`;
}

// India time, for the Revise day (counted in IST days, like Revise itself).
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;
export const istDate = (ms) => new Date(Number(ms) + IST_OFFSET_MS).toISOString().slice(0, 10);
export const addDays = (date, n) => new Date(Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS) * DAY_MS + n * DAY_MS).toISOString().slice(0, 10);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dayLabel(date) {
  const t = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
}
/** The instant a Revise day starts: 00:00 India time on that date. */
export const dayStartIso = (date) => new Date(Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MS).toISOString();

/**
 * The Revise cards one check writes, in the revise_cards shape of supabase/migrations/20261015210100_revise_cards.sql
 * (box 1, due the next India day). The mistake always goes back (it is the wrong answer this loop is about); the check
 * question goes too when it was missed. Existing cards are never reset by this (the write ignores duplicates).
 */
export function planReviseCards({ mistake, checkRow, right, nowMs, mistakeWrongAt = null, keyHashOf = (row) => { const i = correctIndexOf(row); return i >= 0 ? optionHash(row.options[i]) : null; } }) {
  const today = istDate(nowMs);
  const dueDay = addDays(today, 1);
  const card = (row, wrongAt) => ({ question_id: idOf(row), box: 1, due_day: dueDay, state: 'active', right_total: 0, key_hash: keyHashOf(row), wrong_at: wrongAt });
  const rows = [card(mistake, mistakeWrongAt)];
  if (!right) rows.push(card(checkRow, new Date(nowMs).toISOString()));
  return { dueDay, whenLabel: 'tomorrow', rows };
}

/** The Revise result the client shows. `unavailable` when the table does not exist yet (nothing was written). */
export function reviseSummary({ written, dueDay, nowMs }) {
  if (!written) return { scheduled: false, reason: 'unavailable', nextAt: null };
  const tomorrow = addDays(istDate(nowMs), 1);
  return { scheduled: true, nextAt: dayStartIso(dueDay), dueDay, whenLabel: dueDay === tomorrow ? 'tomorrow' : dayLabel(dueDay), cards: written };
}
