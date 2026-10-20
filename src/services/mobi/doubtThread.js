// Mobi's doubt thread ("Ask now", C-dec 3 and 3b, 20 Oct 2026): one credit settles a doubt. It buys Mobi's answer, one
// follow-up inside the same thread, and 2 real CUET questions from the verified bank on that chapter, which the student
// answers in the app and the server marks. Never a credit a message.
//
// No 'server-only' and no alias imports on purpose: src/services/mobi/doubtThreadDeps.js wires the database, the wallet and
// the model client in, and data/tests/mobi_doubt_thread.test.mjs wires fakes in, so every rule (charged once per thread,
// the follow-up cap, nothing charged on failure, verified questions only) is tested without a database or a paid model.
//
// Cost (C-dec 3b: a job's model cost stays a small fraction of its credit). One credit is Rs 0.163 on the web's 300 pack
// and Rs 0.25 on Play's. The opening reply is one GPT-6 Luna call (measured on production: about Rs 0.027 on average and
// Rs 0.042 at the worst, AI-COST-PER-USER-2026-10-17); the one follow-up is a shorter call on a much smaller context
// (THREAD_FOLLOW_UP_MAX_TOKENS, the thread alone). The 2 questions take no call. So a whole thread is about Rs 0.05 on
// average and under Rs 0.08 at the worst. That is why a thread includes one follow-up, not five (depth over volume).
import { createHash } from 'node:crypto';
import { isPassageLinkedQuestion } from '../../../data/nta_question_selector.js';
import { optionTextHashes, orderFromHashes, checkQuestionView, markCheck, bankExplanation, familyOf, CHECK_REQUEST_ID } from '../../../data/repair_check.js';

export const THREAD_VERSION = 1;
export const THREAD_CREDIT_COST = 1;
export const THREAD_FOLLOW_UPS = 1;
export const THREAD_CHECKS = 2;
export const THREAD_FOLLOW_UP_MAX_TOKENS = 500;
// How many verified rows the publication gate reads per batch, and at most, while looking for the 2 questions.
export const THREAD_VERIFY_BATCH = 12;
export const THREAD_VERIFY_MAX = 48;
const TEXT_CAP = 1500;

export const THREAD_COPY = Object.freeze({
  full: 'This doubt has had its follow-up. Ask a new doubt to open a new one, for 1 credit.',
  notFound: 'That doubt could not be found. Ask it again as a new doubt. Nothing was charged.',
  noChapter: 'Pick the chapter and Mobi adds 2 real CUET questions on it to test this.',
  noQuestions: 'There are no unseen checked questions left on this chapter for you just now. Nothing extra was charged.',
  checksUnavailable: 'The 2 questions could not be loaded just now. Open this doubt again to get them. Nothing extra was charged.',
  notOffered: 'That is not one of the questions offered on this doubt.',
  couldNotStart: 'This doubt could not be opened just now. Nothing was charged. Try again.',
  followUpFailed: 'Mobi could not answer that follow-up this time. Nothing was charged, and your follow-up is still there.',
});

const clip = (value, cap = TEXT_CAP) => String(value || '').trim().slice(0, cap);
const norm = (value) => String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['and', 'the', 'of', 'for', 'in', 'on', 'to', 'a', 'an', 'with', 'its', 'by', 'from', 'part', 'class']);
const words = (value) => norm(value).split(' ').filter((w) => w.length >= 3 && !STOP.has(w));

/**
 * Which chapter the 2 questions come from. A starter or a chapter chip sends subject and chapter (kept when the subject is
 * the student's or a CUET subject the catalog knows). A typed doubt is matched against the chapter names of the student's
 * subjects: a chapter matches when every one of its significant words is in the doubt. No match: null (the student picks).
 * `catalog` = [{ subject, chapter }].
 */
export function resolveAnchor({ subject = null, chapter = null, message = '', catalog = [] } = {}) {
  const sentSubject = typeof subject === 'string' ? subject.trim() : '';
  const sentChapter = typeof chapter === 'string' ? chapter.trim() : '';
  if (sentSubject && sentChapter && sentChapter.length <= 160) {
    const known = catalog.find((c) => c.subject === sentSubject && norm(c.chapter) === norm(sentChapter));
    if (known) return { subject: known.subject, chapter: known.chapter, source: 'sent' };
    if (catalog.some((c) => c.subject === sentSubject)) return { subject: sentSubject, chapter: sentChapter, source: 'sent' };
    return null;
  }
  const said = new Set(words(message));
  let best = null;
  for (const c of catalog) {
    const need = words(c.chapter);
    if (!need.length || !need.every((w) => said.has(w))) continue;
    if (!best || need.length > best.size) best = { subject: c.subject, chapter: c.chapter, size: need.length };
  }
  return best ? { subject: best.subject, chapter: best.chapter, source: 'matched' } : null;
}

/** The thread as the client sees it. */
export function threadView(id, thread) {
  const used = Number(thread?.followUpsUsed) || 0;
  const max = Number.isInteger(thread?.followUpsMax) ? thread.followUpsMax : THREAD_FOLLOW_UPS;
  return { id, followUpsLeft: Math.max(0, max - used), followUpsMax: max, subject: thread?.subject ?? null, chapter: thread?.chapter ?? null };
}

const rank = (threadId, id) => createHash('sha256').update(`${threadId}|${id}`).digest('hex');

/**
 * The 2 questions for a thread, from the chapter's candidates: never seen by this student, not under an open dispute, not
 * tied to a passage, past the publication gate (`verify`, the same gate practice and the repair check use), with options
 * that can be told apart by their text, and from two different question families. The order is a stable shuffle per thread.
 * Returns { ok:true, rows } (0 to 2 rows) | { ok:false } when a lookup failed.
 */
export async function chooseThreadChecks({ threadId, userId, subject, chapter, deps, attempt = null, count = THREAD_CHECKS }) {
  let candidates; let seen; let excluded;
  try {
    candidates = (await deps.loadChapterCandidates({ subject, chapter })).filter((row) => row?.id && !isPassageLinkedQuestion(row));
    const ids = candidates.map((row) => row.id);
    seen = await deps.loadSeen({ userId, subject, candidateIds: ids, attempt, candidates });
    excluded = await deps.loadExcluded(ids);
  } catch { return { ok: false }; }
  const open = candidates.filter((row) => !seen.has(row.id) && !excluded.has(row.id)).sort((a, b) => (rank(threadId, a.id) < rank(threadId, b.id) ? -1 : 1));
  const rows = [];
  const families = new Set();
  for (let at = 0; at < Math.min(open.length, THREAD_VERIFY_MAX) && rows.length < count; at += THREAD_VERIFY_BATCH) {
    const batch = open.slice(at, at + THREAD_VERIFY_BATCH);
    let verified;
    try { verified = await deps.verifyPublished(batch.map((row) => row.id)); } catch { return { ok: false }; }
    for (const light of batch) {
      if (rows.length >= count) break;
      const row = verified.get(light.id);
      if (!row || isPassageLinkedQuestion(row)) continue;
      if (!orderFromHashes(row, optionTextHashes(row))) continue;
      const family = familyOf(row);
      if (family && families.has(family)) continue;
      if (family) families.add(family);
      rows.push(row);
    }
  }
  return { ok: true, rows };
}

/** The public question (no key, no explanation). */
export function threadCheckView(row, hashes) {
  const view = checkQuestionView(row, orderFromHashes(row, hashes));
  return { checkQuestionId: view.id, subject: view.subject, chapter: view.chapter, topic: view.topic, format: view.format, question: view.question, passage: null, options: view.options };
}

/**
 * Picks the 2 questions, records each as seen (before it is shown, so practice never offers it as fresh) and returns what
 * is stored on the thread and what is sent. Never throws.
 */
export async function offerChecks({ threadId, userId, anchor, deps }) {
  if (!anchor) return { stored: [], checks: [], note: THREAD_COPY.noChapter };
  const found = await chooseThreadChecks({ threadId, userId, subject: anchor.subject, chapter: anchor.chapter, deps });
  if (!found.ok) return { stored: [], checks: [], note: THREAD_COPY.checksUnavailable, retry: true };
  if (!found.rows.length) return { stored: [], checks: [], note: THREAD_COPY.noQuestions };
  const stored = [];
  const checks = [];
  for (const row of found.rows) {
    try { await deps.recordSeen({ userId, questionId: row.id, mistakeKey: `thread:${threadId}` }); } catch { continue; }
    const hashes = optionTextHashes(row);
    stored.push({ checkQuestionId: row.id, optionHashes: hashes });
    checks.push(threadCheckView(row, hashes));
  }
  if (!checks.length) return { stored: [], checks: [], note: THREAD_COPY.checksUnavailable, retry: true };
  return { stored, checks, note: checks.length < THREAD_CHECKS ? 'Only one unseen checked question was left on this chapter for you.' : null };
}

/**
 * L-01 (20 Oct): a doubt whose reply was lost in transit comes back with the same requestId. Its credit was taken once
 * (the reserve is keyed by the request), so the doubt it bought is replayed: the thread it opened, the stored reply, its
 * questions and any answers already given. Never a second charge and never a second model call. `deps.findOpened`
 * finds the thread by its open key (threadStore). Null when there is nothing to replay.
 */
export async function replayOpened({ user, openKey, deps }) {
  if (!openKey || typeof deps.findOpened !== 'function') return null;
  let found;
  try { found = await deps.findOpened({ userId: user.id, openKey }); } catch { return null; }
  if (!found?.threadId || !found.thread) return null;
  const replyText = String(found.response?.reply || found.thread.reply || '').trim();
  if (!replyText) return null;
  const read = found.thread.state === 'open' ? await readThread({ user, threadId: found.threadId, deps }) : null;
  const fresh = read?.http === 200 ? read.body : null;
  return {
    http: 200, replayed: true, threadId: found.threadId,
    response: found.response?.reply ? found.response : { reply: replyText, cards: [], actions: [] },
    thread: fresh ? fresh.thread : threadView(found.threadId, found.thread),
    checks: fresh ? fresh.checks : [], results: fresh ? fresh.results : {},
    checksNote: fresh ? null : THREAD_COPY.checksUnavailable,
  };
}

/**
 * Opens a thread: the one charged step. A retry of a doubt already answered replays it (replayOpened) before anything
 * else. The thread row is written first (nothing is charged if it cannot be), then the reply runs through the
 * reserve -> commit | release lifecycle (`deps.runReply`, runModelReply), then the 2 questions are attached. A failed
 * reply releases the credit and closes the thread row; nothing is charged. `openKey` is the request's operation key
 * (operationKeyFor(user.id, requestId)), the same key the reserve uses.
 */
export async function openThread({ user, message, requestId, anchor = null, openKey = null, deps }) {
  const earlier = await replayOpened({ user, openKey, deps });
  if (earlier) return earlier;
  const thread = {
    v: THREAD_VERSION, state: 'pending', followUpsUsed: 0, followUpsMax: THREAD_FOLLOW_UPS,
    subject: anchor?.subject ?? null, chapter: anchor?.chapter ?? null, doubt: clip(message), reply: null, checks: [], openedAt: new Date(deps.now()).toISOString(),
  };
  let threadId;
  try { threadId = await deps.createThread({ userId: user.id, title: clip(message, 56), thread }); } catch { threadId = null; }
  if (!threadId) return { http: 503, body: { ok: false, error: 'thread_unavailable', message: THREAD_COPY.couldNotStart, charged: 0 } };

  const out = await deps.runReply({ creditCost: THREAD_CREDIT_COST, threadContext: { thread: { chapter: thread.chapter, subject: thread.subject, part: 'opening' } } });
  if (out.status !== 'answered') {
    try { await deps.updateThread({ id: threadId, userId: user.id, thread: { ...thread, state: 'failed' } }); } catch { /* the row stays pending and is never usable */ }
    // The same request was already answered (its first response was lost): replay that doubt, never "already answered".
    if (out.status === 'duplicate') {
      const again = await replayOpened({ user, openKey, deps });
      if (again) return again;
    }
    return { http: out.http, body: { ok: false, error: out.error || out.status, status: out.status, message: out.message, required: out.required, balance: out.balance, charged: 0 }, threadId: null };
  }
  const offered = await offerChecks({ threadId, userId: user.id, anchor, deps });
  const open = { ...thread, state: 'open', openKey: out.operationKey || null, reply: clip(out.response?.reply), checks: offered.stored };
  try { await deps.updateThread({ id: threadId, userId: user.id, thread: open }); } catch { /* the reply stands; a follow-up then finds no open thread and says so */ }
  return { http: 200, out, threadId, thread: threadView(threadId, open), checks: offered.checks, checksNote: offered.note };
}

/**
 * A follow-up inside an open thread: free. The slot is claimed first (a conditional write, so two taps cannot both use
 * the last one), then one short model call through the runtime guard, which still counts against the student's own
 * monthly AI limit. A failure gives the slot back. Never touches the wallet.
 */
export async function followUpThread({ user, threadId, message, requestId, deps }) {
  if (typeof threadId !== 'string' || threadId.length > 80) return { http: 404, body: { ok: false, error: 'thread_not_found', message: THREAD_COPY.notFound, charged: 0 } };
  let row;
  try { row = await deps.loadThread({ id: threadId, userId: user.id }); } catch { return { http: 503, body: { ok: false, error: 'thread_unavailable', message: THREAD_COPY.couldNotStart, charged: 0 } }; }
  const thread = row?.thread;
  if (!thread || thread.state !== 'open') return { http: 404, body: { ok: false, error: 'thread_not_found', message: THREAD_COPY.notFound, charged: 0 } };
  const used = Number(thread.followUpsUsed) || 0;
  const max = Number.isInteger(thread.followUpsMax) ? thread.followUpsMax : THREAD_FOLLOW_UPS;
  if (used >= max) return { http: 409, body: { ok: false, error: 'thread_full', message: THREAD_COPY.full, charged: 0, thread: threadView(threadId, thread) } };
  if (!CHECK_REQUEST_ID.test(String(requestId || ''))) return { http: 400, body: { ok: false, error: 'request_id_required', message: 'Something went wrong sending that. Nothing was charged. Try again.', charged: 0 } };

  let claimed = false;
  try { claimed = await deps.claimFollowUp({ id: threadId, userId: user.id, used }); } catch { claimed = false; }
  if (!claimed) return { http: 409, body: { ok: false, error: 'thread_full', message: THREAD_COPY.full, charged: 0, thread: threadView(threadId, { ...thread, followUpsUsed: max }) } };
  const giveBack = async () => { try { await deps.returnFollowUp({ id: threadId, userId: user.id, used: used + 1 }); } catch { /* the slot stays used; nothing was charged */ } };

  let ai;
  try {
    ai = await deps.generate({
      requestKey: `thread:${threadId}:${used + 1}:${requestId}`.slice(0, 180), message: clip(message),
      maxTokens: THREAD_FOLLOW_UP_MAX_TOKENS,
      context: { exam: 'CUET', contextVersion: 1, thread: { subject: thread.subject, chapter: thread.chapter, doubt: thread.doubt, mobiAnswer: thread.reply, part: 'follow_up' } },
    });
  } catch { ai = null; }
  const response = ai?.ok && ai.data && ai.schemaValid !== false ? deps.sanitize(ai.data) : null;
  if (!response?.reply || !String(response.reply).trim()) {
    await giveBack();
    const limit = ai?.failure?.kind === 'user_budget';
    return { http: limit ? 429 : 502, body: { ok: false, error: limit ? 'user_limit_reached' : 'unusable_output', message: limit && deps.limitMessage ? deps.limitMessage() : THREAD_COPY.followUpFailed, charged: 0 } };
  }
  const receipt = { provider: ai.usage?.provider || null, model: ai.usage?.model || null, inputTokens: ai.usage?.inputTokens || 0, outputTokens: ai.usage?.outputTokens || 0, fallbackUsed: Boolean(ai.fallbackUsed) };
  return { http: 200, response, receipt, thread: threadView(threadId, { ...thread, followUpsUsed: used + 1 }) };
}

/** GET: the thread, its questions and any answers already given. */
export async function readThread({ user, threadId, deps }) {
  let row;
  try { row = await deps.loadThread({ id: threadId, userId: user.id }); } catch { return { http: 503, body: { ok: false, error: 'thread_unavailable', message: THREAD_COPY.checksUnavailable } }; }
  const thread = row?.thread;
  if (!thread || thread.state !== 'open') return { http: 404, body: { ok: false, error: 'thread_not_found', message: THREAD_COPY.notFound } };
  const ids = (thread.checks || []).map((c) => c.checkQuestionId);
  let rows = new Map();
  try { if (ids.length) rows = await deps.verifyPublished(ids); } catch { return { http: 503, body: { ok: false, error: 'thread_unavailable', message: THREAD_COPY.checksUnavailable } }; }
  const checks = [];
  const results = {};
  for (const c of thread.checks || []) {
    const r = rows.get(c.checkQuestionId);
    if (r && orderFromHashes(r, c.optionHashes)) checks.push(threadCheckView(r, c.optionHashes));
    if (c.result) results[c.checkQuestionId] = c.result;
  }
  return { http: 200, body: { ok: true, thread: threadView(threadId, thread), checks, results } };
}

/** POST op 'checks': attaches the 2 questions once, to a thread that has none (the student picked the chapter). Free. */
export async function attachThreadChecks({ user, threadId, subject, chapter, catalog = [], deps }) {
  let row;
  try { row = await deps.loadThread({ id: threadId, userId: user.id }); } catch { return { http: 503, body: { ok: false, error: 'thread_unavailable', message: THREAD_COPY.checksUnavailable } }; }
  const thread = row?.thread;
  if (!thread || thread.state !== 'open') return { http: 404, body: { ok: false, error: 'thread_not_found', message: THREAD_COPY.notFound } };
  if ((thread.checks || []).length) return readThread({ user, threadId, deps });
  const anchor = resolveAnchor({ subject, chapter, catalog });
  if (!anchor) return { http: 422, body: { ok: false, error: 'invalid_chapter', message: THREAD_COPY.noChapter } };
  const offered = await offerChecks({ threadId, userId: user.id, anchor, deps });
  if (offered.stored.length) {
    let won = false;
    try { won = await deps.attachChecks({ id: threadId, userId: user.id, checks: offered.stored, subject: anchor.subject, chapter: anchor.chapter }); } catch { won = false; }
    if (!won) return readThread({ user, threadId, deps });
  }
  return { http: 200, body: { ok: true, thread: threadView(threadId, { ...thread, subject: anchor.subject, chapter: anchor.chapter }), checks: offered.checks, checksNote: offered.note } };
}

/**
 * POST op 'answer': marks one of the thread's questions against today's key. The first answer counts: a second answer to
 * the same question gets the stored result back. Progress is recorded best effort.
 */
export async function answerThreadCheck({ user, threadId, checkQuestionId, pick, requestId, deps }) {
  if (typeof checkQuestionId !== 'string' || !CHECK_REQUEST_ID.test(String(requestId || ''))) return { http: 422, body: { ok: false, error: 'invalid_request', message: 'That answer was incomplete.' } };
  if (!Number.isInteger(pick) || pick < 0 || pick > 3) return { http: 422, body: { ok: false, error: 'invalid_pick', message: THREAD_COPY.notOffered } };
  let row;
  try { row = await deps.loadThread({ id: threadId, userId: user.id }); } catch { return { http: 503, body: { ok: false, error: 'thread_unavailable', message: THREAD_COPY.checksUnavailable } }; }
  const thread = row?.thread;
  if (!thread || thread.state !== 'open') return { http: 404, body: { ok: false, error: 'thread_not_found', message: THREAD_COPY.notFound } };
  const slot = (thread.checks || []).findIndex((c) => c.checkQuestionId === checkQuestionId);
  if (slot < 0) return { http: 422, body: { ok: false, error: 'invalid_pick', message: THREAD_COPY.notOffered } };
  const offer = thread.checks[slot];
  if (offer.result) return { http: 200, body: { ok: true, replayed: true, result: offer.result } };
  let rows;
  try { rows = await deps.verifyPublished([checkQuestionId]); } catch { return { http: 503, body: { ok: false, error: 'thread_unavailable', message: THREAD_COPY.checksUnavailable } }; }
  const full = rows.get(checkQuestionId);
  const order = full ? orderFromHashes(full, offer.optionHashes) : null;
  if (!full || !order) return { http: 409, body: { ok: false, error: 'check_changed', message: 'This question was changed or withdrawn after it was offered, so it is not marked.' } };
  const marked = markCheck({ row: full, order, pick });
  if (!marked.ok) return { http: marked.reason === 'invalid_pick' ? 422 : 409, body: { ok: false, error: marked.reason, message: THREAD_COPY.notOffered } };
  const result = {
    right: marked.right, pick, key: { index: marked.keyDisplay, text: marked.keyText }, picked: { index: pick, text: marked.pickedText },
    explanation: bankExplanation(full),
    line: marked.right ? 'Right. That is the idea from your doubt, used on a real CUET question.' : 'Not this time. The key and the book explanation are below.',
    answeredAt: new Date(deps.now()).toISOString(),
  };
  let claim;
  try { claim = await deps.claimCheckResult({ id: threadId, userId: user.id, slot, result }); } catch { claim = null; }
  if (!claim) return { http: 503, body: { ok: false, error: 'thread_unavailable', message: THREAD_COPY.checksUnavailable } };
  if (claim.existing) return { http: 200, body: { ok: true, replayed: true, result: claim.existing } };
  try { await deps.recordProgress({ userId: user.id, row: full, pickedStored: marked.pickedStored, right: marked.right }); } catch { /* the answer is stored; progress is best effort */ }
  return { http: 200, body: { ok: true, replayed: false, result } };
}
