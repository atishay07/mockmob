import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyNtaType, getNtaBlueprint } from '../nta_engine.js';
import { listedOrderKeyReasons } from '../nta_item_checks.js';
import { planListedOrderFix, remapExplanation, parseItems, rowStillAsWritten } from '../../scripts/lib/listed-order-reorder.mjs';
import { apply, dryRun, parseArgs, readIds, release, restore } from '../../scripts/question-reorder.mjs';

// ---------------------------------------------------------------------------------------------
// Fixtures: the stored shapes of the 63 real rows (string options or {key,text} options, multi-line or inline stems)
// ---------------------------------------------------------------------------------------------

const MATCH_STEM = `Match List-I with List-II.

List-I
(A) Method that discloses gross cash receipts and payments
(B) Method that adjusts net profit for non-cash items
(C) Starting point under the indirect method
(D) Statement that the information is not available under the indirect method

List-II
(I) Direct method
(II) Adjustment of net profit for non-cash transactions
(III) Net profit before taxation and extraordinary items
(IV) Information useful in estimating future cash flows is not available

Choose the correct answer from the options given below:`;
const matchRow = (over = {}) => ({
  id: '11111111-1111-4111-8111-111111111111', subject: 'accountancy', chapter: 'Cash Flow Statement', status: 'live', verification_state: 'verified', exploration_state: 'active', is_deleted: false,
  question: null, body: MATCH_STEM,
  options: ['(A)-(II), (B)-(I), (C)-(III), (D)-(IV)', '(A)-(I), (B)-(II), (C)-(IV), (D)-(III)', '(A)-(IV), (B)-(II), (C)-(III), (D)-(I)', '(A)-(I), (B)-(II), (C)-(III), (D)-(IV)'],
  correct_answer: 'D', correct_index: null, explanation: 'The links are (A)-(I), (B)-(II), (C)-(III) and (D)-(IV).', updated_at: '2026-10-07T09:30:48.216514+00:00', ...over,
});

const SEQUENCE_STEM = `A deceased partner's claim is being prepared. Arrange the following stages in the order needed to determine and deal with the amount due.

(A) Add the credit items to obtain the gross claim.
(B) Subtract the deductions to obtain the net amount due.
(C) Transfer the claim to the executors.
(D) Settle the executors' claim like a retired partner's claim.

Choose the correct sequence:`;
const sequenceRow = (over = {}) => ({
  id: '22222222-2222-4222-8222-222222222222', subject: 'accountancy', chapter: 'Retirement & Death of Partner', status: 'live', verification_state: 'verified', exploration_state: 'active', is_deleted: false,
  question: null, body: SEQUENCE_STEM,
  options: ['(B), (A), (C), (D)', '(A), (C), (B), (D)', '(A), (B), (D), (C)', '(A), (B), (C), (D)'],
  correct_answer: 'D', correct_index: null, explanation: 'Credit items are added, deductions are subtracted, and the claim goes to the executors. The order is (A), (B), (C), (D).', updated_at: '2026-10-07T09:30:49.000000+00:00', ...over,
});

const INLINE_MATCH = {
  id: '33333333-3333-4333-8333-333333333333', subject: 'history', chapter: 'Kings, Farmers & Towns', status: 'live', verification_state: 'verified', exploration_state: 'active', is_deleted: false,
  question: null,
  body: 'Match List I with List II: List I: (A) Batai (B) Raiyat (C) Zamindar (D) Panchayat. List II: (1) Division of crop between cultivator and owner (2) Cultivator or tenant (3) Revenue intermediary/landholder (4) Village council. Choose the correct matching.',
  options: [{ key: 'A', text: 'A A-1, B-2, C-3, D-4' }, { key: 'B', text: 'B A-2, B-1, C-3, D-4' }, { key: 'C', text: 'C A-1, B-3, C-2, D-4' }, { key: 'D', text: 'D A-4, B-2, C-1, D-3' }],
  correct_answer: 'A', correct_index: null, explanation: 'Batai is the division of the crop, a raiyat is a tenant, a zamindar is a revenue intermediary and a panchayat is the village council.', updated_at: '2026-10-07T09:30:50.000000+00:00',
};

const BARE_MATCH = {
  id: '44444444-4444-4444-8444-444444444444', subject: 'political_science', chapter: 'Globalisation', status: 'live', verification_state: 'verified', exploration_state: 'active', is_deleted: false,
  question: null,
  body: 'Match the South Asian challenge (List I) with the globalization-driven cause (List II).\nList I: A Cross-border migration, B Domestic industries facing trade pressure, C Water-sharing disputes\nList II: 1 Increased labour mobility across borders, 2 Exposure to competitive global markets, 3 Competition for resources intensified by integrated markets\nChoose the correct matching.',
  options: [{ key: 'A', text: 'A A–1, B–2, C–3' }, { key: 'B', text: 'B A–2, B–1, C–3' }, { key: 'C', text: 'C A–1, B–3, C–2' }, { key: 'D', text: 'D A–3, B–2, C–1' }],
  correct_answer: 'A', correct_index: null, explanation: 'Migration is labour mobility (1), industries face competition (2) and water disputes are resource competition (3).', updated_at: '2026-10-07T09:30:51.000000+00:00',
};

const DOTTED_SEQUENCE = {
  id: '55555555-5555-4555-8555-555555555555', subject: 'economics', chapter: 'Planning', status: 'live', verification_state: 'verified', exploration_state: 'active', is_deleted: false,
  question: null,
  body: 'A planning team is arranging a framework. Arrange the following elements in a coherent sequence.\n\nI. Specify objectives to be attained within a five-year plan.\nII. Specify what is to be achieved over a twenty-year period.\nIII. Identify the twenty-year long-term plan as the perspective plan.\nIV. Treat the five-year plans as the basis for the perspective plan.\n\nChoose the correct sequence:',
  options: ['I → III → II → IV', 'II → I → III → IV', 'I → II → IV → III', 'I → II → III → IV'],
  correct_answer: 'D', correct_index: null, explanation: 'Begin with the five-year objectives. The correct sequence is I, II, III, IV.', updated_at: '2026-10-07T09:30:52.000000+00:00',
};

const NUMBERED_SEQUENCE = {
  id: '66666666-6666-4666-8666-666666666666', subject: 'economics', chapter: 'Environment', status: 'live', verification_state: 'verified', exploration_state: 'active', is_deleted: false,
  question: null,
  body: 'Four developments concerning pesticide control are listed below.\n1. Milk, meat and fish were found to be contaminated.\n2. Efforts were made to bring in better methods of pest control.\n3. Pesticides based on plant products were used as one such step.\n4. Pest-controlling chemicals isolated from neem were being used.\nArrange them in the order that moves from the reported problem to the specific plant-based response.\nChoose the correct sequence:',
  options: ['2-1-3-4', '1-3-2-4', '1-2-3-4', '1-2-4-3'],
  correct_answer: 'C', correct_index: null, explanation: 'The sequence is therefore 1-2-3-4.', updated_at: '2026-10-07T09:30:53.000000+00:00',
};

const THREE_ITEM_SEQUENCE = {
  id: '77777777-7777-4777-8777-777777777777', subject: 'business_studies', chapter: 'Consumer Protection', status: 'live', verification_state: 'verified', exploration_state: 'active', is_deleted: false,
  question: 'Riya is selecting a household product. Arrange the following consumer responsibilities in order.\n(A) Be aware of the goods and services available in the market.\n(B) Buy only standardised goods.\n(C) Learn about risks and use the product safely.\nChoose the correct order from the options given below:',
  options: ['(A)-(C)-(B)', '(C)-(B)-(A)', '(B)-(A)-(C)', '(A)-(B)-(C)'],
  correct_answer: 'D', correct_index: null, explanation: 'Awareness comes first, then choosing standardised goods, then safe use.', updated_at: '2026-10-07T09:30:54.000000+00:00',
};

const typeOf = (row) => {
  const blueprint = getNtaBlueprint(row.subject);
  return classifyNtaType(row, row.subject, blueprint ? Object.keys(blueprint.typeQuotas) : undefined);
};
const stemOf = (row) => row.question || row.body;
const optionTexts = (row) => row.options.map((o) => (typeof o === 'string' ? o : o.text));
const keyOption = (row) => optionTexts(row)['ABCD'.indexOf(row.correct_answer)];
const rowFrom = (row, plan) => ({ ...row, [plan.stemField]: plan.after.stem, options: plan.after.options, explanation: plan.after.explanation });

// Test-owned readers, so the checks do not lean on the code under test.
function bodiesByLabel(stem, labelPattern, marker) {
  const out = {};
  for (const line of stem.split('\n')) {
    const m = line.match(marker);
    if (m) out[m[1]] = line.slice(m[0].length).trim();
  }
  return out;
}
const sequenceMeaning = (stem, optionText, marker) => {
  const bodies = bodiesByLabel(stem, null, marker);
  return optionText.match(/\(?\b(VI|IV|V|I{1,3}|[A-F]|[1-6])\b\)?/g).map((token) => bodies[token.replace(/[()]/g, '')]);
};

// ---------------------------------------------------------------------------------------------
// Pure plan
// ---------------------------------------------------------------------------------------------

test('every fixture starts as a listed-order key, and a rewrite clears the gate for the key and every distractor', () => {
  for (const row of [matchRow(), sequenceRow(), INLINE_MATCH, BARE_MATCH, DOTTED_SEQUENCE, NUMBERED_SEQUENCE, THREE_ITEM_SEQUENCE]) {
    assert.ok(listedOrderKeyReasons(row, typeOf(row)).length, `${row.id} should start flagged`);
    const plan = planListedOrderFix(row);
    assert.equal(plan.outcome, 'reorder', `${row.id}: ${plan.reasons}`);
    const after = rowFrom(row, plan);
    assert.deepEqual(listedOrderKeyReasons(after, typeOf(after)), [], row.id);
    assert.equal(after.correct_answer, row.correct_answer, 'the key keeps its option position');
    assert.equal(plan.after.options.length, row.options.length);
    assert.equal(new Set(optionTexts(after)).size, row.options.length, 'options stay distinct');
    assert.notEqual(stemOf(after), stemOf(row));
  }
});

test('sequence: the key still lists the same steps in the same logical order after the stem is reprinted', () => {
  const row = sequenceRow();
  const plan = planListedOrderFix(row);
  const after = rowFrom(row, plan);
  const marker = /^\(([A-D])\)\s*/;
  const before = sequenceMeaning(row.body, keyOption(row), marker);
  const now = sequenceMeaning(after.body, keyOption(after), marker);
  assert.deepEqual(now, before);
  assert.deepEqual(before.map((s) => s.split(' ')[0]), ['Add', 'Subtract', 'Transfer', 'Settle']);
  // Labels are re-issued in print order and the preamble and closing line are untouched.
  assert.deepEqual([...after.body.matchAll(/^\(([A-D])\)/gm)].map((m) => m[1]), ['A', 'B', 'C', 'D']);
  assert.ok(after.body.startsWith('A deceased partner'));
  assert.ok(after.body.endsWith('Choose the correct sequence:'));
  assert.notDeepEqual(plan.order, [0, 1, 2, 3]);
  assert.equal(keyOption(after).match(/[A-D]/g).join(''), plan.labelMap.A + plan.labelMap.B + plan.labelMap.C + plan.labelMap.D);
});

test('sequence: the explanation that names the old order is rewritten to the new labels', () => {
  const row = sequenceRow();
  const plan = planListedOrderFix(row);
  const after = rowFrom(row, plan);
  assert.equal(plan.explanationChanged, true);
  assert.ok(after.explanation.endsWith(`The order is ${keyOption(after)}.`), after.explanation);
});

test('sequence with roman, dotted items and arrows, and numbered items with a bare chain in the explanation', () => {
  for (const [row, marker, suffix] of [[DOTTED_SEQUENCE, /^(I{1,3}|IV)\.\s*/, /\b(?:IV|III|II|I)\b/g], [NUMBERED_SEQUENCE, /^([1-4])\.\s*/, /[1-4]/g]]) {
    const plan = planListedOrderFix(row);
    assert.equal(plan.outcome, 'reorder', plan.reasons?.join());
    const after = rowFrom(row, plan);
    assert.deepEqual(sequenceMeaning(after.body, keyOption(after), marker).length, 4);
    assert.deepEqual(sequenceMeaning(after.body, keyOption(after), marker), sequenceMeaning(row.body, keyOption(row), marker));
    const spelled = keyOption(after).match(suffix); 
    assert.ok(after.explanation.includes(spelled.join(row === NUMBERED_SEQUENCE ? '-' : ', ')), `${after.explanation} should spell ${spelled}`);
  }
});

test('sequence of three items has a valid rewrite and keeps its question field', () => {
  const plan = planListedOrderFix(THREE_ITEM_SEQUENCE);
  assert.equal(plan.outcome, 'reorder');
  assert.equal(plan.stemField, 'question');
  const after = rowFrom(THREE_ITEM_SEQUENCE, plan);
  assert.equal(after.body, undefined);
  assert.notEqual(keyOption(after), '(A)-(B)-(C)');
  assert.notEqual(keyOption(after), '(C)-(B)-(A)', 'a straight reversal is as much a tell');
});

test('match: List-I is untouched, List-II is reordered, and the key pairs the same two entries', () => {
  const row = matchRow();
  const plan = planListedOrderFix(row);
  const after = rowFrom(row, plan);
  const left = (stem) => stem.slice(stem.indexOf('List-I\n'), stem.indexOf('List-II\n'));
  assert.equal(left(after.body), left(row.body));
  const marker = /^\((I{1,3}|IV)\)\s*/;
  const rightBefore = bodiesByLabel(row.body, null, marker);
  const rightAfter = bodiesByLabel(after.body, null, marker);
  const pairs = (option) => [...option.matchAll(/\(([A-D])\)-\((I{1,3}|IV)\)/g)].map((m) => [m[1], m[2]]);
  const meaning = (option, right) => pairs(option).map(([l, r]) => [l, right[r]]);
  assert.deepEqual(meaning(keyOption(after), rightAfter), meaning(keyOption(row), rightBefore));
  assert.deepEqual(Object.values(rightAfter).sort(), Object.values(rightBefore).sort());
  assert.deepEqual(Object.keys(rightAfter), ['I', 'II', 'III', 'IV']);
  assert.ok(after.body.endsWith('Choose the correct answer from the options given below:'));
  // The explanation named the old pairs; it now names the new ones.
  assert.deepEqual(pairs(after.explanation), pairs(keyOption(after)));
});

test('match: inline stems with parenthesised or bare numbers keep the stored option prefix and shape', () => {
  for (const row of [INLINE_MATCH, BARE_MATCH]) {
    const plan = planListedOrderFix(row);
    assert.equal(plan.outcome, 'reorder', plan.reasons?.join());
    const after = rowFrom(row, plan);
    after.options.forEach((option, i) => {
      assert.equal(option.key, row.options[i].key);
      assert.equal(option.text.slice(0, 2), row.options[i].text.slice(0, 2), 'the stored "A " prefix stays');
    });
    // Same entries, new numbers: every old entry text is still in the stem exactly once.
    const entries = (stem) => stem.slice(stem.search(/List II:/)).replace(/Choose.*$/s, '');
    for (const phrase of ['Division of crop', 'Cultivator or tenant', 'Revenue intermediary', 'Village council', 'labour mobility', 'competitive global markets', 'Competition for resources']) {
      const had = entries(row.body).includes(phrase);
      assert.equal(entries(after.body).includes(phrase), had, phrase);
    }
    assert.ok(/\.\s+Choose the correct matching\.$/.test(after.body) || after.body.endsWith('Choose the correct matching.'), 'the closing sentence is untouched');
  }
  const inline = rowFrom(INLINE_MATCH, planListedOrderFix(INLINE_MATCH));
  assert.ok(/\(4\) [^()]+\. Choose the correct matching\.$/.test(inline.body), `terminal full stop stays at the end: ${inline.body}`);
  assert.equal([...inline.body.matchAll(/\(\d\)/g)].map((m) => m[0]).join(''), '(1)(2)(3)(4)');
});

test('match: a bare-number explanation is remapped in step with the stem', () => {
  const plan = planListedOrderFix(BARE_MATCH);
  const after = rowFrom(BARE_MATCH, plan);
  const m = plan.labelMap;
  assert.equal(after.explanation, `Migration is labour mobility (${m[1]}), industries face competition (${m[2]}) and water disputes are resource competition (${m[3]}).`);
});

test('the same seed and id always give the same rewrite; another seed can give another', () => {
  const a = planListedOrderFix(matchRow(), { seed: 's1' });
  const b = planListedOrderFix(matchRow(), { seed: 's1' });
  assert.deepEqual(a.after, b.after);
  const seen = new Set(['s1', 's2', 's3', 's4', 's5', 's6'].map((seed) => planListedOrderFix(matchRow(), { seed }).after.stem));
  assert.ok(seen.size > 1);
});

test('rows this module will not rewrite are held, with the reason', () => {
  const printed = matchRow({ body: `${MATCH_STEM}\nA. (A)-(II), (B)-(I), (C)-(III), (D)-(IV)\nB. (A)-(I), (B)-(II), (C)-(IV), (D)-(III)\nC. (A)-(I), (B)-(II), (C)-(III), (D)-(IV)\nD. (A)-(IV), (B)-(II), (C)-(III), (D)-(I)`, correct_answer: 'D' });
  assert.deepEqual([planListedOrderFix(printed).outcome, planListedOrderFix(printed).reasons], ['hold', ['options_printed_in_stem']]);

  const brokenKind = matchRow({ body: SEQUENCE_STEM });
  assert.equal(planListedOrderFix(brokenKind).outcome, 'hold');
  assert.deepEqual(planListedOrderFix(brokenKind).reasons, ['list_two_not_found']);

  const named = sequenceRow({ explanation: 'Step B must follow step A, so the order is (A), (B), (C), (D).' });
  assert.deepEqual(planListedOrderFix(named).reasons, ['explanation_names_label_in_words']);

  const numberPair = planListedOrderFix({ ...NUMBERED_SEQUENCE, explanation: 'The sequence is 1-2-3-4. Efforts spanned 3-4 decades.' });
  assert.deepEqual(numberPair.reasons, ['explanation_has_number_pair']);

  const noKey = sequenceRow({ correct_answer: 'Z' });
  assert.equal(planListedOrderFix(noKey).outcome, 'skip', 'an unresolved key is not a listed-order key');

  const notWords = sequenceRow({ options: ['(B), (A) and (C)', '(A), (C), (B), (D)', '(A), (B), (D), (C)', '(A), (B), (C), (D)'] });
  assert.equal(planListedOrderFix(notWords).outcome, 'hold');

  const twoFields = sequenceRow({ question: 'x', body: SEQUENCE_STEM });
  assert.deepEqual([planListedOrderFix(twoFields).outcome, planListedOrderFix(twoFields).reasons], ['hold', ['stem_items_not_found']], 'the engine reads question first, so the stem it sees has no list');
});

test('a row that is not a listed-order key is skipped untouched', () => {
  const plan = planListedOrderFix(sequenceRow({ options: ['(B), (A), (C), (D)', '(A), (C), (B), (D)', '(A), (B), (D), (C)', '(C), (A), (B), (D)'], correct_answer: 'D' }));
  assert.equal(plan.outcome, 'skip');
});

test('explanation remap: brackets, pairs, chains and bare lists in one pass, no double mapping', () => {
  const map = { I: 'II', II: 'I', III: 'IV', IV: 'III' };
  assert.equal(remapExplanation('(A)-(I), (B)-(II) and (C)-(III).', map, 'match').text, '(A)-(II), (B)-(I) and (C)-(IV).');
  assert.equal(remapExplanation('Order: I → III → II.', map, 'sequence').text, 'Order: II → IV → I.');
  assert.equal(remapExplanation('Order: I, II, III, IV.', map, 'sequence').text, 'Order: II, I, IV, III.');
  assert.equal(remapExplanation('Nothing to map here.', map, 'sequence').changed, false);
  assert.deepEqual(remapExplanation('Stage (II) comes first.', map, 'sequence').text, 'Stage (I) comes first.');
  assert.deepEqual(remapExplanation('See item II.', map, 'sequence').flags, ['explanation_names_label_in_words']);
});

test('parseItems finds one marker per label and refuses a stem that repeats a marker', () => {
  const ok = parseItems('Arrange:\n(A) one\n(B) two\n(C) three\nChoose', ['A', 'B', 'C']);
  assert.deepEqual(ok.items.map((i) => [i.label, i.body]), [['A', 'one'], ['B', 'two'], ['C', 'three']]);
  assert.equal(parseItems('Arrange (A):\n(A) one\n(B) two\n(C) three\nChoose', ['A', 'B', 'C']), null);
});

// ---------------------------------------------------------------------------------------------
// CLI pieces with an in-memory database
// ---------------------------------------------------------------------------------------------

function fakeClient(initialRows, { failOnUpdate = false } = {}) {
  const rows = initialRows.map((row) => structuredClone(row));
  const log = [];
  const from = () => {
    const state = { filters: [], op: 'select', patch: null, returning: false };
    const api = {
      select() { if (state.op === 'update') state.returning = true; return api; },
      in(col, values) { state.filters.push((r) => values.includes(r[col])); return api; },
      eq(col, value) { state.filters.push((r) => r[col] === value); return api; },
      match(obj) { for (const [k, v] of Object.entries(obj)) state.filters.push((r) => r[k] === v); return api; },
      update(patch) { state.op = 'update'; state.patch = patch; return api; },
      then(resolve) {
        const hit = rows.filter((r) => state.filters.every((f) => f(r)));
        if (state.op === 'update') {
          if (failOnUpdate) return resolve({ data: null, error: new Error('update failed') });
          log.push({ patch: state.patch, ids: hit.map((r) => r.id) });
          hit.forEach((r) => Object.assign(r, structuredClone(state.patch)));
          return resolve({ data: state.returning ? hit.map((r) => ({ id: r.id })) : null, error: null });
        }
        return resolve({ data: hit.map((r) => structuredClone(r)), error: null });
      },
    };
    return api;
  };
  return { rows, log, from };
}

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'question-reorder-'));
const listFile = (dir, ids) => { const file = path.join(dir, 'ids.json'); fs.writeFileSync(file, JSON.stringify(ids)); return file; };
const baseRows = () => [matchRow(), sequenceRow(), INLINE_MATCH, DOTTED_SEQUENCE];

test('parseArgs and readIds', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'ids.json');
  fs.writeFileSync(file, JSON.stringify(['a', { id: 'b' }, 'a', null]));
  assert.deepEqual(readIds([file]), ['a', 'b']);
  const args = parseArgs(['--mode=apply', '--plan=p.json', '--reason=why', '--keep-live', '--list=x', '--list=y', '--source=fixtures', '--seed=z']);
  assert.deepEqual([args.mode, args.plan, args.reason, args.keepLive, args.lists, args.source, args.seed], ['apply', 'p.json', 'why', true, ['x', 'y'], 'fixtures', 'z']);
  assert.equal(parseArgs([]).mode, 'dry-run');
});

test('dry-run writes the plan and the hold-fallback list and changes nothing', async () => {
  const dir = tmpDir();
  const rows = [...baseRows(), matchRow({ id: '99999999-9999-4999-8999-999999999999', body: SEQUENCE_STEM })];
  const db = fakeClient(rows);
  const args = parseArgs([`--list=${listFile(dir, rows.map((r) => r.id).concat('missing-id'))}`, `--out=${dir}`]);
  const result = await dryRun(args, { sb: db });
  assert.equal(result.summary.requested, 6);
  assert.equal(result.summary.found, 5);
  assert.deepEqual(result.summary.missing, ['missing-id']);
  assert.equal(result.summary.reorder, 4);
  assert.equal(result.summary.holdFallback, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(result.holdFile, 'utf8')), ['99999999-9999-4999-8999-999999999999']);
  const plan = JSON.parse(fs.readFileSync(result.planFile, 'utf8'));
  assert.equal(plan.kind, 'question_reorder_plan');
  assert.equal(plan.rows.find((r) => r.outcome === 'reorder').before.stem.length > 0, true);
  assert.equal(db.log.length, 0, 'a dry run never writes');
  assert.deepEqual(db.rows, rows, 'rows unchanged');
});

test('dry-run reads the local export when asked', async () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'accountancy.json'), JSON.stringify([matchRow()]));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({}));
  const out = tmpDir();
  const args = parseArgs([`--list=${listFile(out, [matchRow().id])}`, `--out=${out}`, '--source=fixtures', `--fixtures=${dir}`]);
  const result = await dryRun(args, { sb: null });
  assert.equal(result.summary.reorder, 1);
});

async function planned(db, rows, out, extra = []) {
  const dir = tmpDir();
  const args = parseArgs([`--list=${listFile(dir, rows.map((r) => r.id))}`, `--out=${out}`, ...extra]);
  return dryRun(args, { sb: db });
}

test('apply writes the rewritten text, withholds the row, and saves a restore file first', async () => {
  const rows = baseRows();
  const db = fakeClient(rows);
  const out = tmpDir();
  const dry = await planned(db, rows, out);
  const result = await apply(parseArgs(['--mode=apply', `--plan=${dry.planFile}`, '--reason=test', `--out=${out}`]), { sb: db });
  assert.equal(result.written, 4);
  assert.deepEqual(result.notWritten, []);
  assert.deepEqual(result.stillListedOrder, []);
  assert.deepEqual(result.stillVisible, [], 'rewritten rows stay withheld until they are re-verified');
  for (const row of db.rows) {
    assert.equal(row.status, 'pending');
    assert.equal(row.verification_state, 'disputed');
    assert.equal(row.exploration_state, 'pending_review');
    assert.notEqual(stemOf(row), stemOf(rows.find((r) => r.id === row.id)));
  }
  const saved = JSON.parse(fs.readFileSync(result.restoreFile, 'utf8'));
  assert.equal(saved.kind, 'question_reorder_restore');
  assert.equal(saved.rows.length, 4);
  assert.equal(saved.rows[0].state.status, 'live');
  assert.equal(saved.rows[0].original[saved.rows[0].stemField], stemOf(rows.find((r) => r.id === saved.rows[0].id)));
});

test('--keep-live writes the text and leaves the state alone', async () => {
  const rows = baseRows();
  const db = fakeClient(rows);
  const out = tmpDir();
  const dry = await planned(db, rows, out);
  const result = await apply(parseArgs(['--mode=apply', `--plan=${dry.planFile}`, '--reason=test', '--keep-live', `--out=${out}`]), { sb: db });
  assert.equal(result.written, 4);
  assert.ok(db.rows.every((r) => r.status === 'live' && r.verification_state === 'verified'));
});

test('apply skips a row that changed after the dry run, is held, or is no longer live', async () => {
  const rows = baseRows();
  const db = fakeClient(rows);
  const out = tmpDir();
  const dry = await planned(db, rows, out);
  db.rows[0].body = `${db.rows[0].body} (edited)`;
  db.rows[1].status = 'pending';
  db.rows[1].verification_state = 'disputed';
  db.rows[1].exploration_state = 'pending_review';
  const result = await apply(parseArgs(['--mode=apply', `--plan=${dry.planFile}`, '--reason=test', `--out=${out}`]), { sb: db });
  assert.equal(result.written, 2);
  assert.deepEqual(result.skipped.map((s) => s.why).sort(), ['changed_since_dry_run', 'not_live'].sort());
});

test('apply refuses a file that is not a reorder plan, and needs --reason', async () => {
  const out = tmpDir();
  const bad = path.join(out, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ kind: 'question_hold' }));
  await assert.rejects(apply(parseArgs(['--mode=apply', `--plan=${bad}`, '--reason=x']), { sb: fakeClient([]) }), /not a question_reorder_plan/);
  await assert.rejects(apply(parseArgs(['--mode=apply', `--plan=${bad}`]), { sb: fakeClient([]) }), /need --plan and --reason/);
});

test('the restore file exists before the first row is touched', async () => {
  const rows = baseRows();
  const db = fakeClient(rows, { failOnUpdate: true });
  const out = tmpDir();
  const dry = await planned(fakeClient(rows), rows, out);
  const before = fs.readdirSync(out).filter((f) => f.startsWith('reorder-restore-'));
  await assert.rejects(apply(parseArgs(['--mode=apply', `--plan=${dry.planFile}`, '--reason=test', `--out=${out}`]), { sb: db }), /update failed/);
  const files = fs.readdirSync(out).filter((f) => f.startsWith('reorder-restore-'));
  assert.equal(before.length, 0);
  assert.equal(files.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, files[0]), 'utf8')).rows.length, 4);
});

test('restore puts the original text and state back, and leaves a row someone edited since', async () => {
  const rows = baseRows();
  const db = fakeClient(rows);
  const out = tmpDir();
  const dry = await planned(db, rows, out);
  const applied = await apply(parseArgs(['--mode=apply', `--plan=${dry.planFile}`, '--reason=test', `--out=${out}`]), { sb: db });
  db.rows[2].explanation = 'someone edited this afterwards';
  const result = await restore(parseArgs(['--mode=restore', `--restore=${applied.restoreFile}`]), { sb: db });
  assert.equal(result.restored, 3);
  assert.deepEqual(result.skipped, [{ id: db.rows[2].id, why: 'edited_since_apply' }]);
  for (const row of db.rows.filter((r, i) => i !== 2)) {
    const original = rows.find((r) => r.id === row.id);
    assert.deepEqual([stemOf(row), row.options, row.explanation, row.status, row.verification_state, row.exploration_state], [stemOf(original), original.options, original.explanation, 'live', 'verified', 'active']);
  }
});

test('release keeps the rewritten text and puts only the saved state back', async () => {
  const rows = baseRows();
  const db = fakeClient(rows);
  const out = tmpDir();
  const dry = await planned(db, rows, out);
  const applied = await apply(parseArgs(['--mode=apply', `--plan=${dry.planFile}`, '--reason=test', `--out=${out}`]), { sb: db });
  const rewritten = db.rows.map((r) => stemOf(r));
  Object.assign(db.rows[0], { status: 'live', verification_state: 'verified', exploration_state: 'active' }); // already released by hand
  const result = await release(parseArgs(['--mode=release', `--restore=${applied.restoreFile}`]), { sb: db });
  assert.equal(result.released, 3);
  assert.deepEqual(result.skipped, [{ id: db.rows[0].id, why: 'not_in_the_hold_state' }]);
  assert.deepEqual(db.rows.map((r) => stemOf(r)), rewritten);
  assert.ok(db.rows.every((r) => r.status === 'live' && r.verification_state === 'verified' && r.exploration_state === 'active'));
});

test('rowStillAsWritten compares exactly what apply wrote', () => {
  const row = matchRow();
  const entry = { written: { body: row.body, options: row.options, explanation: row.explanation } };
  assert.equal(rowStillAsWritten(row, entry), true);
  assert.equal(rowStillAsWritten({ ...row, explanation: 'x' }, entry), false);
});

// ---------------------------------------------------------------------------------------------
// The real rows, when the local read-only export is on disk (tmp/nta-fixtures is not committed)
// ---------------------------------------------------------------------------------------------

const EXPORT = 'tmp/nta-fixtures';
const CANDIDATES = 'tmp/nta-review-cleanup/cleanup-candidates-2026-10-13.json';
const haveExport = fs.existsSync(EXPORT) && fs.existsSync(CANDIDATES);

test('the 63 exported listed-order rows: every rewrite clears the gate, nothing else changes, the rest are held', { skip: !haveExport && 'local export not on disk' }, () => {
  const ids = new Set(JSON.parse(fs.readFileSync(CANDIDATES, 'utf8')).listedOrderKeys.map((r) => r.id));
  const rows = [];
  for (const file of fs.readdirSync(EXPORT).filter((f) => f.endsWith('.json') && !['manifest.json', 'shared.json'].includes(f))) {
    for (const row of JSON.parse(fs.readFileSync(path.join(EXPORT, file), 'utf8'))) if (ids.has(row.id)) rows.push(row);
  }
  assert.equal(rows.length, 63);
  const outcomes = { reorder: 0, hold: 0, skip: 0 };
  for (const row of rows) {
    const plan = planListedOrderFix(row);
    outcomes[plan.outcome] += 1;
    if (plan.outcome !== 'reorder') continue;
    const after = rowFrom(row, plan);
    assert.deepEqual(listedOrderKeyReasons(after, typeOf(after)), [], row.id);
    assert.equal(after.correct_answer, row.correct_answer);
    assert.equal(plan.after.options.length, row.options.length);
    // Same entries, same length: the list is reprinted, nothing is added or dropped.
    assert.equal(plan.before.stem.length, plan.after.stem.length);
    assert.equal(planListedOrderFix(row).after.stem, plan.after.stem, 'deterministic');
  }
  assert.deepEqual(outcomes, { reorder: 59, hold: 3, skip: 1 });
});

test('sequence printed out of alphabetical order: the printed order is the listed order, and labels are re-issued in print order', () => {
  const row = sequenceRow({
    body: 'Arrange the following stages of a firm raising capital.\n\n(C) The firm applies for listing.\n(A) The board approves the issue.\n(D) Shares are allotted.\n(B) The prospectus is filed.\n\nChoose the correct sequence:',
    options: ['(C), (A), (D), (B)', '(A), (C), (B), (D)', '(A), (B), (D), (C)', '(D), (A), (C), (B)'],
    correct_answer: 'A', explanation: 'Listing, approval, allotment and filing follow the printed order.',
  });
  assert.ok(listedOrderKeyReasons(row, typeOf(row)).length, 'starts flagged');
  const plan = planListedOrderFix(row);
  assert.equal(plan.outcome, 'reorder', plan.reasons?.join());
  const after = rowFrom(row, plan);
  assert.deepEqual([...after.body.matchAll(/^\(([A-D])\)/gm)].map((m) => m[1]), ['A', 'B', 'C', 'D']);
  assert.deepEqual(listedOrderKeyReasons(after, typeOf(after)), []);
  const bodies = Object.fromEntries([...after.body.matchAll(/^\(([A-D])\) (.*)$/gm)].map((m) => [m[1], m[2]]));
  const read = (option) => option.match(/[A-D]/g).map((label) => bodies[label]);
  assert.deepEqual(read(keyOption(after)), ['The firm applies for listing.', 'The board approves the issue.', 'Shares are allotted.', 'The prospectus is filed.']);
});
