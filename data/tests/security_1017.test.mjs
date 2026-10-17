// Security round 2 from the 17 Oct 2026 database review (branch fix/security-2-1017d).
//  (a) GET /api/questions/explore returns only public fields (no key, no explanation, no contributor ids or internals),
//  (b) POST /api/questions/upload is no answer oracle for live questions,
//  (c) create_pending_payout is serialised per creator,
//  (d) POST /api/ai/mentor/local never stores client text as an assistant turn,
//  (e) account deletion scrubs runtime_ai_requests (request key and reply content), not only user_id,
//  (f) Database.voteQuestion refuses votes on questions that are not live,
//  (g) default privileges in public grant nothing to PUBLIC, anon or authenticated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exploreRowOut, publicExploreOptions } from '../explore_feed.js';
import { computeContentHash } from '../../src/lib/moderation/hash.js';
import {
  UPLOAD_ANSWER_KEYS, candidateContentHashes, uploadAccepted, uploadShapeViolation, UPLOAD_ACCEPTED_STATUS,
} from '../../src/lib/moderation/uploadDedupe.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

// ------------------------------------------------------------------ (a) explore public shape

const PRIVATE_QUESTION = {
  id: 'q1', subject: 'accountancy', chapter: 'Partnership', difficulty: 'medium',
  question: 'What is goodwill?', body: 'old body', passage_text: null, passage_id: 'p9', order_index: 2,
  options: [{ key: 'A', text: 'One', is_correct: true, rationale: 'because' }, { key: 'B', text: 'Two' }],
  correct_answer: 'A', explanation: 'Because A.', recommended_difficulty: 'hard',
  author_id: 'user-author', uploaded_by: 'user-uploader', provenance: { kind: 'factory' }, evidence: { record: { state: 'verified' } },
  legacy_screening: { x: 1 }, content_hash: 'abc', family_id: 'fam', template_id: 'tpl', exposure_budget: 9, exposure_used: 3,
  quality_score: 0.9, ai_score: 88, ai_tier: 'A', status: 'live', is_deleted: false, tags: ['t1'], upvotes: 3, downvotes: 1, score: 2,
};
const PRIVATE_ROW = {
  question_id: 'q1', rank_score: 0.75, exploration_lane: 'standard', momentum_score: 1, quality_score: 2, attempts_qualified: 5,
  exposures_total: 50, save_rate: 0.1, like_rate: 0.2, skip_rate: 0.3, report_rate: 0.4, questions: PRIVATE_QUESTION,
};

test('explore row leaves the server without the key, the explanation, contributor ids or internals', () => {
  const out = exploreRowOut(PRIVATE_ROW, 'up');
  const text = JSON.stringify(out);
  for (const banned of ['correct_answer', 'explanation', 'recommended_difficulty', 'author_id', 'uploaded_by', 'provenance', 'evidence',
    'legacy_screening', 'content_hash', 'family_id', 'template_id', 'exposure', 'quality_score', 'ai_score', 'ai_tier', 'report_rate',
    'skip_rate', 'save_rate', 'like_rate', 'momentum_score', 'attempts_qualified', 'is_correct', 'rationale', 'user-author', 'user-uploader', 'Because A.']) {
    assert.ok(!text.includes(banned), `${banned} must not appear in the explore response`);
  }
  assert.deepEqual(out, {
    question_id: 'q1', rank_score: 0.75, exploration_lane: 'standard',
    questions: {
      id: 'q1', subject: 'accountancy', chapter: 'Partnership', difficulty: 'medium', body: 'What is goodwill?',
      options: [{ key: 'A', text: 'One' }, { key: 'B', text: 'Two' }], passage_text: null, passage_group_id: 'p9', order_index: 2,
      tags: ['t1'], upvotes: 3, downvotes: 1, score: 2, userVote: 'up',
    },
  });
});

test('explore options keep only key and text, for array, string and object option shapes', () => {
  assert.deepEqual(publicExploreOptions(['x', 'y']), [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }]);
  assert.deepEqual(publicExploreOptions({ A: 'x', B: 'y' }), [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }]);
  assert.deepEqual(publicExploreOptions([{ key: 'A', label: 'x', correct: true }]), [{ key: 'A', text: 'x' }]);
  assert.deepEqual(exploreRowOut({ question_id: 'q2', questions: null }).questions.options, []);
});

test('explore route maps every row through exploreRowOut and no longer returns raw rows', () => {
  const src = read('src/app/api/questions/explore/route.js');
  assert.match(src, /merged\.map\(\(row\) => exploreRowOut\(row, voteMap\.get\(row\.question_id\)\)\)/);
  assert.doesNotMatch(src, /questions:\s*merged\s*[,}]/, 'raw merged rows are never returned');
  assert.doesNotMatch(src, /FIX 10/, 'the false strip comment is gone');
  assert.match(src, /checkRateLimit\(request/, 'the anonymous route is rate limited like the feed');
});

// ------------------------------------------------------------------ (b) upload answer oracle

const OPTIONS = (keys) => keys.map((key) => ({ key, text: `option ${key}` }));

// The route's decision, reduced to what the database answers: dedupe hit -> silent accept, else insert.
function uploadOutcome(liveHashes, body, options, answer) {
  const violation = uploadShapeViolation(options, answer);
  if (violation) return { status: 422, rule: violation.rule };
  const hit = candidateContentHashes(body).some((hash) => liveHashes.has(hash));
  return { status: UPLOAD_ACCEPTED_STATUS, body: uploadAccepted([]), stored: !hit };
}

test('a live question body gives the same outcome for every guessed answer key (no oracle)', () => {
  const body = 'A firm earns 10% on capital. Find the interest on Rs 5,000.';
  for (const liveKey of ['A', 'B', 'C', 'D', 'E']) {
    const live = new Set([computeContentHash(body, liveKey)]);
    const outcomes = ['A', 'B', 'C', 'D'].map((guess) => uploadOutcome(live, body, OPTIONS(['A', 'B', 'C', 'D']), guess));
    for (const outcome of outcomes) assert.deepEqual(outcome, outcomes[0], `live key ${liveKey}: every guess looks the same`);
    assert.equal(outcomes[0].stored, false, 'the existing body is deduped whichever key is marked');
    // Shrinking or reshaping the option set cannot exclude the live key from the lookup either.
    assert.deepEqual(uploadOutcome(live, body, OPTIONS(['E', 'F']), 'E'), outcomes[0]);
    assert.deepEqual(uploadOutcome(live, body, OPTIONS(['a', 'b']), 'b'), outcomes[0], 'lower-case keys hash the same');
  }
  // A body that is not in the bank is stored whichever key is marked, with the same reply.
  const fresh = ['A', 'B', 'C', 'D'].map((guess) => uploadOutcome(new Set(), 'A new question', OPTIONS(['A', 'B', 'C', 'D']), guess));
  for (const outcome of fresh) assert.deepEqual(outcome, { status: 202, body: { status: 'pending_moderation', rule_violations: [] }, stored: true });
  const { stored: _a, ...dupReply } = uploadOutcome(new Set([computeContentHash('X', 'B')]), 'X', OPTIONS(['A', 'B']), 'A');
  const { stored: _b, ...newReply } = fresh[0];
  assert.deepEqual(dupReply, newReply, 'the reply for a duplicate equals the reply for a new question');
});

test('candidate hashes cover every allowed key, so the submitted pair is always one of them', () => {
  const hashes = new Set(candidateContentHashes('Body'));
  for (const key of UPLOAD_ANSWER_KEYS) assert.ok(hashes.has(computeContentHash('Body', key)));
  assert.ok(hashes.has(computeContentHash('Body', 'c')));
});

test('option keys outside the fixed set, repeated keys and answers outside the options are refused', () => {
  assert.equal(uploadShapeViolation(null, 'A')?.rule, 'invalid_options_count', 'options are required');
  assert.equal(uploadShapeViolation(OPTIONS(['A']), 'A')?.rule, 'invalid_options_count');
  assert.equal(uploadShapeViolation(OPTIONS(['Paris', 'Rome']), 'Paris')?.rule, 'invalid_option_keys', 'free-text keys would bring back a set-membership oracle');
  assert.equal(uploadShapeViolation(OPTIONS(['A', 'a']), 'A')?.rule, 'invalid_option_keys', 'keys that hash the same are repeats');
  assert.equal(uploadShapeViolation(OPTIONS(['A', 'B']), 'C')?.rule, 'answer_not_in_options');
  assert.equal(uploadShapeViolation(OPTIONS(['A', 'B', 'C', 'D']), 'D'), null);
  assert.equal(uploadShapeViolation(OPTIONS(['1', '2']), '2'), null);
  assert.deepEqual(uploadAccepted([{ severity: 'soft', rule: 's' }, { severity: 'hard', rule: 'h' }]).rule_violations, [{ severity: 'soft', rule: 's' }]);
});

test('upload route: no 409, no duplicate_of, no error details; candidate lookup, silent 23505 and a per-student limit', () => {
  const src = read('src/app/api/questions/upload/route.js');
  assert.doesNotMatch(src, /status:\s*409/);
  assert.doesNotMatch(src, /duplicate_of|identical question/i);
  assert.doesNotMatch(src, /detail:|err\.stack|job_error|warning:/);
  assert.doesNotMatch(src.slice(src.indexOf('return accepted()')), /Response\.json\(\s*\{\s*question_id/, 'no question id in the reply');
  assert.match(src, /\.in\('content_hash', candidateContentHashes\(/);
  assert.match(src, /questionError\.code === '23505'\) return accepted\(\)/);
  assert.match(src, /if \(existingHash\) return accepted\(\)/);
  assert.match(src, /checkPersistentRateLimit\(request, \{ \.\.\.window, keyParts: \[author_id\]/);
  assert.match(src, /uploadShapeViolation\(options, correct_answer\)/);
  assert.doesNotMatch(src, /console\.log\([^)]*correct_answer/, 'the submitted answer is not logged');
});
