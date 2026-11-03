import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { expectedReleaseBindingV713 } from '../lib/releaseEvidenceV713.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const assembled = resolve(root, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/qualification-fresh31-regression6');
const collector = resolve(root, 'scripts/pipeline/tools/collectMixedQualificationV713R3.mjs');
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');

function isolatedStudy(t) {
  const directory = mkdtempSync(join(tmpdir(), 'v713-r3-collector-'));
  t.after(() => {
    const target = resolve(directory), tempRoot = resolve(tmpdir());
    assert.ok(target.startsWith(tempRoot + sep), 'cleanup must remain inside the OS temp directory');
    rmSync(target, { recursive: true, force: true });
  });
  for (const name of ['frozen.json', 'registry.json', 'release-fresh-envelope.json', 'release-regression-envelope.json'])
    copyFileSync(resolve(assembled, name), resolve(directory, name));
  const frozenPath = resolve(directory, 'frozen.json'), registryPath = resolve(directory, 'registry.json');
  const frozen = JSON.parse(readFileSync(frozenPath, 'utf8'));
  writeFileSync(resolve(directory, 'registration.json'), JSON.stringify({
    id: frozen.id, denominator: frozen.denominator, cap_usd: 1,
    frozen_sha256: sha256(frozenPath), registry_sha256: sha256(registryPath),
  }));
  writeFileSync(resolve(directory, 'state.json'), JSON.stringify({ cases: {}, request_keys: [] }));
  return { directory, frozen };
}

function collect(directory) {
  const run = spawnSync(process.execPath, [collector, directory], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.equal(run.error, undefined, run.error?.message);
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const summary = JSON.parse(run.stdout);
  const report = JSON.parse(readFileSync(summary.exported, 'utf8'));
  return { summary, report };
}

test('actual collector keeps the assembled registered 37-case study paused when state is empty', t => {
  const { directory } = isolatedStudy(t);
  const { summary, report } = collect(directory);

  assert.equal(report.denominator, 37);
  assert.equal(report.roles.fresh, 31);
  assert.equal(report.roles.regression, 6);
  assert.equal(report.cases.length, 37);
  assert.equal(report.assessment.state, 'paused');
  assert.ok(report.assessment.problems.includes('joint_study_unfinished'));
  assert.ok(report.assessment.problems.includes('fresh_partition_valid_survival_below_85_percent'));
  assert.equal(report.release_candidate.state, 'paused');
  assert.equal(report.publication, 'never');
  assert.equal(report.release_manifest_written, false);
  assert.match(summary.state, /paused/);
  assert.equal(readdirSync(directory).some(name => name === 'calibration_manifest.json'), false);
});

test('actual collector enforces the fresh-only survival minimum even when joint survival is 85%', t => {
  const { directory, frozen } = isolatedStudy(t);
  const binding = expectedReleaseBindingV713();
  const lostBySubject = new Map();
  for (const fixture of frozen.fixtures.filter(f => f.measurement_role === 'fresh' && f.expected_valid))
    if (lostBySubject.size < 3 && !lostBySubject.has(fixture.subject)) lostBySubject.set(fixture.subject, fixture.id);
  assert.equal(lostBySubject.size, 3);
  const lostIds = new Set(lostBySubject.values());
  const cases = {};
  for (const fixture of frozen.fixtures) {
    const eligible = fixture.expected_valid && !lostIds.has(fixture.id);
    const judgments = Object.fromEntries(['openai', 'gemini'].map(provider => [provider, {
      candidate_id: fixture.id,
      content_hash: fixture.content_hash,
      provider,
      evaluation_prompt: binding.prompt_hash,
      validation_contract_hash: binding.validation_contract_hash,
      prompt_version: binding.verifier_version,
      state: 'ok',
    }]));
    cases[fixture.id] = { state: eligible ? 'eligible' : 'quarantined', reasons: [], independent_judgments: judgments };
  }
  writeFileSync(resolve(directory, 'state.json'), JSON.stringify({ cases, request_keys: [] }));

  const { report } = collect(directory);
  assert.equal(report.assessment.metrics.valid_items, 20);
  assert.equal(report.assessment.metrics.valid_survival, 0.85);
  assert.ok(report.assessment.problems.includes('fresh_partition_valid_survival_below_85_percent'));
  assert.equal(report.assessment.state, 'paused');
  assert.equal(report.release_candidate.state, 'paused');
});
