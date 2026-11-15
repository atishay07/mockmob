// "Resume your paper" (src/lib/paper/resume.mjs): which drafts come back, in what order, with what words (B2b).
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePapers, resumeCopy, timeLeftWords } from './resume.mjs';
import { KEEP_AFTER_END_MS, SUBMISSION_GRACE_MS, sentMark } from './draft.mjs';

const now = Date.parse('2026-11-15T10:00:00Z');
const href = (key) => `/test?subject=accountancy&count=10&mode=quick&generationKey=${key}&startReceipt=r.1`;
const draft = (key, over = {}) => ({
  selectionMeta: { sessionId: `s-${key}` }, generationKey: key, questions: Array.from({ length: 10 }, (_, i) => ({ id: `q${i}` })),
  answers: { q0: 1, q1: 0, q2: 3 }, endsAt: now + 12 * 60000 + 30000,
  paper: { href: href(key), subject: 'Accountancy', mode: 'Quick practice' }, ...over,
});
const entry = (key, value, user = 'u1') => [`mm:test:${user}:paper:g.${key}`, JSON.stringify(value)];

test('a live paper gives the row its set, answered of total, time left and the full address with its key and receipt', () => {
  const [paper] = livePapers([entry('gen-key-000001', draft('gen-key-000001'))], 'u1', now);
  assert.deepEqual(paper, {
    key: 'mm:test:u1:paper:g.gen-key-000001', href: href('gen-key-000001'), subject: 'Accountancy', mode: 'Quick practice',
    answered: 3, total: 10, endsAt: now + 750000, state: 'running', msLeft: 750000,
  });
  assert.deepEqual(resumeCopy(paper), {
    title: 'Accountancy, Quick practice', line: '3 of 10 answered, 12 min left', key: 'Resume',
    label: 'Resume Accountancy, Quick practice. 3 of 10 answered, 12 min left.',
  });
});

test('inside the upload grace the row offers to send the answers; past it the row is gone', () => {
  const grace = draft('gen-key-000002', { endsAt: now - 30000 });
  const [paper] = livePapers([entry('gen-key-000002', grace)], 'u1', now);
  assert.equal(paper.state, 'sending');
  assert.equal(resumeCopy(paper).key, 'Send');
  assert.equal(resumeCopy(paper).line, '3 of 10 answered. Time is up: open it to send your answers.');
  assert.deepEqual(livePapers([entry('gen-key-000002', grace)], 'u1', now + SUBMISSION_GRACE_MS), []);
  assert.deepEqual(livePapers([entry('gen-key-000003', draft('gen-key-000003', { endsAt: now - KEEP_AFTER_END_MS + 1000 }))], 'u1', now), [], 'a late paper is kept, never offered');
});

test('only this user\'s papers, never a sent one, a broken one, an old-format one or one without the runner\'s own address', () => {
  const entries = [
    entry('gen-key-000004', draft('gen-key-000004'), 'u2'),
    entry('gen-key-000005', sentMark({ attemptId: 'a', endsAt: now + 1000, now })),
    ['mm:test:u1:paper:g.gen-key-000006', '{oops'],
    ['mm:test:u1:accountancy:*:10:auto:quick', JSON.stringify(draft('gen-key-000007'))],
    entry('gen-key-000008', draft('gen-key-000008', { paper: { href: 'https://evil.test/test?x', subject: 'A', mode: 'B' } })),
    entry('gen-key-000009', draft('gen-key-000009', { paper: { href: '/test?x" onmouseover="y', subject: 'A', mode: 'B' } })),
    entry('gen-key-000010', draft('gen-key-000010', { paper: undefined })),
    [`mm:test:u1:paper:g.gen-key-000011:integrity:s`, '1'],
  ];
  assert.deepEqual(livePapers(entries, 'u1', now), []);
});

test('two papers left behind: the one that ends first comes first', () => {
  const later = draft('gen-key-000012', { endsAt: now + 40 * 60000 });
  const sooner = draft('gen-key-000013', { endsAt: now + 5 * 60000 });
  assert.deepEqual(livePapers([entry('gen-key-000012', later), entry('gen-key-000013', sooner)], 'u1', now).map((p) => p.key.slice(-14)), ['gen-key-000013', 'gen-key-000012']);
});

test('time left reads as the timer does: whole minutes, never rounded up', () => {
  assert.equal(timeLeftWords(59999), 'Under 1 min left');
  assert.equal(timeLeftWords(60000), '1 min left');
  assert.equal(timeLeftWords(12 * 60000 + 59000), '12 min left');
  assert.equal(timeLeftWords(0), 'Under 1 min left');
  assert.equal(resumeCopy({ subject: '', mode: '', answered: 0, total: 5, state: 'running', msLeft: 30000 }).line, '0 of 5 answered, under 1 min left');
});
