// Development-only fixtures for the repair's "Check it held" (/preview/arena?view=result&mock=full&repair=1).
// ?check= picks the state the check shows after the repair:
//   ready (default)  a fresh question; a right pick is right, any other is missed
//   none | passage | unchecked  the reason in plain words, no question
//   lookup           a failed read of what has been seen, then a question on retry
//   answered | answered-missed  the stored answer, as on a reopen of a saved repair
//   loaderr          the first read of the question fails, then it loads on retry
//   markerr          the first answer is lost on the way, then it is marked once on retry
//   changed          the question is withdrawn at answer time, then a new one is offered
//   slow             the question takes 2.6 s to arrive
//   norevise         Revise is not installed yet, so no Revise line
//   absent           no `check` field at all (an older server): nothing renders
// The questions are original and illustrative, never bank rows. The shapes follow
// data/tests/fixtures/repair4/contract_check_v1.json.
// ARC-18 (R8): both checks sit on the repaired idea: the result's Q42 (calls in arrears, Share Capital) gets the arrears set, every
// other question (Review's Admission of a Partner questions) the sacrifice set. Slot 2 (the fix job's second check, GET &slot=2 /
// POST slot: 2) has its own memory and its own question; once both are marked the answer says whether the fix held, as the server
// does (data/mobi_fix.js heldOf).
const CHECK_HREF = '/api/recovery/check?attemptId=fixture-attempt&questionId=fixture-q2';
const CHECK_ASK = '/mentor?tab=ask&q=fixture-attempt:fixture-q2';
const CHECK_RULE = 'Illustrative: sacrifice = old share − new share, for each partner.';
const ARREARS_RULE = 'Illustrative: calls in arrears are deducted from the called-up capital, never added.';
const REVISE_ON = { scheduled: true, nextAt: '2026-10-16T18:30:00.000Z', dueDay: '2026-10-17', whenLabel: 'tomorrow' };
const REVISE_OFF = { scheduled: false, reason: 'unavailable', nextAt: null };

const ARREARS = [
  {
    checkQuestionId: 'fixture-check-a1', topic: 'Calls in arrears',
    question: 'Illustrative: X Ltd called ₹8 a share on 5,000 shares, and ₹4,000 of the call was not received. What is the paid-up capital?',
    options: ['₹40,000', '₹44,000', '₹36,000', '₹4,000'], key: 2,
    explanation: 'Illustrative: the called-up capital is 5,000 × ₹8, which is ₹40,000. The ₹4,000 not received is deducted, so the paid-up capital is ₹36,000.',
  },
  {
    checkQuestionId: 'fixture-check-a2', topic: 'Calls in arrears',
    question: 'Illustrative: calls in arrears of ₹2,500 appear in the notes to accounts. What is done with them?',
    options: ['Deducted from the called-up capital', 'Added to the reserves', 'Shown under current assets', 'Added to the called-up capital'], key: 0,
    explanation: 'Illustrative: the call was made but not paid, so it is deducted from the called-up capital to give the paid-up capital.',
  },
];

const QUESTIONS = [
  {
    checkQuestionId: 'fixture-check-1', topic: 'Sacrificing ratio',
    question: 'Illustrative: P and Q share profits 3:2. They admit R for a 1/5 share, which R takes in the old ratio from P and Q. The firm’s goodwill is ₹50,000 and R brings in his share of it. How much of that goodwill is credited to P?',
    options: ['₹4,000', '₹10,000', '₹6,000', '₹5,000'], key: 2,
    explanation: 'Illustrative: R’s share of goodwill is 1/5 of ₹50,000, which is ₹10,000. P and Q gave up their shares in the old ratio 3:2, so P is credited 3/5 of ₹10,000, which is ₹6,000.',
  },
  {
    checkQuestionId: 'fixture-check-2', topic: 'Sacrificing ratio',
    question: 'Illustrative: A and B share profits 2:1. C is admitted for a 1/4 share, taking 1/12 from A and 1/6 from B. What is the sacrificing ratio of A and B?',
    options: ['1:2', '2:1', '1:1', '3:1'], key: 0,
    explanation: 'Illustrative: sacrifice is the share each partner gives up. A gives up 1/12 and B gives up 1/6, so the ratio is 1/12 to 1/6, which is 1:2.',
  },
];

/** Which check set a repaired question gets: the result's Q42 (exactly `q42`) is calls in arrears; everything else is sacrifice. */
export const checkSetFor = (questionId) => (String(questionId || '') === 'q42' ? 'arrears' : 'sacrifice');
const SETS = { arrears: { list: ARREARS, chapter: 'Share Capital', rule: ARREARS_RULE }, sacrifice: { list: null, chapter: 'Admission of a Partner', rule: CHECK_RULE } };
const setOf = (set) => { const S = SETS[set] || SETS.sacrifice; return { ...S, list: S.list || QUESTIONS }; };

const shown = (index, set = 'sacrifice') => {
  const S = setOf(set);
  const q = S.list[index % S.list.length];
  return {
    checkQuestionId: q.checkQuestionId, subject: 'accountancy', chapter: S.chapter, topic: q.topic, format: 'mcq', question: q.question,
    options: q.options.map((text, i) => ({ index: i, text })), basis: 'topic', basisLine: `Same topic: ${q.topic}`,
    pool: { unseen: 7 - index, ofChapter: 41 }, rule: S.rule,
  };
};

const stored = (index, pick, kind, set = 'sacrifice') => {
  const S = setOf(set);
  const CHECK_RULE = S.rule;
  const q = S.list[index % S.list.length];
  const right = pick === q.key;
  const revise = kind === 'norevise' ? REVISE_OFF : { ...REVISE_ON, cards: right ? 1 : 2 };
  return {
    right, checkQuestionId: q.checkQuestionId, pick, key: { index: q.key, text: q.options[q.key] }, picked: { index: pick, text: q.options[pick] },
    explanation: q.explanation, ruleLine: CHECK_RULE,
    line: right ? 'Right on a new question from the same topic. One question is a check, not a measure.'
      : revise.scheduled ? 'Missed on a new question from the same topic.' : 'Missed on a new question from the same topic. Read the key and the explanation below.',
    basis: 'topic', basisLine: `Same topic: ${q.topic}`,
    options: q.options.map((text, i) => ({ index: i, text, isKey: i === q.key, isPick: i === pick })),
    answeredAt: new Date().toISOString(), revise,
  };
};

/** The `check` field of the repair response for ?check=. Null leaves the field out. */
export function fixtureCheckField(kind = 'ready', questionId = null) {
  // ARC-18: the links name the repaired question (as the server's do), so the check reads that question's own set.
  const q = questionId && /^[A-Za-z0-9_-]+$/.test(String(questionId)) ? String(questionId) : null;
  const links = q ? { href: `/api/recovery/check?attemptId=fixture-attempt&questionId=${q}`, askHref: `/mentor?tab=ask&q=fixture-attempt:${q}` } : { href: CHECK_HREF, askHref: CHECK_ASK };
  if (kind === 'absent') return null;
  if (kind === 'none') return { available: false, status: 'none', reason: 'no_unseen', message: 'No unseen question on this idea yet.', ...links };
  if (kind === 'passage') return { available: false, status: 'none', reason: 'passage_format', message: 'This one needs its reading passage, so there is no short check for it.', ...links };
  if (kind === 'unchecked') return { available: false, status: 'unchecked', reason: 'check_unavailable', message: 'The check is not available right now. Nothing was charged.', ...links };
  if (kind === 'lookup') return { available: false, status: 'none', reason: 'lookup_failed', message: 'We could not confirm which questions you have already seen, so we are not offering one. Nothing was charged.', ...links };
  if (kind === 'answered' || kind === 'answered-missed') return { available: false, status: 'answered', reason: null, message: null, ...links };
  return { available: true, status: 'ready', reason: null, message: null, ...links };
}

export const freshCheckMemory = () => ({ answer: null, reads: 0, writes: 0, tries: 0 });

/** GET /api/recovery/check. `memory` is this tab's own memory (the first answer counts, so a reload shows the stored one). */
export function fixtureCheckGet(kind = 'ready', memory = freshCheckMemory(), { slot = 1, set = 'sacrifice' } = {}) {
  if (slot === 2) {
    const common2 = { charged: 0, href: `${CHECK_HREF}&slot=2`, askHref: CHECK_ASK };
    if (memory.answer) return { http: 200, delay: 0, body: { ok: true, status: 'answered', ...common2, check: shown(memory.answer.index, set), result: stored(memory.answer.index, memory.answer.pick, kind, set) } };
    return { http: 200, delay: 0, body: { ok: true, status: 'ready', ...common2, check: shown(1, set) } };
  }
  const common = { charged: 0, href: CHECK_HREF, askHref: CHECK_ASK };
  const answer = memory.answer || (kind === 'answered' ? { index: 0, pick: 2 } : kind === 'answered-missed' ? { index: 0, pick: 1 } : null);
  if (answer) return { http: 200, delay: 0, body: { ok: true, status: 'answered', ...common, check: shown(answer.index, set), result: stored(answer.index, answer.pick, kind, set) } };
  // Reads in the first 2.5 s fail (the development build reads twice on mount); a retry after that loads.
  if (kind === 'loaderr' && (memory.firstRead ??= Date.now()) + 2500 > Date.now()) return { http: 503, delay: 0, body: { ok: false, error: 'question_unavailable', message: 'This question could not be loaded.', charged: 0 } };
  if (kind === 'none') return { http: 200, delay: 0, body: { ok: true, status: 'none', ...common, reason: 'no_unseen', message: 'No unseen question on this idea yet.', pool: { unseen: 0, ofChapter: 41 } } };
  const index = kind === 'changed' && memory.writes > 0 ? 1 : 0;
  return { http: 200, delay: kind === 'slow' ? 2600 : 0, body: { ok: true, status: 'ready', ...common, check: shown(index, set) } };
}

/** POST /api/recovery/check. Returns { lost } (a dropped connection), or { http, body, delay } and what to remember. */
const heldWords = (first, second) => (first === false || second === false
  ? { held: false, heldLine: 'One check was wrong, so this fix is not held yet. Revise brings the idea back to try again.' }
  : first && second ? { held: true, heldLine: 'Both checks right. This fix is held. Revise brings it back in a few days to make sure.' } : {});

/** POST for the second check (slot 2): its own memory; `firstRight` is check 1's mark, so the answer can say whether the fix held. */
export function fixtureCheckPost2(kind = 'ready', body = {}, memory = freshCheckMemory(), firstRight = null, set = checkSetFor(body.questionId)) {
  if (!Number.isInteger(body.pick) || body.pick < 0 || body.pick > 3) return { http: 422, delay: 0, body: { ok: false, error: 'invalid_pick', message: 'Pick one of the four options.' } };
  if (memory.answer) { const r = stored(memory.answer.index, memory.answer.pick, kind, set); return { http: 200, delay: 0, body: { ok: true, status: 'answered', replayed: true, charged: 0, result: r, ...heldWords(firstRight, r.right) } }; }
  const r = stored(1, body.pick, kind, set);
  return { http: 200, delay: 700, body: { ok: true, status: 'answered', replayed: false, charged: 0, result: r, ...heldWords(firstRight, r.right) }, remember: { answer: { index: 1, pick: body.pick } } };
}

/** Check 1's mark from this tab's memory (true, false, or null before it is answered). */
export const firstCheckRight = (memory, set = 'sacrifice') => { const L = setOf(set).list; return memory?.answer ? memory.answer.pick === L[memory.answer.index % L.length].key : null; };

export function fixtureCheckPost(kind = 'ready', body = {}, memory = freshCheckMemory(), set = checkSetFor(body.questionId)) {
  const index = kind === 'changed' && memory.writes > 0 ? 1 : 0;
  if (kind === 'markerr' && memory.tries === 0) return { lost: true, remember: { tries: 1 } };
  if (kind === 'changed' && memory.writes === 0) return { http: 409, delay: 0, body: { ok: false, error: 'check_changed', message: 'That question was withdrawn before it was marked. Nothing was recorded.' }, remember: { writes: 1 } };
  if (!Number.isInteger(body.pick) || body.pick < 0 || body.pick > 3) return { http: 422, delay: 0, body: { ok: false, error: 'invalid_pick', message: 'Pick one of the four options.' } };
  if (memory.answer) return { http: 200, delay: 0, body: { ok: true, status: 'answered', replayed: true, charged: 0, result: stored(memory.answer.index, memory.answer.pick, kind, set) } };
  return { http: 200, delay: 700, body: { ok: true, status: 'answered', replayed: false, charged: 0, result: stored(index, body.pick, kind, set) }, remember: { answer: { index, pick: body.pick } } };
}

/** GET /api/recovery/ask-context: the short preview the Ask screen shows for the question handed over. */
// ARC-18: the same question the row shows (Q42's stem and chapter), so the sheet and the row never disagree.
export function fixtureAskContext({ question, chapter, questionId = null } = {}) {
  return { ok: true, context: { question: question || 'Illustrative question 42', subject: 'Accountancy', chapter: chapter || 'Share Capital', rule: setOf(checkSetFor(questionId)).rule, pick: { letter: 'A' }, hasKey: true, cost: { credits: 1, pool: 'ai' } } };
}
