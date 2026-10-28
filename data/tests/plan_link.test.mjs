// The plan row a practice set came from (data/plan_item.js), the chapter list in a link (data/chapter_list.js) and the
// dashboard end of a "Do these next" row (data/plan_link.js). Specs D.5-4 and D.5-5.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChapterList, CHAPTER_LIST_MAX } from '../chapter_list.js';
import { readPlanItemRef, planItemMetadata } from '../plan_item.js';
import { linkedChapters, linkedPlanItem, planItemToForward } from '../plan_link.js';
import { getCanonicalChapters, isValidTopSyllabusPair, TOP_SUBJECTS } from '../canonical_syllabus.js';
import { buildSwot } from '../mock_swot.js';

const valid = (subject) => (name) => isValidTopSyllabusPair(subject, name);

test('nine canonical chapters hold a comma, so a joined list is read against the real names', () => {
  const withComma = TOP_SUBJECTS.flatMap((subject) => getCanonicalChapters(subject).filter((c) => c.includes(',')).map((c) => [subject, c]));
  assert.ok(withComma.length >= 9, 'the syllabus still has chapters with a comma in the name');
  for (const [subject, name] of withComma) {
    assert.deepEqual(parseChapterList(name, valid(subject)), [name], name);
  }
  // A plain split cut these in two; the session start then refused them as INVALID_CHAPTER.
  assert.notDeepEqual('Alcohols, Phenols & Ethers'.split(','), ['Alcohols, Phenols & Ethers']);
});

test('lists mix chapters with and without a comma, in order, once each', () => {
  const chem = valid('chemistry');
  assert.deepEqual(parseChapterList('Haloalkanes and Haloarenes,Alcohols, Phenols & Ethers,Biomolecules', chem), ['Haloalkanes and Haloarenes', 'Alcohols, Phenols & Ethers', 'Biomolecules']);
  assert.deepEqual(parseChapterList('Biomolecules,Biomolecules', chem), ['Biomolecules']);
  assert.deepEqual(parseChapterList('Alcohols, Phenols & Ethers,Aldehydes, Ketones & Carboxylic Acids', chem), ['Alcohols, Phenols & Ethers', 'Aldehydes, Ketones & Carboxylic Acids']);
  assert.deepEqual(parseChapterList('', chem), []);
  assert.deepEqual(parseChapterList(',,', chem), []);
  assert.deepEqual(parseChapterList(undefined, chem), []);
});

test('a piece that is not a real chapter is kept as it is, so the caller still refuses it', () => {
  const chem = valid('chemistry');
  assert.deepEqual(parseChapterList('Biomolecules,Not a chapter', chem), ['Biomolecules', 'Not a chapter']);
  assert.deepEqual(parseChapterList('Alcohols, Phenols', chem), ['Alcohols', ' Phenols'], 'half a name is not a name');
  assert.deepEqual(parseChapterList(['Biomolecules', 'X'], chem), ['Biomolecules', 'X'], 'an array reads as already split');
  assert.deepEqual(parseChapterList('A,B'), ['A', 'B'], 'with no check the pieces stand');
});

test('at most CHAPTER_LIST_MAX chapters', () => {
  const raw = Array.from({ length: 30 }, (_, i) => `Chapter ${i}`).join(',');
  assert.equal(parseChapterList(raw, () => false).length, CHAPTER_LIST_MAX);
});

test('plan item ids: well formed or nothing', () => {
  assert.deepEqual(readPlanItemRef({ planAttemptId: 'mock-3', itemId: 'x', planItemId: 'p2' }), { attemptId: 'mock-3', itemId: 'p2' });
  assert.deepEqual(readPlanItemRef({ planAttemptId: 'att_practice_0123456789abcdef0123456789abcdef', planItemId: 'p1' }), { attemptId: 'att_practice_0123456789abcdef0123456789abcdef', itemId: 'p1' });
  assert.deepEqual(readPlanItemRef({ planAttemptId: '3f1c2d9e-8b7a-4c5d-9e0f-1a2b3c4d5e6f', planItemId: 'p3' }), { attemptId: '3f1c2d9e-8b7a-4c5d-9e0f-1a2b3c4d5e6f', itemId: 'p3' });
  for (const bad of [
    { planAttemptId: 'mock-3' }, { planItemId: 'p1' }, { planAttemptId: 'mock-3', planItemId: 'p0' }, { planAttemptId: 'mock-3', planItemId: 'p10' },
    { planAttemptId: 'mock-3', planItemId: 'q1' }, { planAttemptId: 'm', planItemId: 'p1' }, { planAttemptId: 'a'.repeat(121), planItemId: 'p1' },
    { planAttemptId: '../etc/passwd', planItemId: 'p1' }, { planAttemptId: 'mock 3', planItemId: 'p1' }, { planAttemptId: { $ne: 1 }, planItemId: 'p1' },
    { planAttemptId: ['mock-3'], planItemId: 'p1' }, { planAttemptId: 'mock-3', planItemId: ['p1'] }, null, undefined, {},
  ]) assert.equal(readPlanItemRef(bad), null, JSON.stringify(bad));
});

test('selection_meta.planItem is written for a quick set only, with the chapters the server kept', () => {
  const input = { planAttemptId: 'mock-3', planItemId: 'p2', mode: 'quick' };
  assert.deepEqual(planItemMetadata(input, { mode: 'quick', chapters: ['Debentures', 'Share Capital'] }), { planItem: { attemptId: 'mock-3', itemId: 'p2', chapters: ['Debentures', 'Share Capital'] } });
  assert.deepEqual(planItemMetadata(input, { mode: 'quick' }), { planItem: { attemptId: 'mock-3', itemId: 'p2', chapters: [] } });
  for (const mode of ['full', 'smart', 'nta']) assert.deepEqual(planItemMetadata(input, { mode, chapters: [] }), {}, mode);
  assert.deepEqual(planItemMetadata({ planAttemptId: 'bad id', planItemId: 'p2' }, { mode: 'quick' }), {});
  assert.deepEqual(planItemMetadata({}, { mode: 'quick' }), {});
  const chapters = ['Debentures'];
  planItemMetadata(input, { mode: 'quick', chapters }).planItem.chapters.push('x');
  assert.deepEqual(chapters, ['Debentures'], 'the stored list is a copy');
});

const params = (query) => new URLSearchParams(query);
const names = getCanonicalChapters('chemistry');

test('a link names one chapter, several, or none, only from the subject\'s own chapters', () => {
  assert.deepEqual(linkedChapters(params('subject=chemistry&chapter=Biomolecules'), names), ['Biomolecules']);
  assert.deepEqual(linkedChapters(params(`subject=chemistry&chapters=${encodeURIComponent('Biomolecules,Alcohols, Phenols & Ethers')}`), names), ['Biomolecules', 'Alcohols, Phenols & Ethers']);
  assert.deepEqual(linkedChapters(params('subject=chemistry&chapter=Nope'), names), []);
  assert.deepEqual(linkedChapters(params('subject=chemistry&chapters=Biomolecules,Nope'), names), ['Biomolecules']);
  assert.deepEqual(linkedChapters(params('subject=chemistry'), names), []);
  assert.deepEqual(linkedChapters(params('subject=chemistry&chapters=Biomolecules&chapter=Nope'), names), ['Biomolecules'], 'the list wins over the single name');
  assert.deepEqual(linkedChapters(params('subject=chemistry&chapter=Biomolecules'), undefined), []);
});

test('the plan row ids are handed to the session only while the set is what the row asked for', () => {
  const link = `subject=chemistry&mode=quick&count=10&chapters=${encodeURIComponent('Biomolecules,Alcohols, Phenols & Ethers')}&planAttemptId=mock-3&planItemId=p2`;
  const base = { params: params(link), subject: 'chemistry', chapterNames: names, selectedChapters: ['Alcohols, Phenols & Ethers', 'Biomolecules'], count: 10, modeId: 'quick' };
  assert.deepEqual(planItemToForward(base), { attemptId: 'mock-3', itemId: 'p2' }, 'the same chapters in any order');
  assert.equal(planItemToForward({ ...base, count: 15 }), null, 'a different size is a different set');
  assert.equal(planItemToForward({ ...base, modeId: 'smart' }), null);
  assert.equal(planItemToForward({ ...base, subject: 'physics' }), null);
  assert.equal(planItemToForward({ ...base, selectedChapters: ['Biomolecules'] }), null, 'a chapter taken away');
  assert.equal(planItemToForward({ ...base, selectedChapters: [...base.selectedChapters, 'Polymers'] }), null, 'a chapter added');
  assert.equal(planItemToForward({ ...base, selectedChapters: [] }), null);
  assert.equal(planItemToForward({ ...base, params: params(link.replace('planItemId=p2', 'planItemId=zz')) }), null, 'a malformed id is dropped');
  assert.equal(planItemToForward({ ...base, params: params('subject=chemistry&mode=quick&count=10') }), null, 'an ordinary launch carries no row');
  // A mixed row names no chapter, so a set with no chapter chosen is that row.
  const mixed = params('subject=chemistry&mode=quick&count=10&planAttemptId=mock-3&planItemId=p1');
  assert.deepEqual(planItemToForward({ ...base, params: mixed, selectedChapters: [] }), { attemptId: 'mock-3', itemId: 'p1' });
  assert.equal(planItemToForward({ ...base, params: mixed, selectedChapters: ['Biomolecules'] }), null);
  assert.deepEqual(linkedPlanItem(mixed), { attemptId: 'mock-3', itemId: 'p1' });
});

test('the link a plan row writes is read back as the same set, and the row id travels', () => {
  const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'swot', 'three_mocks_repeat_loss.json'), 'utf8'));
  const plan = buildSwot({ attempt: fixture.attempt, allAttempts: fixture.allAttempts, missedBefore: fixture.missedBefore, now: fixture.now }).plan;
  assert.ok(plan.length >= 2);
  const accountancy = getCanonicalChapters('accountancy');
  for (const row of plan) {
    const query = new URL(row.href, 'https://mockmob.test').searchParams;
    assert.deepEqual(linkedChapters(query, accountancy), row.practice.chapters, row.id);
    assert.equal(Number(query.get('count')), row.practice.count);
    assert.deepEqual(linkedPlanItem(query), { attemptId: fixture.attempt.id, itemId: row.id });
    // Opened and launched as it is, the set carries its row.
    assert.deepEqual(planItemToForward({ params: query, subject: 'accountancy', chapterNames: accountancy, selectedChapters: row.practice.chapters, count: row.practice.count, modeId: 'quick' }), { attemptId: fixture.attempt.id, itemId: row.id });
  }
  // Several chapters, one of them with a comma in its name: the same round trip.
  const many = `/dashboard?subject=chemistry&mode=quick&count=10&chapters=${encodeURIComponent('Biomolecules,Alcohols, Phenols & Ethers')}&planAttemptId=mock-9&planItemId=p1`;
  const query = new URL(many, 'https://mockmob.test').searchParams;
  assert.deepEqual(linkedChapters(query, names), ['Biomolecules', 'Alcohols, Phenols & Ethers']);
});
