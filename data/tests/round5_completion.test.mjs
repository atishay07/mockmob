import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { studyDay, tonightMetadata, tonightCompletion, studyMilestones } from '../study_progress.js';
import { missedChapters, replayExposures } from '../mistake_replay.js';
import { resumableDraft, clearStudyDrafts, SUBMISSION_GRACE_MS } from '../session_draft.js';
import { cancelMonthlyRenewal } from '../../src/lib/payments/cancel.js';

const now = Date.parse('2026-10-03T16:00:00Z');
const input = { tonightKey: 'night-plan-123456', tonightMinutes: 30, mode: 'quick', count: 20 };
const attempt = overrides => ({ id: 'a1', completedAt: now - 1000, selectionMeta: { scoringVersion: 'server_practice_v1', ...tonightMetadata(input, now) }, ...overrides });

test('Tonight metadata follows the shared 10/20/30 plan and the IST day', () => {
  assert.equal(studyDay(Date.parse('2026-10-03T18:30:00Z')), '2026-10-04');
  assert.equal(tonightMetadata(input, now).tonight.minutes, 30);
  for (const invalid of [{ count: 50 }, { mode: 'nta' }, { tonightMinutes: 40 }, { tonightKey: 'bad' }]) {
    assert.deepEqual(tonightMetadata({ ...input, ...invalid }, now), {});
  }
  assert.ok(tonightMetadata({ ...input, tonightMinutes: 10, count: 10 }, now).tonight);
  assert.ok(tonightMetadata({ ...input, tonightMinutes: 20 }, now).tonight);
});
test('Tonight is recorded only from a scored matching-day attempt; review is separate', () => {
  assert.equal(tonightCompletion([attempt()], now).state, 'recorded');
  assert.equal(tonightCompletion([attempt()], now).reviewMinutes, 10);
  for (const invalid of [attempt({ selectionMeta: {} }), attempt({ completedAt: now + 1000 }),
    attempt({ selectionMeta: { scoringVersion: 'device_v1', ...tonightMetadata(input, now) } }),
    attempt({ selectionMeta: { scoringVersion: 'server_practice_v1', ...tonightMetadata(input, now - 86400000) } })]) {
    assert.equal(tonightCompletion([invalid], now).state, 'ready');
  }
});
test('milestones exclude device scoring, blocked content and invalidated delayed checks', () => {
  assert.deepEqual(studyMilestones([{ id: 'legacy', completedAt: now }], [{ state: 'invalidated', sampleSize: 2 }, { state: 'blocked_content', sampleSize: 1 }]), []);
  const marks = studyMilestones([attempt(), attempt({ id: 'older', completedAt: now - 5000 })], [{ state: 'delayed_check_2', sampleSize: 1 }]);
  assert.equal(marks[0].href, '/result/older');
  assert.equal(marks[1].kind, 'first_fresh_check');
});
test('mistake replay uses missed and skipped chapters, excludes all past IDs and families', () => {
  const row = { selectionMeta: { scoringVersion: 'server_snapshot_v1' }, details: [{ qid: '1', isCorrect: false }, { qid: '2', isCorrect: null }, { qid: '3', isCorrect: true }], questionsSnapshot: [{ id: '1', chapter: 'A', familyId: 'f1' }, { id: '2', chapter: 'B', evidence: { record: { family_id: 'f2' } } }, { id: '3', chapter: 'C' }] };
  assert.deepEqual(missedChapters(row), ['A', 'B']);
  assert.deepEqual(missedChapters({ ...row, selectionMeta: {} }), []);
  assert.deepEqual(replayExposures([row]), { excludeQuestionIds: ['1', '2', '3'], excludeFamilyIds: ['f1', 'f2'] });
});
test('offline restore keeps the original session and deadline, with bounded pending upload', () => {
  const saved = { selectionMeta: { sessionId: 's1' }, generationKey: 'key1', questions: [{ id: 'q1' }], endsAt: now + 1000 };
  assert.equal(resumableDraft(saved, { generationKey: 'key1', now }), true);
  assert.equal(resumableDraft(saved, { generationKey: 'other', now }), false);
  assert.equal(resumableDraft(saved, { sessionId: 's2', now }), false);
  assert.equal(resumableDraft(saved, { sessionId: 's1', now }), true);
  assert.equal(resumableDraft({ ...saved, endsAt: now - 1000 }, { generationKey: 'key1', now }), false);
  assert.equal(resumableDraft({ ...saved, pendingSubmission: true, endsAt: now - 1000 }, { generationKey: 'key1', now }), true);
  assert.equal(resumableDraft({ ...saved, pendingSubmission: true, endsAt: now - SUBMISSION_GRACE_MS }, { generationKey: 'key1', now }), false);
});
test('sign out removes only that account’s session drafts', () => {
  const keys = ['mm:test:u1:economics', 'mm:test:u1:english', 'mm:test:u2:english', 'mm:theme:v1'];
  const storage = { get length() { return keys.length; }, key: i => keys[i], removeItem: k => keys.splice(keys.indexOf(k), 1) };
  clearStudyDrafts(storage, 'u1');
  assert.deepEqual(keys, ['mm:test:u2:english', 'mm:theme:v1']);
});
test('cancellation uses cycle-end in the installed SDK and never treats rejection text as success', async () => {
  const calls = [];
  await cancelMonthlyRenewal({ cancel: async (...args) => calls.push(args) }, 'sub_test');
  assert.deepEqual(calls, [['sub_test', true]]);
  const rejected = new Error('Cannot cancel: already under processing');
  for (const status of ['active', 'pending', 'authenticated']) {
    await assert.rejects(cancelMonthlyRenewal({ cancel: async () => { throw rejected; }, fetch: async () => ({ id: 'sub_test', status }) }, 'sub_test'), rejected);
  }
  assert.equal((await cancelMonthlyRenewal({ cancel: async () => { throw rejected; }, fetch: async () => ({ id: 'sub_test', status: 'cancelled' }) }, 'sub_test')).status, 'cancelled');
  await assert.rejects(cancelMonthlyRenewal({ cancel: async () => { throw rejected; }, fetch: async () => ({ id: 'other', status: 'cancelled' }) }, 'sub_test'), rejected);
});
test('service worker intercepts only public assets and navigation, never account APIs or POSTs', () => {
  const listeners = {};
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), { self: { location: { origin: 'http://localhost' }, addEventListener: (type, fn) => { listeners[type] = fn; } }, URL, fetch: () => Promise.resolve({}), caches: { match: () => Promise.resolve({}) } });
  for (const [path, method, mode] of [['/api/attempts', 'POST', 'cors'], ['/api/auth/me', 'GET', 'cors'], ['/today?_rsc=abc', 'GET', 'cors'], ['https://other.test/a', 'GET', 'navigate']]) {
    let intercepted = false;
    listeners.fetch({ request: { url: new URL(path, 'http://localhost').href, method, mode }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, path);
  }
  let intercepted = false;
  listeners.fetch({ request: { url: 'http://localhost/today', method: 'GET', mode: 'navigate' }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, true);
});
