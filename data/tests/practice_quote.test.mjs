import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPracticeQuote, allowanceKindFor } from '../practice_quote.js';
import { resolveSubject, partitionStoredSubjects, SUBJECT_REGISTRY_SOURCE } from '../subject_registry.js';
import { MODE_CAPABILITIES } from '../capabilities.js';
import { learningPlan, practiceForMinutes } from '../learning_engine.js';

const inventory = { state: 'available', checkedAt: '2026-10-02T00:00:00Z', subjectCounts: { accountancy: 600, economics: 8, gat: 200 } };
const free = (creditBalance = 40) => ({ id: 'u1', isPremium: false, premiumUntil: null, creditBalance });
const pro = { id: 'u2', isPremium: true, premiumUntil: '2027-07-31T18:29:59.000Z', creditBalance: 0 };
const quote = (over = {}) => buildPracticeQuote({ user: free(), subject: 'accountancy', mode: 'quick', count: 10, inventory, token: 'tok-123456789012', now: 0, ...over });

test('launch subjects carry official NTA 2026 codes with a cited source', () => {
  assert.deepEqual(['english', 'accountancy', 'business_studies', 'economics'].map((s) => resolveSubject(s).code), ['101', '301', '305', '309']);
  assert.equal(resolveSubject('gat').code, '501');
  assert.equal(resolveSubject('gat').renamedFrom, 'gat');
  assert.match(SUBJECT_REGISTRY_SOURCE.url, /^https:\/\/cuet\.nta\.nic\.in\//);
});

test('stored unsupported, retired and unknown subjects never launch but are kept', () => {
  const { supported, unavailable } = partitionStoredSubjects(['economics', 'hindi', 'teaching_aptitude', 'made_up', 'economics']);
  assert.deepEqual(supported.map((s) => s.id), ['economics']);
  assert.deepEqual(unavailable.map((s) => s.practice), ['not_offered', 'retired', 'unknown']);
  for (const subject of ['hindi', 'teaching_aptitude', 'made_up']) {
    const q = quote({ subject });
    assert.equal(q.launchable, false);
    assert.equal(q.idempotencyToken, null);
    assert.match(q.reasonCode, /^subject_/);
    assert.ok(q.reason.length > 20, 'gives an actionable reason');
  }
});

test('available ordinary quote states cost, duration, inventory policy and a token', () => {
  const q = quote();
  assert.equal(q.state, 'available');
  assert.equal(q.launchable, true);
  assert.equal(q.creditCost, 10);
  assert.equal(q.durationSec, 600);
  assert.equal(q.inventory.policy, 'ordinary');
  assert.equal(q.inventory.state, 'sufficient_count');
  assert.equal(q.idempotencyToken, 'tok-123456789012');
  assert.ok(Date.parse(q.expiresAt) > Date.parse(q.quotedAt), 'quote can go stale');
  assert.match(q.reason, /only after a complete set/);
});

test('premium-only modes are blocked for free users with an access reason, not a guessed price', () => {
  for (const mode of ['smart', 'nta']) {
    const q = quote({ mode });
    assert.equal(q.state, 'blocked');
    assert.equal(q.reasonCode, 'access_required');
    assert.equal(q.idempotencyToken, null);
  }
});

test('unknown inventory is unavailable, never a launch; short inventory is refused', () => {
  const unknown = quote({ inventory: { state: 'unavailable' } });
  assert.equal(unknown.reasonCode, 'inventory_unknown');
  assert.equal(unknown.launchable, false);
  const short = quote({ subject: 'economics' });
  assert.equal(short.reasonCode, 'inventory_insufficient');
  assert.match(short.reason, /8 usable questions/);
  const empty = quote({ subject: 'english' });
  assert.equal(empty.reasonCode, 'inventory_empty');
});

test('genuine zero credits blocks; included allowance makes the set free; unknown allowance charges', () => {
  const broke = quote({ user: free(0) });
  assert.equal(broke.reasonCode, 'insufficient_credits');
  assert.equal(broke.creditBalance, 0);
  const included = quote({ user: free(0), allowance: { enabled: true, used: false } });
  assert.equal(included.launchable, true);
  assert.equal(included.creditCost, 0);
  assert.equal(included.allowance.kind, 'daily_practice');
  const used = quote({ user: free(0), allowance: { enabled: true, used: true } });
  assert.equal(used.reasonCode, 'insufficient_credits');
  const unknown = quote({ user: free(0), allowance: { enabled: true, used: null } });
  assert.equal(unknown.allowance.state, 'unknown');
  assert.equal(unknown.launchable, false, 'an unread allowance is not assumed free');
});

test('access holders pay nothing and see the expiry', () => {
  const q = quote({ user: pro, mode: 'nta', count: 50 });
  assert.equal(q.launchable, true);
  assert.equal(q.creditCost, 0);
  assert.equal(q.count, 50);
  assert.equal(q.entitlement.expiresAt, pro.premiumUntil);
  assert.match(q.reason, /valid until/);
});

test('allowance kinds follow the server session policy', () => {
  assert.equal(allowanceKindFor({ isPremium: false, modeId: 'quick', count: 10, purpose: 'ordinary', subjectId: 'history' }), 'daily_practice');
  assert.equal(allowanceKindFor({ isPremium: false, modeId: 'quick', count: 5, purpose: 'baseline', subjectId: 'economics' }), 'baseline:economics');
  assert.equal(allowanceKindFor({ isPremium: true, modeId: 'quick', count: 10, purpose: 'ordinary', subjectId: 'economics' }), null);
});

test('mode capability copy never ranks question quality', () => {
  for (const mode of Object.values(MODE_CAPABILITIES)) {
    assert.doesNotMatch(`${mode.free} ${mode.pro}`, /highest|premium quality|fast lane|better questions/i);
  }
});

test('the chosen 10/20/30 minutes sets the ordinary practice session size', () => {
  assert.deepEqual([10, 20, 30, 99].map((m) => practiceForMinutes(m).count), [10, 20, 20, 10]);
  const plan = learningPlan({ minutes: 20 });
  assert.equal(plan.primary.kind, 'ordinary_practice');
  assert.equal(plan.primary.href, '/dashboard?mode=quick&count=20');
  assert.equal(plan.primary.duration, 20);
  assert.match(learningPlan({ minutes: 30 }).primary.reason, /10 minutes reviewing/);
  assert.ok(plan.alternatives.length <= 2);
});
