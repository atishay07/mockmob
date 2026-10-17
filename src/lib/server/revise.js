// Revise on the server (data/revise.js holds the rules; feature wave F1; spec tmp/mistake-lab-v4/SPEC.md 4.8).
// No 'server-only' on purpose, so node:test can load it with a fake client; the Supabase client is imported lazily.
//   getRevise      GET /api/me/revise: seeds the student's cards from their newest wrong answers (idempotent), then
//                  returns today's questions with stem and options and NO key
//   answerRevise   POST /api/me/revise/answer: grades on the server, moves the card, returns the key and the stored
//                  explanation only after the answer
//   cardsFor       the student's cards for some questions (the Lab's "Same mistakes later" line); never seeds
// Revise writes only revise_cards. It writes no attempts row and nothing to user_question_progress, so no accuracy number,
// chapter number, SWOT line or Compass sample can move, and it spends no credits. A missing table is state 'unavailable'.
import { optionHash } from '../../../data/option_hash.js';
import { correctIndexOf } from '../../../data/mistake_repair.js';
import { REVISE_RULES, REVISE_VERSION, addDays, boxCounts, capFrom, dayLabel, gradeCard, istDate, planSeeds, resultLine, reviseBody, todaysQueue } from '../../../data/revise.js';
import COPY from '../../../data/mistake_lab.copy.json' with { type: 'json' };
import { mergeQueue, headLine, mixLine } from '../../components/revise/reviseQueue.js';
import { stampWhen } from '../../../data/review_input.mjs';

const BATCH = 100;
const CARD_COLUMNS = 'question_id,box,due_day,state,right_total,last_recalled_day,key_hash,wrong_at,created_at,updated_at';
const QUESTION_COLUMNS = 'id,subject,chapter,question,body,options,correct_index,correct_answer,status,is_deleted,verification_state,explanation,passage_text';

// The `mode` column ('question' | 'again', migration 20261017160000) is read when it exists; code works before it is applied.
const modeColumnMissing = (error) => /\bmode\b/i.test(error?.message || '') && /42703|column|schema cache/i.test(`${error?.code || ''} ${error?.message || ''}`);
const missing = (error) => /revise_cards|schema cache|does not exist|PGRST20[25]|42P01/i.test(`${error?.code || ''} ${error?.message || ''}`);
const fail = (code, cause) => Object.assign(new Error(code), { code, cause });
const client = async (db) => db || (await import('../supabase')).supabaseAdmin();

const optionText = (o) => (typeof o === 'string' ? o : o?.text ?? o?.label ?? o?.value ?? '');
const keyOf = (row) => { const i = correctIndexOf(row); return Number.isInteger(i) && i >= 0 && i < (row?.options?.length || 0) ? i : -1; };
const keyHashOf = (row) => { const i = keyOf(row); return i < 0 ? null : optionHash(row.options[i]); };

/** A question that may be asked again: live, not deleted, not under re-check, with a readable key and at least 2 options. */
export function eligibleQuestion(row) {
  return !!row && !row.is_deleted && row.status === 'live' && row.verification_state !== 'disputed'
    && Array.isArray(row.options) && row.options.length >= 2 && keyOf(row) >= 0;
}

/** One question as the student sees it in Revise: the stem and the options in stored order. Never the key. */
export function reviseItem(row, card) {
  const passage = typeof row.passage_text === 'string' && row.passage_text.trim() ? { text: row.passage_text.trim() } : null;
  return {
    questionId: row.id,
    subject: row.subject ?? null,
    chapter: row.chapter ?? null,
    question: String(row.question ?? row.body ?? ''),
    passage,
    options: row.options.map((o) => optionText(o)),
    box: card.box,
  };
}

async function loadCards(db, userId) {
  let res = await db.from('revise_cards').select(`${CARD_COLUMNS},mode`).eq('user_id', userId).limit(2000);
  if (res.error && modeColumnMissing(res.error)) res = await db.from('revise_cards').select(CARD_COLUMNS).eq('user_id', userId).limit(2000);
  if (res.error) throw Object.assign(fail(missing(res.error) ? 'REVISE_MISSING' : 'REVISE_UNAVAILABLE', res.error), { missing: missing(res.error) });
  return res.data || [];
}

async function loadQuestions(db, ids) {
  const list = [...new Set(ids)];
  const out = new Map();
  for (let i = 0; i < list.length; i += BATCH) {
    const res = await db.from('questions').select(QUESTION_COLUMNS).in('id', list.slice(i, i + BATCH));
    if (res.error) throw fail('REVISE_QUESTIONS_UNAVAILABLE', res.error);
    for (const row of res.data || []) out.set(row.id, row);
  }
  return out;
}

/** Seed and reset cards from the student's newest wrong answers. Returns the cards after the write. */
async function seed(db, userId, cards, now) {
  const progress = await db.from('user_question_progress').select('question_id,last_correct,last_selected_key,last_attempted_at')
    .eq('user_id', userId).eq('last_correct', false).not('last_selected_key', 'is', null)
    .order('last_attempted_at', { ascending: false }).limit(REVISE_RULES.seedMax);
  if (progress.error) return cards; // no progress table or a failed read: Revise keeps what it has
  const rows = progress.data || [];
  // First pass without the question rows: which wrong answers have no card yet, or were answered wrong again.
  const candidates = planSeeds({ progress: rows, cards });
  if (!candidates.length) return cards;
  const questions = await loadQuestions(db, candidates.map((c) => c.question_id));
  const plan = planSeeds({
    progress: rows, cards,
    usable: (qid) => eligibleQuestion(questions.get(qid)),
    keyHashOf: (qid) => keyHashOf(questions.get(qid)),
  });
  if (!plan.length) return cards;
  const stamp = new Date(now).toISOString();
  const write = await db.from('revise_cards').upsert(plan.map((p) => ({ ...p, user_id: userId, updated_at: stamp })), { onConflict: 'user_id,question_id' });
  if (write.error) throw fail('REVISE_UNAVAILABLE', write.error);
  return loadCards(db, userId);
}

/**
 * GET /api/me/revise. Returns { http, body }. The body is the v1 body (today's questions, no key) and, when `queue` is given,
 * a `queue` field: Revise as ONE queue over four sources (LEARN-REVIEW-1017 5.8, src/components/revise/reviseQueue.js).
 *   queue.loadRecord(userId, { cards, now, cap })   the Review record (data/review_input.mjs input) or throws: it names the
 *                                                    repaired mistakes (played as 'again'), the pending Check it held and the
 *                                                    paper each wrong answer came from. Failing, those parts are left out.
 *   queue.readDueCards()                             the lesson cards due today as a number, or { due, available } where `available`
 *                                                    is what a recall run would play (due plus new cards of lessons already read);
 *                                                    null when unknown (never zero for unknown)
 */
export async function getRevise(userId, { cap = REVISE_RULES.cap, db, now = Date.now(), queue = null } = {}) {
  const client_ = await client(db);
  const today = istDate(now);
  let cards;
  try { cards = await loadCards(client_, userId); } catch (e) { return unavailable(e); }
  try { cards = await seed(client_, userId, cards, now); } catch { /* seeding failed: the cards already stored still work */ }
  const due = todaysQueue({ cards, today, cap });
  // Ask the first `room` due questions that may be asked: a due card whose question is under re-check or withdrawn is
  // skipped and the next due card takes its place.
  const items = [];
  let skipped = 0;
  try {
    for (let at = 0; at < due.due.length && items.length < due.room; at += BATCH) {
      const chunk = due.due.slice(at, at + BATCH);
      const questions = await loadQuestions(client_, chunk.map((c) => c.question_id));
      for (const c of chunk) {
        if (items.length >= due.room) break;
        const row = questions.get(c.question_id);
        if (eligibleQuestion(row)) items.push(reviseItem(row, c)); else skipped += 1;
      }
    }
  } catch (e) { return unavailable(e); }
  const body = reviseBody({ cards, items, today, cap, skipped });
  if (!queue) return { http: 200, body };
  return { http: 200, body: { ...body, queue: await composeQueue(userId, { client_, cards, items, due, today, cap, now, queue }) } };
}

const isRepaired = (item) => ['repaired', 'held', 'slipped'].includes(item?.state);

/** Revise as one queue: the due questions, the repaired mistakes, the pending checks and the lesson cards, deduped and capped. */
async function composeQueue(userId, { client_, cards, items, due, today, cap, now, queue }) {
  let record = null;
  if (typeof queue.loadRecord === 'function') {
    try { record = await queue.loadRecord(userId, { db: client_, cards, now, cap }); } catch { record = null; }
  }
  let dueCards = null;
  let availableCards = null;
  if (typeof queue.readDueCards === 'function') {
    try {
      const got = await queue.readDueCards();
      const due = typeof got === 'object' && got ? got.due : got;
      dueCards = Number.isFinite(due) ? due : null;
      availableCards = typeof got === 'object' && got && Number.isFinite(got.available) ? got.available : dueCards;
    } catch { dueCards = null; }
  }
  const paperById = new Map((record?.papers || []).map((p) => [p.id, p]));
  const wrongOf = new Map(); // question id -> the newest paper it was answered wrong in
  const repaired = new Set();
  for (const it of record?.items || []) {
    if (!it.qid || it.state === 'blank') continue;
    if (!wrongOf.has(it.qid)) wrongOf.set(it.qid, it);
    if (isRepaired(it)) repaired.add(it.qid);
  }
  const cardOf = new Map(cards.map((c) => [c.question_id, c]));
  const questions = [];
  const again = [];
  const promote = [];
  for (const item of items) {
    const card = cardOf.get(item.questionId);
    const from = wrongOf.get(item.questionId);
    const paper = from ? paperById.get(from.paper) : null;
    const mode = card?.mode === 'again' || repaired.has(item.questionId) ? 'again' : 'question';
    const shaped = { ...item, dueDay: card?.due_day || today, source: paper ? `${paper.name}, ${stampWhen(paper.at)}` : null };
    (mode === 'again' ? again : questions).push(shaped);
    if (mode === 'again' && card && 'mode' in card && card.mode !== 'again') promote.push(item.questionId);
  }
  // A repaired mistake is a card of mode 'again' from now on (so Review and the app count the same split). Best effort.
  if (promote.length) {
    try { await client_.from('revise_cards').update({ mode: 'again' }).eq('user_id', userId).in('question_id', promote); } catch { /* the split is worked out again on the next read */ }
  }
  // The pending Check it held: repaired, not yet checked, from the day after the repair (data/review_input.mjs reviseDue).
  const checks = (record?.items || [])
    .filter((it) => it.state === 'repaired' && it.qid && it.repairedAt && istDate(Date.parse(it.repairedAt)) < today)
    .map((it) => ({ attemptId: it.paper, questionId: it.qid, number: it.q, paper: paperById.get(it.paper)?.name || null, chapter: (record.chapters || []).find((c) => c.id === it.ch)?.name || null }));
  const merged = mergeQueue({ questions, again, checks, cards: dueCards, cap, answered: due.answered });
  return {
    version: 2, today, cap, items: merged.items, counts: merged.counts, total: merged.total, minutes: merged.minutes, unknown: merged.unknown,
    dropped: merged.dropped, cardsAvailable: availableCards, head: headLine(merged.total, merged.minutes), mix: mixLine(merged.counts), boxes: boxCounts(cards), rotation: cards.filter((c) => c.state === 'active').length,
    nextDay: due.nextDay, nextDayLabel: due.nextDay ? dayLabel(due.nextDay) : null,
  };
}

function unavailable() {
  return { http: 503, body: { version: REVISE_VERSION, state: 'unavailable', message: COPY.revise.unavailable, items: [] } };
}

/**
 * POST /api/me/revise/answer { questionId, choice }. `choice` is the index into the options as GET /api/me/revise sent
 * them. Returns { http, body }. The card must be in today's queue; a second answer to the same card is 409 not_due.
 */
export async function answerRevise(userId, { questionId, choice } = {}, { db, now = Date.now(), cap = REVISE_RULES.cap } = {}) {
  if (typeof questionId !== 'string' || !questionId || !Number.isInteger(choice) || choice < 0) {
    return { http: 422, body: { ok: false, error: 'invalid_request', message: 'questionId and a choice are required.' } };
  }
  const client_ = await client(db);
  const today = istDate(now);
  let cards;
  try { cards = await loadCards(client_, userId); } catch (e) { return unavailable(e); }
  const queue = todaysQueue({ cards, today, cap });
  const card = cards.find((c) => c.question_id === questionId);
  // Any card that is due, while the day's cap has room. (GET asked the first cards that may be asked, skipping a question
  // under re-check, so the card answered is not always among the first `room` due ones.)
  if (!card || card.state !== 'active' || card.due_day > today || queue.room <= 0) {
    const capped = queue.room <= 0;
    return { http: 409, body: { ok: false, error: capped ? 'cap_reached' : 'not_due', message: capped ? COPY.revise.capReached : COPY.revise.notDue } };
  }
  let question;
  try { question = (await loadQuestions(client_, [questionId])).get(questionId); } catch (e) { return unavailable(e); }
  if (!eligibleQuestion(question) || choice >= question.options.length) {
    return { http: 409, body: { ok: false, error: 'question_unavailable', message: COPY.revise.notDue } };
  }
  const stamp = new Date(now).toISOString();
  // A key that changed since the card was seeded makes the old "wrong" meaningless: the card is retired, not graded.
  if (card.key_hash && keyHashOf(question) !== card.key_hash) {
    await client_.from('revise_cards').update({ state: 'retired', updated_at: stamp }).eq('user_id', userId).eq('question_id', questionId);
    return { http: 409, body: { ok: false, error: 'key_changed', message: COPY.revise.notDue } };
  }
  const keyIndex = keyOf(question);
  const correct = choice === keyIndex;
  const next = gradeCard(card, correct, today);
  const moved = await client_.from('revise_cards')
    .update({ box: next.box, due_day: next.due_day, state: next.state, right_total: next.right_total, last_recalled_day: today, updated_at: stamp })
    .eq('user_id', userId).eq('question_id', questionId).eq('box', card.box).eq('due_day', card.due_day).eq('state', 'active')
    .select('question_id');
  if (moved.error) return unavailable(moved.error);
  if (!moved.data?.length) return { http: 409, body: { ok: false, error: 'not_due', message: COPY.revise.notDue } };
  const explanation = typeof question.explanation === 'string' ? question.explanation.trim() : typeof question.explanation?.text === 'string' ? question.explanation.text.trim() : '';
  return {
    http: 200,
    body: {
      ok: true, version: REVISE_VERSION, correct, keyIndex, explanation: explanation ? explanation.slice(0, 1500) : null,
      outcome: next.outcome, box: next.box, retired: next.state === 'retired',
      dueDay: next.state === 'retired' ? null : next.due_day, dueLabel: next.state === 'retired' ? null : dayLabel(next.due_day),
      line: resultLine(next.outcome, next.due_day, today),
    },
  };
}

/**
 * What Revise holds for these questions, as a Map(question id -> { question_id, box, due_day, state }), or null when the
 * cards could not be read. Never writes. It answers the Lab's "Same mistakes later" with what the next read of Revise will
 * show, so a day it names is the day a card will really be due:
 *   - a stored card, as it is;
 *   - a card the student has since answered wrong again (progress newer than the card), or a wrong answer with no card yet:
 *     the card Revise will seed, box 1, due the day after that wrong answer (the same planSeeds the seeding runs);
 *   - state 'none' for a question the student does not have a wrong answer on now (answered right since, in a paper or in
 *     practice, or never wrong): nothing comes back, so it must not be promised.
 * When the progress read fails, only the stored cards are returned (a question with no card is left out of the Map).
 */
export async function cardsFor(userId, qids, { db } = {}) {
  const ids = [...new Set((qids || []).filter((q) => typeof q === 'string' && q))];
  if (!ids.length) return new Map();
  try {
    const client_ = await client(db);
    const stored = [];
    const progress = [];
    let progressOk = true;
    for (let i = 0; i < ids.length; i += BATCH) {
      const part = ids.slice(i, i + BATCH);
      const res = await client_.from('revise_cards').select('question_id,box,due_day,state,right_total,updated_at').eq('user_id', userId).in('question_id', part);
      if (res.error) return null;
      stored.push(...(res.data || []));
      if (progressOk) {
        const read = await client_.from('user_question_progress').select('question_id,last_correct,last_selected_key,last_attempted_at').eq('user_id', userId).in('question_id', part);
        if (read.error) progressOk = false; else progress.push(...(read.data || []));
      }
    }
    const out = new Map(stored.map((row) => [row.question_id, { question_id: row.question_id, box: row.box, due_day: row.due_day, state: row.state }]));
    if (!progressOk) return out;
    for (const row of planSeeds({ progress, cards: stored })) out.set(row.question_id, { question_id: row.question_id, box: row.box, due_day: row.due_day, state: row.state });
    const wrongNow = new Set(progress.filter((p) => p?.last_correct === false && p.last_selected_key).map((p) => p.question_id));
    for (const id of ids) if (!wrongNow.has(id) && !(out.get(id)?.state === 'active')) out.set(id, { question_id: id, box: null, due_day: null, state: 'none' });
    return out;
  } catch {
    return null;
  }
}

export { addDays, capFrom };
