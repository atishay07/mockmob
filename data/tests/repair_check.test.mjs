import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  rejectReason, selectCheckQuestion, chooseVerified, checkIsStillOffered, storedOrder, checkQuestionView, markCheck, bankExplanation,
  outcomeLine, planReviseCards, reviseSummary, istDate, addDays, dayLabel, dayStartIso, formatOf, basisOf, CHECK_REASONS, checkReasonMessage,
} from '../repair_check.js';

const fx = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/repair4/pool_goodwill.json', import.meta.url)), 'utf8'));
const pick = (over = {}) => selectCheckQuestion({ mistake: fx.mistake, candidates: fx.candidates, seen: new Set(fx.seen), userId: 'u1', mistakeKey: 'm1', ...over });
const row = (id) => fx.candidates.find((c) => c.id === id);

test('the fixture: the concept match is picked first, then topic, then chapter; every excluded row is excluded for its own reason', () => {
  const sel = pick();
  assert.equal(sel.ok, true);
  assert.equal(sel.row.id, fx.expect.first);
  assert.deepEqual(sel.ranked.map((r) => r.id), fx.expect.rankedOrder);
  assert.equal(sel.basis, 'concept');
  assert.equal(sel.basisLine, 'Same concept: Valuation of goodwill');
  assert.deepEqual(sel.ranked.map((r) => r.basis), ['concept', 'topic', 'chapter']);
  for (const [id, why] of Object.entries(fx.expect.excluded)) {
    assert.equal(rejectReason(row(id), { mistake: fx.mistake, seen: new Set(fx.seen) }), why, `${id} should be ${why}`);
  }
  // Every count carries its denominator: 3 could be offered of the 9 candidates read from the chapter.
  assert.deepEqual(sel.pool, { ofChapter: 9, unseen: 3 });
});

test('never seen: any id in the seen set is excluded, whatever its rank, and the mistake itself is never its own check', () => {
  const allIds = fx.candidates.map((c) => c.id);
  const sel = pick({ seen: new Set([...fx.seen, 'q_concept', 'q_topic']) });
  assert.equal(sel.row.id, 'q_chapter');
  assert.equal(rejectReason({ ...fx.mistake }, { mistake: fx.mistake }), 'same_question');
  const none = pick({ seen: new Set(allIds) });
  assert.equal(none.ok, false);
  assert.equal(none.reason, 'no_unseen');
  assert.deepEqual(none.pool, { ofChapter: 9, unseen: 0 });
});

test('held and corrected questions are excluded again here, whatever the upstream gate let through', () => {
  for (const status of ['pending', 'quarantined', 'rejected', 'invalid']) {
    assert.equal(rejectReason({ ...row('q_concept'), status }, { mistake: fx.mistake }), 'held', status);
  }
  assert.equal(rejectReason({ ...row('q_concept'), verification_state: 'disputed' }, { mistake: fx.mistake }), 'held');
  assert.equal(rejectReason({ ...row('q_concept'), exploration_state: 'pending_review' }, { mistake: fx.mistake }), 'held');
  assert.equal(rejectReason({ ...row('q_concept'), is_deleted: true }, { mistake: fx.mistake }), 'deleted');
  assert.equal(rejectReason(row('q_concept'), { mistake: fx.mistake, excluded: new Set(['q_concept']) }), 'held', 'an open content dispute');
  // An agent key dispute (data/nta_key_disputes.json) keeps a question out of the check too.
  const disputes = JSON.parse(readFileSync(fileURLToPath(new URL('../nta_key_disputes.json', import.meta.url)), 'utf8'));
  const disputed = Object.keys(disputes.questions || {})[0];
  if (disputed) assert.equal(rejectReason({ ...row('q_concept'), id: disputed }, { mistake: fx.mistake }), 'held');
  const sel = pick({ excluded: new Set(['q_concept', 'q_topic']) });
  assert.equal(sel.row.id, 'q_chapter');
  assert.equal(rejectReason({ ...row('q_concept'), is_cuet_syllabus: false }, { mistake: fx.mistake }), 'off_syllabus');
});

test('the pick is deterministic, and spreads over the pool by student and mistake', () => {
  const pool = Array.from({ length: 40 }, (_, i) => ({ ...row('q_chapter'), id: `c${i}`, family_id: `f${i}`, question: `Which statement number ${i} about admission of a partner and the new profit ratio is correct for a firm?`, topic: 'Other', concept_id: `k${i}` }));
  const a = selectCheckQuestion({ mistake: fx.mistake, candidates: pool, userId: 'u1', mistakeKey: 'm1' });
  const b = selectCheckQuestion({ mistake: fx.mistake, candidates: [...pool].reverse(), userId: 'u1', mistakeKey: 'm1' });
  assert.equal(a.row.id, b.row.id, 'the order the rows were read in does not matter');
  const seenPicks = new Set();
  for (let i = 0; i < 30; i += 1) seenPicks.add(selectCheckQuestion({ mistake: fx.mistake, candidates: pool, userId: `user${i}`, mistakeKey: 'm1' }).row.id);
  assert.ok(seenPicks.size >= 8, `30 students should not all get one question (got ${seenPicks.size} different)`);
});

test('the same format is preferred within a basis, and the basis wins over the format', () => {
  const mk = (id, over) => ({ ...row('q_chapter'), id, family_id: `f_${id}`, question: `Distinct stem for ${id}: which entry records the change in the ratio of a firm after admission of a partner?`, ...over });
  const sameFormatChapter = mk('x1', { topic: 'Other', concept_id: 'other', question_type: 'numerical' });
  const otherFormatTopic = mk('x2', { topic: 'Goodwill', concept_id: 'other2', question_type: 'conceptual' });
  const sel = selectCheckQuestion({ mistake: fx.mistake, candidates: [sameFormatChapter, otherFormatTopic], userId: 'u', mistakeKey: 'm' });
  assert.equal(sel.row.id, 'x2', 'same topic beats same format');
  const a = mk('x3', { topic: 'Goodwill', concept_id: 'o3', question_type: 'conceptual' });
  const b = mk('x4', { topic: 'Goodwill', concept_id: 'o4', question_type: 'numerical' });
  for (const key of ['m1', 'm2', 'm3', 'm4', 'm5']) assert.equal(selectCheckQuestion({ mistake: fx.mistake, candidates: [a, b], userId: 'u', mistakeKey: key }).row.id, 'x4', 'same format first inside the same basis');
  assert.equal(basisOf(b, fx.mistake), 'topic');
  assert.equal(formatOf({ question: 'Assertion (A): x. Reason (R): y.' }), 'assertion_reason');
  assert.equal(formatOf({ question: 'Match List-I with List-II' }), 'match');
  assert.equal(formatOf({ question: 'plain' }), 'mcq');
});

test('a passage-linked mistake gets no check, with its own reason', () => {
  const passageMistake = { ...fx.mistake, passage_text: 'A long passage about a firm.', question_type: 'case_study' };
  const sel = selectCheckQuestion({ mistake: passageMistake, candidates: fx.candidates, userId: 'u', mistakeKey: 'm' });
  assert.equal(sel.ok, false);
  assert.equal(sel.reason, 'passage_format');
  assert.match(checkReasonMessage('passage_format'), /passage/);
});

test('walking the ranked list: the first candidate the publication gate accepts is chosen, and an unverified one is never chosen', () => {
  const sel = pick();
  assert.equal(chooseVerified(sel, new Set(['q_topic', 'q_chapter'])).id, 'q_topic');
  assert.equal(chooseVerified(sel, new Set(['q_chapter'])).id, 'q_chapter');
  assert.equal(chooseVerified(sel, new Set()), null);
  assert.equal(chooseVerified(sel, new Set(['q_seen', 'q_held'])), null, 'an excluded id is not in the ranked list at all');
  assert.equal(checkIsStillOffered(sel, 'q_chapter'), true);
  assert.equal(checkIsStillOffered(sel, 'q_seen'), false);
  assert.equal(checkIsStillOffered(sel, 'invented'), false);
});

test('the display order is the bank own order, so the explanation option letters still name the option on screen', () => {
  assert.deepEqual(storedOrder(), [0, 1, 2, 3]);
  const r = row('q_concept');
  const view = checkQuestionView(r, storedOrder());
  assert.deepEqual(view.options.map((o) => o.text), r.options.map((o) => o.text));
  // The key is read in that same order: the stored key letter is the displayed letter.
  const marked = markCheck({ row: r, order: storedOrder(), pick: 0 });
  assert.equal(marked.keyDisplay, marked.keyStored);
});

test('before the answer the question view carries no key, no explanation and no marks', () => {
  const order = storedOrder();
  const view = checkQuestionView(row('q_concept'), order);
  assert.equal(view.options.length, 4);
  assert.deepEqual(view.options.map((o) => o.index), [0, 1, 2, 3]);
  assert.deepEqual(Object.keys(view).sort(), ['chapter', 'format', 'id', 'options', 'question', 'subject', 'topic']);
  for (const o of view.options) assert.deepEqual(Object.keys(o), ['index', 'text']);
  const texts = view.options.map((o) => o.text).sort();
  assert.deepEqual(texts, row('q_concept').options.map((o) => o.text).sort());
  assert.equal(JSON.stringify(view).includes('correct'), false);
  assert.equal(JSON.stringify(view).includes('explanation'), false);
});

test('marking: the pick is a display index, the key is read from the row as it stands today', () => {
  const r = row('q_concept');
  const order = [2, 0, 3, 1]; // markCheck maps any display order back to the stored options
  const keyDisplay = order.indexOf(0);
  const right = markCheck({ row: r, order, pick: keyDisplay });
  assert.equal(right.ok, true);
  assert.equal(right.right, true);
  assert.equal(right.keyText, 'Super profit and the normal rate of return');
  assert.equal(right.keyDisplay, keyDisplay);
  const wrongDisplay = (keyDisplay + 1) % 4;
  const wrong = markCheck({ row: r, order, pick: wrongDisplay });
  assert.equal(wrong.right, false);
  assert.equal(wrong.pickedStored, order[wrongDisplay]);
  assert.equal(wrong.keyDisplay, keyDisplay);
  // Today's key: the bank corrected the key to option B after the offer, so the old key is now wrong and B is right.
  const corrected = { ...r, correct_answer: 'B' };
  const afterCorrection = markCheck({ row: corrected, order, pick: keyDisplay });
  assert.equal(afterCorrection.right, false, 'the old key text no longer scores');
  assert.equal(markCheck({ row: corrected, order, pick: order.indexOf(1) }).right, true);
  assert.equal(markCheck({ row: corrected, order, pick: order.indexOf(1) }).keyText, 'Drawings and the closing capital');
  // Invalid picks and a row that no longer passes integrity.
  for (const bad of [-1, 4, 1.5, '2', null, undefined, NaN]) assert.equal(markCheck({ row: r, order, pick: bad }).reason, 'invalid_pick');
  assert.equal(markCheck({ row: { ...r, options: r.options.slice(0, 3) }, order, pick: 0 }).reason, 'check_changed');
  assert.equal(markCheck({ row: { ...r, correct_answer: 'Z', correct_index: undefined }, order, pick: 0 }).reason, 'check_changed');
});

test('the outcome line says what happened on one question: no forecast, no mastery, no marks gained', () => {
  const lines = [
    outcomeLine({ right: true, basis: 'concept' }),
    outcomeLine({ right: true, basis: 'topic' }),
    outcomeLine({ right: true, basis: 'chapter' }),
    outcomeLine({ right: false, basis: 'topic', revise: { scheduled: true, whenLabel: 'tomorrow' } }),
    outcomeLine({ right: false, basis: 'chapter', revise: { scheduled: false } }),
  ];
  assert.match(lines[0], /same concept/);
  assert.match(lines[1], /same topic/);
  assert.match(lines[2], /same chapter/);
  assert.equal(lines[3], 'Missed on a new question from the same topic.', 'when it comes back is said once, in the Revise line');
  assert.doesNotMatch(lines[3], /Revise/);
  assert.doesNotMatch(lines[4], /Revise/, 'no Revise promise when nothing was scheduled');
  for (const line of lines) assert.doesNotMatch(line, /master|learn(ed|t)|will (score|gain)|marks? (you|gained)|improv|predict|%/i, line);
});

test('Revise plan: the mistake always goes back tomorrow (IST), the check question too when it was missed; cards fit the revise_cards migration', () => {
  const now = Date.parse('2026-10-16T20:00:00Z'); // 17 Oct, 01:30 IST
  assert.equal(istDate(now), '2026-10-17');
  const right = planReviseCards({ mistake: fx.mistake, checkRow: row('q_concept'), right: true, nowMs: now, mistakeWrongAt: '2026-10-14T10:00:00.000Z' });
  assert.equal(right.dueDay, '2026-10-18');
  assert.deepEqual(right.rows.map((r) => r.question_id), ['q_mistake']);
  const wrong = planReviseCards({ mistake: fx.mistake, checkRow: row('q_concept'), right: false, nowMs: now });
  assert.deepEqual(wrong.rows.map((r) => r.question_id), ['q_mistake', 'q_concept']);
  for (const card of wrong.rows) {
    assert.deepEqual(Object.keys(card).sort(), ['box', 'due_day', 'key_hash', 'question_id', 'right_total', 'state', 'wrong_at']);
    assert.equal(card.box, 1);
    assert.equal(card.state, 'active');
    assert.equal(card.right_total, 0);
    assert.match(card.key_hash, /^[0-9a-f]{16}$/);
  }
  assert.equal(wrong.rows[1].wrong_at, new Date(now).toISOString());
  const summary = reviseSummary({ written: 2, dueDay: wrong.dueDay, nowMs: now });
  assert.deepEqual(summary, { scheduled: true, nextAt: '2026-10-17T18:30:00.000Z', dueDay: '2026-10-18', whenLabel: 'tomorrow', cards: 2 });
  assert.equal(reviseSummary({ written: 1, dueDay: '2026-10-21', nowMs: now }).whenLabel, 'Wed 21 Oct');
  // An existing card keeps its own day: due today, or already past, it says today (never tomorrow, never a day that has gone).
  assert.equal(reviseSummary({ written: 1, dueDay: '2026-10-17', nowMs: now }).whenLabel, 'today');
  assert.equal(reviseSummary({ written: 1, dueDay: '2026-10-12', nowMs: now }).whenLabel, 'today');
  assert.deepEqual(reviseSummary({ written: 0 }), { scheduled: false, reason: 'unavailable', nextAt: null });
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(dayLabel('2026-10-17'), 'Sat 17 Oct');
  assert.equal(dayStartIso('2026-10-17'), '2026-10-16T18:30:00.000Z');
});

test('the bank explanation is cut at a sentence end and an empty one stays empty', () => {
  assert.equal(bankExplanation({ explanation: '  ' }), '');
  assert.equal(bankExplanation({}), '');
  assert.equal(bankExplanation({ explanation: 'Short one.' }), 'Short one.');
  const long = `${'A sentence about goodwill. '.repeat(60)}tail without end`;
  const cut = bankExplanation({ explanation: long }, 200);
  assert.ok(cut.length <= 200 && cut.endsWith('.'));
});

test('every reason code in the contract fixture has the words the server sends', () => {
  const contract = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/repair4/contract_check_v1.json', import.meta.url)), 'utf8'));
  assert.deepEqual(contract.reasons, CHECK_REASONS);
});

test('the rule of a saved repair: v3 rule, the older key_idea, or nothing', async () => {
  const { ruleOf } = await import('../repair_check.js');
  assert.equal(ruleOf({ rule: '  Subtract the normal profit.  ' }), 'Subtract the normal profit.');
  assert.equal(ruleOf({ key_idea: 'An older key idea.' }), 'An older key idea.');
  assert.equal(ruleOf({ rule: '', key_idea: 'An older key idea.' }), 'An older key idea.');
  assert.equal(ruleOf({}), null);
  assert.equal(ruleOf(null), null);
});

test('a question the student wrote is never the check, and a same-family question read through the light evidence stub is excluded', () => {
  assert.equal(rejectReason({ ...row('q_concept'), author_id: 'u1' }, { mistake: fx.mistake, userId: 'u1' }), 'authored');
  assert.equal(rejectReason({ ...row('q_concept'), uploaded_by: 'u1' }, { mistake: fx.mistake, userId: 'u1' }), 'authored');
  assert.equal(rejectReason({ ...row('q_concept'), author_id: 'someone_else' }, { mistake: fx.mistake, userId: 'u1' }), null);
  assert.equal(pick({ candidates: fx.candidates.map((c) => (c.id === 'q_concept' ? { ...c, author_id: 'u1' } : c)) }).row.id, 'q_topic');
  // Evidence-managed rows carry their family in `ev_family` in the light read; the mistake is read in full.
  const mistake = { ...fx.mistake, family_id: null, evidence: { record: { family_id: 'fam_x' } } };
  assert.equal(rejectReason({ ...row('q_concept'), family_id: null, ev_family: 'fam_x' }, { mistake }), 'same_family');
});
