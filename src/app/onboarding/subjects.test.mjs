import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SUBJECTS, subjectLight, pickableSubjects, subjectName, staleSubjects, toggleSubject,
  sameSubjects, chosenCount, saveState, firstCheckHref, formatTime12, isOffline,
} from './subjects.mjs';

const CATALOG = [
  { id: 'accountancy', internalId: 'accountancy', name: 'Accountancy', practice: 'supported' },
  { id: 'economics', internalId: 'economics', name: 'Economics / Business Economics', practice: 'supported' },
  { id: 'general_test', internalId: 'gat', name: 'General Test', practice: 'supported' },
  { id: 'applied_mathematics', internalId: 'applied_mathematics', name: 'Applied Mathematics', practice: 'merged', practiceReason: 'Examined with Mathematics (319). Choose that subject.' },
  { id: 'assamese', internalId: 'assamese', name: 'Assamese', practice: 'unsupported' },
  { id: 'hindi', internalId: 'hindi', name: 'Hindi' },
];

test('only supported subjects can be picked; a row without practice is not offered', () => {
  assert.deepEqual(pickableSubjects(CATALOG).map((s) => s.id), ['accountancy', 'economics', 'general_test']);
  assert.deepEqual(pickableSubjects(null), []);
});

test('saved subjects practice cannot open are listed with a reason, in saved order', () => {
  const stale = staleSubjects(['applied_mathematics', 'accountancy', 'retired_subject', 'assamese', 'hindi'], CATALOG);
  // Hindi's row does not say whether practice opens: unknown is not flagged as "cannot".
  assert.deepEqual(stale.map((s) => s.id), ['applied_mathematics', 'retired_subject', 'assamese']);
  assert.equal(stale[0].reason, 'Examined with Mathematics (319). Choose that subject.');
  assert.equal(stale[1].name, 'Retired subject');
  assert.match(stale[1].reason, /no longer on the CUET list/);
  assert.equal(stale[2].reason, 'Practice is not open for this subject.');
  assert.deepEqual(staleSubjects(['accountancy'], CATALOG), []);
});

test('toggling adds, removes, and refuses a sixth with a reason flag', () => {
  assert.deepEqual(toggleSubject([], 'a'), { selected: ['a'], capped: false });
  assert.deepEqual(toggleSubject(['a', 'b'], 'a'), { selected: ['b'], capped: false });
  const full = ['a', 'b', 'c', 'd', 'e'];
  assert.equal(full.length, MAX_SUBJECTS);
  assert.deepEqual(toggleSubject(full, 'f'), { selected: full, capped: true });
  assert.deepEqual(toggleSubject(full, 'c'), { selected: ['a', 'b', 'd', 'e'], capped: false });
});

test('save state: needs one, needs a change, explains itself', () => {
  assert.deepEqual(saveState([], null), { canSave: false, reason: 'Pick at least one subject.' });
  assert.deepEqual(saveState([], ['a'], { requireOne: true }), { canSave: false, reason: 'Keep at least one subject.' });
  assert.deepEqual(saveState(['b', 'a'], ['a', 'b']), { canSave: false, reason: 'Pick or remove a subject to save.' });
  assert.deepEqual(saveState(['a', 'c'], ['a', 'b']), { canSave: true, reason: '' });
  assert.equal(saveState(['a', 'b', 'c', 'd', 'e', 'f'], null).canSave, false);
  assert.ok(sameSubjects(['a', 'b'], ['b', 'a']));
  assert.ok(!sameSubjects(['a'], ['a', 'b']));
});

test('names never print a raw id', () => {
  assert.equal(subjectName(CATALOG, 'gat'), 'General Test');
  assert.equal(subjectName(CATALOG, 'general_test'), 'General Test');
  assert.equal(subjectName(CATALOG, 'business_studies'), 'Business studies');
  assert.equal(subjectName([], 'legal_studies'), 'Legal studies');
});

test('every subject has a light field; unknown ids share the sepia one', () => {
  assert.deepEqual(subjectLight('accountancy'), { night: '#3B2A10', day: '#F6E8CF' });
  assert.deepEqual(subjectLight('gat'), subjectLight('general_test'));
  assert.deepEqual(subjectLight('assamese'), { night: '#2E2418', day: '#EFE5D6' });
  assert.deepEqual(subjectLight(undefined), subjectLight('language'));
});

test('first check opens Practice prefilled with 10 quick questions', () => {
  assert.equal(firstCheckHref('business_studies'), '/dashboard?subject=business_studies&mode=quick&count=10');
  assert.equal(firstCheckHref('a&b'), '/dashboard?subject=a%26b&mode=quick&count=10');
});

test('copy helpers: counts and 12-hour time', () => {
  assert.equal(chosenCount(2), '2 of 5 chosen');
  assert.equal(formatTime12(new Date(2026, 9, 14, 23, 42)), '11:42 PM');
  assert.equal(formatTime12(new Date(2026, 9, 14, 0, 5)), '12:05 AM');
  assert.equal(formatTime12(new Date(2026, 9, 14, 12, 0)), '12:00 PM');
  assert.equal(formatTime12('not a date'), '');
});

test('offline detection follows the fetch wrapper', () => {
  assert.ok(isOffline({ kind: 'network' }));
  assert.ok(isOffline(new TypeError('Failed to fetch')));
  assert.ok(!isOffline(Object.assign(new Error('Unauthorized'), { status: 401 })));
});
