import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTE_STATUS, buildRouteScorecard } from '../tools/routeQualityScorecard.mjs';

test('standalone route PASS classification works', () => {
  const card = buildRouteScorecard({
    subject: 'physics',
    chapter: 'Electromagnetic Induction',
    route_type: 'standalone',
    quality_mode: 'balanced',
    generated_count: 12,
    selfcheck_passed: 8,
    validator_sent: 8,
    validator_accepted: 4,
    published_count: 4,
    avg_validator_score: 8,
    cost_total: 0.01,
  });
  assert.equal(card.route_status, ROUTE_STATUS.PASS);
});

test('route with one usable publish is degraded, not hidden as pass', () => {
  const card = buildRouteScorecard({
    subject: 'economics',
    chapter: 'Money & Banking',
    route_type: 'standalone',
    generated_count: 10,
    validator_sent: 5,
    validator_accepted: 1,
    published_count: 1,
    avg_validator_score: 7.5,
  });
  assert.equal(card.route_status, ROUTE_STATUS.DEGRADED_BUT_USABLE);
});

test('zero publish route fails', () => {
  const card = buildRouteScorecard({
    subject: 'biology',
    chapter: 'Molecular Basis of Inheritance',
    route_type: 'standalone',
    generated_count: 10,
    published_count: 0,
  });
  assert.equal(card.route_status, ROUTE_STATUS.FAIL);
});

test('passage route passes with partial group and refill allowed', () => {
  const card = buildRouteScorecard({
    subject: 'english',
    chapter: 'Factual Passage',
    route_type: 'passage',
    quality_mode: 'balanced',
    generated_count: 4,
    passage_groups_published: 1,
    passage_children_published: 2,
    published_count: 2,
    avg_passage_score: 8.8,
    needs_refill: true,
    cost_total: 0.01,
  });
  assert.equal(card.route_status, ROUTE_STATUS.PASS);
});
