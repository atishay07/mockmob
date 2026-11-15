// The device draft's rules (src/lib/paper/draft.mjs): keys, fates, the one-tab claim, what a submit carries, the sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KEEP_AFTER_END_MS, SUBMISSION_GRACE_MS, answeredCount, claimedElsewhere, draftFate, draftsToSweep, isPaperDraftKey, lateDraft,
  legacyDraftKey, newestProgress, paperDraftKey, sentMark, sentMarkMatches, storedDrafts,
} from './draft.mjs';

const now = Date.parse('2026-11-15T10:00:00Z');
const draft = (over = {}) => ({ selectionMeta: { sessionId: 's1' }, generationKey: 'gen-key-000001', questions: [{ id: 'q1' }, { id: 'q2' }], answers: { q1: 2 }, endsAt: now + 60000, events: [], ...over });

test('one key per paper: two starts of the same set never share a draft (B2c)', () => {
  const a = paperDraftKey('u1', { generationKey: 'gen-key-000001' });
  const b = paperDraftKey('u1', { generationKey: 'gen-key-000002' });
  assert.notEqual(a, b);
  assert.equal(a, 'mm:test:u1:paper:g.gen-key-000001');
  assert.equal(paperDraftKey('u1', { sessionId: 'abc', generationKey: 'gen-key-000001' }), 'mm:test:u1:paper:s.abc', 'a resume link names its session');
  assert.equal(paperDraftKey('u1', {}), null);
  assert.equal(legacyDraftKey('u1', { subject: 'accountancy', count: 10 }), 'mm:test:u1:accountancy:*:10:auto:quick');
  assert.ok(isPaperDraftKey(a, 'u1'));
  assert.equal(isPaperDraftKey(`${a}:integrity:s1`, 'u1'), false);
  assert.equal(isPaperDraftKey(a, 'u2'), false);
});

test('a draft is live before the deadline, sendable through the grace, kept 7 days when its answers never left (B8: still sendable), then dead', () => {
  assert.equal(KEEP_AFTER_END_MS, 7 * 24 * 60 * 60 * 1000, 'the server takes a late paper for 7 days (data/late_paper.js)');
  assert.equal(draftFate(draft({ endsAt: now - 6 * 24 * 60 * 60 * 1000 }), now), 'late', 'six days later it is still kept');
  assert.equal(draftFate(draft(), now), 'live');
  assert.equal(draftFate(draft({ endsAt: now - 1000 }), now), 'grace');
  assert.equal(draftFate(draft({ endsAt: now - SUBMISSION_GRACE_MS + 1 }), now), 'grace');
  assert.equal(draftFate(draft({ endsAt: now - SUBMISSION_GRACE_MS }), now), 'late', 'from the end of the grace the server takes it as a late paper');
  assert.equal(draftFate(draft({ endsAt: now - SUBMISSION_GRACE_MS, answers: {} }), now), 'dead', 'nothing answered: nothing to keep');
  assert.equal(draftFate(draft({ endsAt: now - KEEP_AFTER_END_MS }), now), 'dead');
  assert.equal(draftFate(sentMark({ attemptId: 'a1', endsAt: now - 1000, now }), now), 'sent');
  assert.equal(draftFate(sentMark({ attemptId: 'a1', endsAt: now - KEEP_AFTER_END_MS, now }), now), 'dead');
  assert.equal(draftFate(null, now), 'dead');
  assert.equal(draftFate({ endsAt: now + 1000, questions: [] }, now), 'dead');
  assert.ok(lateDraft(draft({ endsAt: now - SUBMISSION_GRACE_MS - 1 }), { generationKey: 'gen-key-000001' }, now));
  assert.equal(lateDraft(draft({ endsAt: now - SUBMISSION_GRACE_MS - 1 }), { generationKey: 'other-key-0001' }, now), false);
  assert.equal(answeredCount({ q1: 0, q2: null, q3: undefined, q4: 3 }), 2, 'option 0 is an answer');
});

test('the sent mark belongs to its own paper only', () => {
  const mark = sentMark({ attemptId: 'att-1', endsAt: now, generationKey: 'gen-key-000001', now });
  assert.ok(sentMarkMatches(mark, { generationKey: 'gen-key-000001' }));
  assert.equal(sentMarkMatches(mark, { generationKey: 'gen-key-000002' }), false);
  assert.equal(sentMarkMatches(mark, {}), false);
  assert.ok(sentMarkMatches(sentMark({ attemptId: 'att-1', endsAt: now, sessionId: 's9', now }), { sessionId: 's9' }));
});

test('one tab per paper: the newest claim wins, and a sent paper stops every other tab (B12)', () => {
  const mine = { tab: 'A', at: now };
  assert.equal(claimedElsewhere(null, mine), false);
  assert.equal(claimedElsewhere(draft({ owner: 'A', claimedAt: now }), mine), false);
  assert.equal(claimedElsewhere(draft({ owner: 'B', claimedAt: now + 5 }), mine), true, 'a newer tab took it');
  assert.equal(claimedElsewhere(draft({ owner: 'B', claimedAt: now - 5 }), mine), false, 'an older tab never takes it back by writing');
  assert.equal(claimedElsewhere(draft(), mine), false, 'a draft from before claims existed');
  assert.equal(claimedElsewhere(sentMark({ attemptId: 'x', endsAt: now, now }), mine), true);
});

test('a submit carries the newest progress on this device, never fewer answers than the stored draft', () => {
  const ev = (seq, type = 'answer', extra = {}) => ({ seq, qid: 'q1', type, at: seq * 1000, ...extra });
  const memory = { sessionId: 's1', answers: { q1: 1 }, events: [ev(1, 'visit'), ev(2), ev(3, 'end', { reason: 'time_up' })] };
  // The stored draft is the same record: this tab's own.
  assert.equal(newestProgress(memory, draft({ answers: { q1: 1 }, events: [ev(1, 'visit'), ev(2)] })).from, 'memory');
  // Another tab of the same paper answered further: its answers go, with this tab's end after them.
  const further = draft({ answers: { q1: 1, q2: 3 }, events: [ev(1, 'visit'), ev(2), ev(3), ev(4)] });
  const sent = newestProgress(memory, further);
  assert.equal(sent.from, 'stored');
  assert.deepEqual(sent.answers, { q1: 1, q2: 3 });
  assert.deepEqual(sent.events.map((e) => e.seq), [1, 2, 3, 4, 5]);
  assert.equal(sent.events.at(-1).type, 'end');
  // Another paper's draft, a sent mark or nothing: this tab's own.
  assert.equal(newestProgress(memory, draft({ selectionMeta: { sessionId: 'other' }, events: [ev(9)] })).from, 'memory');
  assert.equal(newestProgress(memory, sentMark({ attemptId: 'a', endsAt: now, now })).from, 'memory');
  assert.equal(newestProgress(memory, null).from, 'memory');
});

test('the sweep removes only dead drafts, unreadable paper values and orphaned warning counts', () => {
  const k = (id) => `mm:test:u1:paper:g.${id}`;
  const entries = [
    [k('live-0000001'), JSON.stringify(draft())],
    [k('late-0000001'), JSON.stringify(draft({ endsAt: now - SUBMISSION_GRACE_MS - 1 }))],
    [k('dead-0000001'), JSON.stringify(draft({ endsAt: now - KEEP_AFTER_END_MS - 1 }))],
    [k('empty-000001'), JSON.stringify(draft({ endsAt: now - SUBMISSION_GRACE_MS - 1, answers: {} }))],
    [k('broken-00001'), '{not json'],
    [`${k('live-0000001')}:integrity:s1`, '1'],
    [`${k('gone-0000001')}:integrity:s2`, '2'],
    ['mm:test:u1:accountancy:*:10:auto:quick', JSON.stringify(draft({ endsAt: now - KEEP_AFTER_END_MS - 1 }))],
    ['mm:test:u1:accountancy:*:5:auto:quick', JSON.stringify(draft())],
    ['mm:test:u1:something-else', JSON.stringify({ x: 1 })],
    ['mm:test:u2:paper:g.dead-0000001', JSON.stringify(draft({ endsAt: now - KEEP_AFTER_END_MS - 1 }))],
    ['mm:theme:v1', 'night'],
  ];
  assert.deepEqual(draftsToSweep(entries, 'u1', now).sort(), [
    k('broken-00001'), k('dead-0000001'), k('empty-000001'), `${k('gone-0000001')}:integrity:s2`, 'mm:test:u1:accountancy:*:10:auto:quick',
  ].sort());
  // The paper being opened is never swept, nor its warning count.
  assert.equal(draftsToSweep([[k('dead-0000001'), JSON.stringify(draft({ endsAt: 1 }))], [`${k('dead-0000001')}:integrity`, '1']], 'u1', now, { keep: k('dead-0000001') }).length, 0);
});

test('storedDrafts reads one user\'s values and survives a blocked storage', () => {
  const map = new Map([['mm:test:u1:paper:g.a', '1'], ['mm:test:u2:paper:g.b', '2'], ['other', '3']]);
  const storage = { get length() { return map.size; }, key: (i) => [...map.keys()][i], getItem: (key) => map.get(key) };
  assert.deepEqual(storedDrafts(storage, 'u1'), [['mm:test:u1:paper:g.a', '1']]);
  assert.deepEqual(storedDrafts({ get length() { throw new Error('SecurityError'); } }, 'u1'), []);
});
