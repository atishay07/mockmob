import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditPathsForRoute } from '../tools/routeQualityScorecard.mjs';
import { dumpRouteArtifacts } from '../tools/auditTopRoutes.mjs';

test('writes raw/normalized/validator/publish dumps', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mockmob-audit-dump-'));
  const paths = auditPathsForRoute(dir, 'english', 'Factual Passage');
  dumpRouteArtifacts(paths, {
    route_config: { subject: 'english', chapter: 'Factual Passage' },
    raw_generation: [{ q: 'raw' }],
    normalized_candidates: [{ q: 'normalized' }],
    passage_groups: [{ passage_id: 'p1' }],
    selfcheck_results: [{ pass: true }],
    validator_results: [{ verdict: 'accept' }],
    publish_results: { published_count: 1 },
    published_samples: [{ q: 'published' }],
    rejected_samples: [],
    route_scorecard: { route_status: 'PASS' },
    route_failure: { primary_reason: null },
  }, true);
  for (const file of [
    'route_config.json',
    'raw_generation.json',
    'normalized_candidates.json',
    'selfcheck_results.json',
    'validator_results.json',
    'publish_results.json',
    'published_samples.json',
    'rejected_samples.json',
    'route_scorecard.json',
    'passage_group.json',
    'passage_quality.json',
    'passage_children.json',
    'refill_jobs.json',
  ]) {
    assert.equal(existsSync(join(paths.sampleDir, file)), true, file);
  }
  assert.equal(JSON.parse(readFileSync(paths.failurePath, 'utf8')).primary_reason, null);
});
