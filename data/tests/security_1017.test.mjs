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
