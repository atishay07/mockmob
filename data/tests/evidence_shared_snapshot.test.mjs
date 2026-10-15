import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createEligibilitySnapshotCache, currentRegistry, eligibilitySnapshot, publicationEligibility, sharedEligibilitySnapshot,
} from '../evidence_registry.js';
import { contentHash, evidenceSignature } from '../content_evidence.js';

// Software safety fixtures; these do not establish academic reliability.
const SECRET = 'software-fixture-secret';
const STAGES = ['schema', 'dedupe', 'source_support', 'blind_solution', 'alternatives', 'explanation_support', 'exam_fit'];

function withSigningKey(fn) {
  const saved = { key: process.env.CUET_EVIDENCE_SIGNING_KEY, mock: process.env.MOCK_AI };
  process.env.CUET_EVIDENCE_SIGNING_KEY = SECRET;
  delete process.env.MOCK_AI;
  try { return fn(); } finally {
    if (saved.key === undefined) delete process.env.CUET_EVIDENCE_SIGNING_KEY; else process.env.CUET_EVIDENCE_SIGNING_KEY = saved.key;
    if (saved.mock !== undefined) process.env.MOCK_AI = saved.mock;
  }
}

// Questions bound to the real shipped registry and calibration: one fully eligible legacy record, and
// variants that fail each kind of check (content, signature, status, family, source, route, policy, expiry).
function realFixtures() {
  const registry = currentRegistry();
  const manifest = JSON.parse(readFileSync(new URL('../calibration_manifest.json', import.meta.url), 'utf8'));
  const [familyId, family] = Object.entries(registry.families).find(([, f]) => f.state === 'active');
  const [sourceId, source] = Object.entries(registry.sources).find(([, s]) => s.state === 'active' && s.reuse_permitted && Object.keys(s.supports || {}).length);
  const [locator, supportHash] = Object.entries(source.supports)[0];
  const verifier = manifest.routes.conceptual.verifier_version;
  const build = (over = {}, recordOver = {}) => {
    const q = { id: `fixture-${Object.keys(over).join('-') || 'base'}`, subject: 'english', chapter: 'Vocabulary', body: 'Choose the meaning.', options: ['a', 'b', 'c', 'd'], correct_answer: 'A', explanation: 'Fixture explanation', family_id: familyId, status: 'live', ...over };
    const record = { candidate_id: q.id, content_hash: contentHash(q), family_id: q.family_id, family_version: family.version, state: 'published', route: 'conceptual', verifier_version: verifier, verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3_600_000).toISOString(), sources: [{ id: sourceId, version: source.version, locator, support_hash: supportHash }], solved_key: 'A', checks: {}, ...recordOver };
    for (const stage of STAGES) record.checks[stage] = { passed: true, evidence_hash: 'fixture-check', candidate_id: record.candidate_id, content_hash: record.content_hash };
    return { ...q, evidence: { record, signature: evidenceSignature(record, SECRET) } };
  };
  const eligible = build();
  return [
    eligible,
    { ...eligible, correct_answer: 'B' },
    { ...eligible, evidence: { ...eligible.evidence, signature: 'bad-signature' } },
    { ...eligible, verification_state: 'disputed' },
    { ...eligible, status: 'quarantined' },
    { ...eligible, is_deleted: true },
    build({ family_id: 'no-such-family' }),
    build({}, { sources: [{ id: sourceId, version: Number(source.version) + 1, locator, support_hash: supportHash }] }),
    build({}, { verifier_version: 'some-older-verifier' }),
    build({}, { route: 'numerical' }),
    build({}, { route: 'passage' }),
    build({}, { route: 'unknown' }),
    build({}, { policy_version: 'cuet-llm-v3' }),
    build({}, { expires_at: new Date(Date.now() - 1000).toISOString() }),
    build({}, { mock: true }),
    { ...eligible, evidence: undefined },
    { ...eligible, evidence: { record: eligible.evidence.record } },
  ];
}

test('the shared snapshot gives the same verdict as a fresh read for every fixture', () => withSigningKey(() => {
  const fixtures = realFixtures();
  const shared = sharedEligibilitySnapshot();
  assert.ok(shared, 'the shipped files are readable');
  const verdicts = fixtures.map(q => publicationEligibility(q));
  assert.deepEqual(fixtures.map(q => publicationEligibility(q, shared)), verdicts, 'shared snapshot equals a fresh read per call');
  assert.deepEqual(fixtures.map(q => publicationEligibility(q, eligibilitySnapshot())), verdicts, 'and equals the 13 Oct per-pass snapshot');
  // The comparison is not trivial: the fixture set has an eligible question and several distinct refusals.
  assert.equal(verdicts[0].eligible, true, JSON.stringify(verdicts[0]));
  const reasons = new Set(verdicts.flatMap(v => v.reasons));
  for (const reason of ['content_changed', 'untrusted_evidence', 'publication_disabled', 'family_not_active', 'source_not_verified', 'route_calibration_required', 'stale_verification', 'missing_trusted_evidence']) {
    assert.ok(reasons.has(reason), `fixtures cover ${reason}`);
  }
}));

test('the shared snapshot is parsed once per server instance and cannot be changed by a caller', () => {
  const first = sharedEligibilitySnapshot();
  assert.equal(sharedEligibilitySnapshot(), first, 'the same parsed object is reused');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.registry.sources), true);
  assert.equal(Object.isFrozen(first.manifest.routes.conceptual), true);
  assert.throws(() => { first.registry.version = 'changed'; }, TypeError);
  assert.throws(() => { Object.values(first.registry.sources)[0].state = 'inactive'; }, TypeError);
  assert.deepEqual(JSON.parse(JSON.stringify(first.registry)), currentRegistry(), 'contents equal a fresh read');
});

test('a changed file is read again, and a failed read is never remembered', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mm-evidence-cache-'));
  try {
    const manifest = join(dir, 'calibration_manifest.json');
    const registry = join(dir, 'source_registry.json');
    const shared = createEligibilitySnapshotCache({ manifest, registry });
    assert.equal(shared(), undefined, 'missing files: undefined, so each check reads and fails closed');
    writeFileSync(manifest, JSON.stringify({ state: 'released', routes: {} }));
    writeFileSync(registry, JSON.stringify({ version: 1, sources: {} }));
    const a = shared();
    assert.deepEqual(a, { manifest: { state: 'released', routes: {} }, registry: { version: 1, sources: {} } }, 'the earlier failure was not cached');
    assert.equal(shared(), a, 'unchanged files are not parsed again');
    writeFileSync(registry, JSON.stringify({ version: 22, sources: { ref: { state: 'inactive' } } }));
    const b = shared();
    assert.notEqual(b, a);
    assert.equal(b.registry.version, 22, 'a revoked source is seen at once');
    writeFileSync(manifest, '{ not json');
    assert.equal(shared(), undefined, 'an unreadable file fails closed instead of serving the old copy');
    writeFileSync(manifest, JSON.stringify({ state: 'withdrawn' }));
    assert.equal(shared().manifest.state, 'withdrawn');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the five per-question request paths pass the shared snapshot on every check', () => {
  const sites = [
    'src/services/recovery/answerReviews.js',
    'src/services/recovery/mistakeRepair.js',
    'src/lib/server/learning.js',
    'src/app/api/sessions/[id]/check/route.js',
    'data/db.js',
  ];
  for (const rel of sites) {
    const src = readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
    assert.match(src, /import \{[^}]*\bsharedEligibilitySnapshot\b[^}]*\} from '[^']*evidence_registry'/, `${rel} imports the shared snapshot`);
    const calls = [...src.matchAll(/publicationEligibility\(([^()]*(?:\([^()]*\))?[^()]*)\)/g)].map(m => m[1]);
    assert.ok(calls.length >= 1, `${rel} checks evidence`);
    for (const args of calls) assert.match(args, /,\s*(sharedEligibilitySnapshot\(\)|evidenceInputs)\s*$/, `${rel}: publicationEligibility(${args}) passes the shared snapshot`);
  }
  const learning = readFileSync(new URL('../../src/lib/server/learning.js', import.meta.url), 'utf8');
  assert.match(learning, /const registry = evidenceInputs\?\.registry \?\? currentRegistry\(\);/, 'pathway checks reuse the same parsed registry');
});
