// W1.3 Today speed. Proves the parallel learning record is identical to the earlier sequential
// version, that the reads really overlap, and that the client plan cache behaves.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { composeLearningRecord, allInOrder, memoValidator, started, STEP_VIEW_OMITS } from '../../src/lib/server/learningRecordCompose.js';
import { learningPlan } from '../learning_engine.js';
import { guidedSequence, istDay } from '../study_engine.js';
import { tonightCompletion, studyMilestones } from '../study_progress.js';
import { withPlanActions } from '../../src/lib/server/actionFields.js';
import {
  planAgeLabel, readCachedPlan, writeCachedPlan, clearCachedPlans, planKey, planPath, planSlot, isFresh,
  fetchLearningPlan, waitForPlanSettled, prefetchLearningPlan, resetPlanCacheMemory, FRESH_MS, MAX_AGE_MS,
} from '../../src/lib/learningPlanCache.js';

// The sequential learningRecord exactly as it was before W1.3 (src/lib/server/learning.js at
// 902025c), with its reads passed in. Only the I/O names changed; the logic is verbatim.
async function legacyLearningRecord(userId, { subject, minutes } = {}, d) {
  if (d.env.STUDY_GUIDED_PLAN_ENABLED === 'true') {
    try {
      const prefs=await d.getStudyPreferences(userId);
      const weekday=(new Date(`${d.istDay(Date.now())}T00:00:00Z`).getUTCDay()+6)%7;
      const weekly=prefs.premium ? prefs.weeklyPlan?.[weekday] : null;
      if(!subject) subject=weekly?.subject;
      if(![10,20,30].includes(minutes)) minutes=weekly?.minutes || prefs.minutes;
    } catch { /* Existing learning record remains available if study storage is not deployed. */ }
  }
  const attempts = await d.getAttempts(userId);
  const [episodeResult, sessionResult] = await Promise.all([d.loadEpisodes(userId), d.loadActiveSession(userId)]);
  const episodes = [];
  for (const row of episodeResult.data || []) {
    try { await d.validateCurrentPathway(row.pathway); episodes.push(d.publicEpisode(row.pathway, row.projection, Date.now())); }
    catch { episodes.push({ id: row.id, title: row.pathway.title, state: 'blocked_content', evidenceLabel: 'Current evidence unavailable; progress claims paused', sampleSize: 0 }); }
  }
  const active = sessionResult.data?.[0];
  let available = [];
  try { available = await d.releasedPathways(); } catch { /* fail closed; ordinary review remains useful */ }
  const activeSession = active ? { id: active.id, href: `/test?${new URLSearchParams({ subject: active.subject, mode: active.mode, sessionId: active.id, experience: active.selection_meta?.learningPurpose === 'ordinary_practice' ? 'practice' : 'recovery' })}` } : null;
  const plan = d.learningPlan({ episodes, activeSession, attempts, subject, minutes, availableConcepts: available.map(p => p.id) });
  let suite = {};
  if (d.env.STUDY_GUIDED_PLAN_ENABLED === 'true') {
    try {
      const weakConcepts=attempts.flatMap(attempt=>(attempt.details || []).filter(answer=>answer.isCorrect===false).map(answer=>attempt.questionsSnapshot?.find(q=>q.id===answer.qid)?.conceptId).filter(Boolean));
      const weakChapters=attempts.slice(0,10).flatMap(attempt=>(attempt.details || []).filter(answer=>answer.isCorrect===false).map(answer=>{const q=attempt.questionsSnapshot?.find(q=>q.id===answer.qid);return q?.chapter ? {subject:q.subject || attempt.subject,chapter:q.chapter} : null;}).filter(Boolean));
      const study = await d.studyRecord(userId,{subject:subject || undefined,weakConcepts,weakChapters});
      if (study.state === 'ready') {
        const sequence = d.guidedSequence(plan,study,plan.minutes);
        suite = { sequence, primary:sequence[0] || plan.primary, study:{dueCards:study.queue.dueCount,lessonsRead:study.progress.lessonsRead,preferences:study.preferences,weekday:(new Date(`${d.istDay(Date.now())}T00:00:00Z`).getUTCDay()+6)%7} };
      }
    } catch { suite = { studyState:'unavailable' }; }
  }
  const withActions = d.withPlanActions({ ...plan, ...suite });
  return { ...withActions, episodes,
    pathwayState: available.length ? 'available' : 'blocked_content', supportedConcepts: available.map(p => ({ id: p.id, subject: p.subject, title: p.title })),
    recordState: episodeResult.error ? 'unavailable' : 'ready', ordinaryAttemptCount: attempts.length,
    tonight: tonightCompletion(attempts), milestones: studyMilestones(attempts, episodes) };
}

// ---------- fixtures ----------
const NOW = Date.parse('2026-10-14T15:30:00Z'); // 9:00 PM IST, a Wednesday
const HOUR = 3600000;
const pathway = (id, extra = {}) => ({ id, title: `Pathway ${id}`, subject: 'economics', bad: false, ...extra });
const q = (id, conceptId, chapter, subject = 'economics') => ({ id, conceptId, chapter, subject });
const attempt = (id, { subject = 'economics', misses = [], completedAt = NOW - 2 * HOUR, scoring = 'server_snapshot_v1', tonight } = {}) => ({
  id, subject, completedAt,
  details: [...misses.map(m => ({ qid: m.id, isCorrect: false })), { qid: `${id}-ok`, isCorrect: true }],
  questionsSnapshot: [...misses, q(`${id}-ok`, 'c-ok', 'Money')],
  selectionMeta: { scoringVersion: scoring, ...(tonight ? { tonight } : {}) },
});
const publicEpisode = (p, e, now) => ({ id: e.id, conceptId: p.id, subject: p.subject, title: p.title, state: e.state, nextDueAt: e.nextDueAt, sampleSize: e.sampleSize ?? 0, evidenceLabel: 'More fresh checks needed', diagnosisLabel: e.label, at: now });
const studyReady = (over = {}) => ({ state: 'ready', queue: { items: [{ id: 'card-1' }, { id: 'card-2' }], dueCount: 1 }, progress: { lessonsRead: 3 }, active: null,
  nextUnit: { id: 'unit-9', title: 'Demand', subject: 'economics', chapter: 'Demand', reason: 'You have missed Demand questions in practice.' }, preferences: { minutes: 20, revision: 4, premium: false, subjects: ['economics'] }, ...over });

function world(over = {}) {
  const calls = [];
  const log = name => (...args) => { calls.push([name, ...args]); };
  const w = {
    attempts: [], episodes: [], episodeError: null, session: null, released: [], prefs: { minutes: 20, premium: false }, study: studyReady(),
    failPrefs: false, failAttempts: null, failRows: null, failReleased: false, failStudy: false, badPathways: new Set(), env: { STUDY_GUIDED_PLAN_ENABLED: 'true' },
    ...over,
  };
  const deps = {
    env: w.env,
    getStudyPreferences: async id => { log('prefs')(id); if (w.failPrefs) throw new Error('STUDY_STORAGE_UNAVAILABLE'); return w.prefs; },
    getAttempts: async id => { log('attempts')(id); if (w.failAttempts) throw w.failAttempts; return w.attempts; },
    loadEpisodes: async id => { log('episodes')(id); if (w.failRows) throw w.failRows; return { data: w.episodes, error: w.episodeError }; },
    loadActiveSession: async id => { log('session')(id); return { data: w.session ? [w.session] : [], error: null }; },
    validateCurrentPathway: async p => { log('validate')(p.id); if (w.badPathways.has(p.id)) throw new Error('CONTENT_EVIDENCE_CHANGED'); },
    releasedPathways: async () => { log('released')(); if (w.failReleased) throw new Error('PATHWAY_EVIDENCE_UNAVAILABLE'); return w.released; },
    studyRecord: async (id, opts) => { log('study')(id, opts); if (w.failStudy) throw new Error('STUDY_STORAGE_UNAVAILABLE'); return w.study; },
    publicEpisode, learningPlan, guidedSequence, istDay, withPlanActions, tonightCompletion, studyMilestones,
  };
  return { deps, calls };
}

const tonightKey = 'tonight-plan-abcdefghijkl';
const SCENARIOS = {
  'new student, nothing recorded': {},
  'guided plan off': { env: { STUDY_GUIDED_PLAN_ENABLED: 'false' } },
  'guided env missing': { env: {} },
  'ordinary practice with misses': { attempts: [attempt('a1', { misses: [q('m1', 'c-elastic', 'Elasticity')] }), attempt('a2', { subject: 'accountancy', misses: [q('m2', null, 'Partnership', 'accountancy')] })] },
  'repeated miss on a released concept': { released: [pathway('c-elastic')], attempts: [attempt('a1', { misses: [q('m1', 'c-elastic', 'Elasticity')] }), attempt('a2', { misses: [q('m3', 'c-elastic', 'Elasticity')] })] },
  'released concept, no session in subject': { released: [pathway('c-elastic')], attempts: [attempt('a1', { subject: 'accountancy' })] },
  'active session waiting': { session: { id: 's-1', subject: 'economics', mode: 'quick', selection_meta: { learningPurpose: 'ordinary_practice' } }, attempts: [attempt('a1')] },
  'due fresh check and a blocked episode': {
    released: [pathway('c-1')], badPathways: new Set(['c-2']),
    episodes: [
      { id: 'e1', pathway: pathway('c-1'), projection: { id: 'e1', state: 'delayed_check_1', nextDueAt: NOW - HOUR, sampleSize: 1 } },
      { id: 'e2', pathway: pathway('c-2'), projection: { id: 'e2', state: 'repairing', nextDueAt: null } },
      { id: 'e3', pathway: pathway('c-1'), projection: { id: 'e3', state: 'maintained', nextDueAt: NOW + 30 * HOUR, sampleSize: 2 } },
    ],
  },
  'repair in progress': { episodes: [{ id: 'e9', pathway: pathway('c-9'), projection: { id: 'e9', state: 'immediate_check', nextDueAt: null } }] },
  'tonight recorded': { attempts: [attempt('a7', { tonight: { key: tonightKey, minutes: 30, day: '2026-10-14' }, completedAt: NOW - HOUR })] },
  'premium weekly plan sets subject and time': { prefs: { minutes: 10, premium: true, weeklyPlan: [0, 1, 2, 3, 4, 5, 6].map(i => ({ subject: i === 2 ? 'accountancy' : 'economics', minutes: i === 2 ? 30 : 20 })) } },
  'preferences unavailable': { failPrefs: true, attempts: [attempt('a1')] },
  'study record unavailable': { failStudy: true },
  'study content disabled': { study: { state: 'disabled' } },
  'study with an active lesson': { study: studyReady({ active: { id: 'run-1', mode: 'learn', title: 'Supply', step: 2, total: 5, unitId: 'unit-3' } }) },
  'released pathways fail closed': { failReleased: true, attempts: [attempt('a1')] },
  'episode storage error': { episodeError: { message: 'relation missing' } },
  'many attempts beyond ten': { attempts: Array.from({ length: 14 }, (_, i) => attempt(`a${i}`, { misses: [q(`m${i}`, `c${i % 3}`, `Chapter ${i % 4}`)], completedAt: NOW - (i + 1) * HOUR })) },
};
const OPTION_SETS = [{}, { minutes: 30 }, { subject: 'accountancy', minutes: 10 }, { minutes: 15 }, { minutes: NaN, subject: null }];

const frozen = fn => async t => {
  mock.timers.enable({ apis: ['Date'], now: NOW });
  try { await fn(t); } finally { mock.timers.reset(); }
};

test('the parallel record is identical to the sequential one in every scenario', frozen(async () => {
  let compared = 0;
  for (const [name, over] of Object.entries(SCENARIOS)) {
    for (const options of OPTION_SETS) {
      const before = await legacyLearningRecord('u-1', { ...options }, world(over).deps);
      const after = await composeLearningRecord('u-1', { ...options }, world(over).deps);
      assert.deepEqual(after, before, `${name} ${JSON.stringify(options)}`);
      assert.equal(JSON.stringify(after), JSON.stringify(before), `${name}: same key order`);
      compared += 1;
    }
  }
  assert.equal(compared, Object.keys(SCENARIOS).length * OPTION_SETS.length);
}));

test('the study record receives the same subject and weak areas as before', frozen(async () => {
  for (const [name, over] of Object.entries(SCENARIOS)) {
    const a = world(over), b = world(over);
    await legacyLearningRecord('u-1', {}, a.deps);
    await composeLearningRecord('u-1', {}, b.deps);
    assert.deepEqual(b.calls.filter(c => c[0] === 'study'), a.calls.filter(c => c[0] === 'study'), name);
  }
}));

test('failures surface the same error as the sequential version', frozen(async () => {
  const attemptsDown = Object.assign(new Error('attempts down'), { code: 'A' });
  const rowsDown = Object.assign(new Error('episodes down'), { code: 'R' });
  for (const over of [{ failAttempts: attemptsDown }, { failRows: rowsDown }, { failAttempts: attemptsDown, failRows: rowsDown }]) {
    const before = await legacyLearningRecord('u-1', {}, world(over).deps).then(() => null, e => e);
    const after = await composeLearningRecord('u-1', {}, world(over).deps).then(() => null, e => e);
    assert.ok(before && after);
    assert.equal(after, before);
  }
  // A malformed episode row (no pathway) throws in both.
  const broken = { episodes: [{ id: 'bad', pathway: null, projection: {} }] };
  const before = await legacyLearningRecord('u-1', {}, world(broken).deps).then(() => null, e => e.constructor.name);
  const after = await composeLearningRecord('u-1', {}, world(broken).deps).then(() => null, e => e.constructor.name);
  assert.equal(after, before);
  assert.equal(after, 'TypeError');
}));

test('step view is the full record without the episode list, concepts and milestones', frozen(async () => {
  for (const [name, over] of Object.entries(SCENARIOS)) {
    const full = await composeLearningRecord('u-1', { minutes: 20 }, world(over).deps);
    const step = await composeLearningRecord('u-1', { minutes: 20, view: 'step' }, world(over).deps);
    const expected = Object.fromEntries(Object.entries(full).filter(([k]) => !STEP_VIEW_OMITS.includes(k)));
    assert.deepEqual(step, expected, name);
    for (const key of STEP_VIEW_OMITS) assert.equal(key in step, false, `${name}: ${key}`);
    assert.ok(step.primary?.href && step.primary.action, `${name}: primary step with action`);
  }
}));

test('reads start together instead of one after another', async () => {
  const pending = [];
  const gate = name => () => new Promise(resolve => pending.push({ name, resolve }));
  const { deps } = world({ released: [pathway('c-1')], episodes: [{ id: 'e1', pathway: pathway('c-1'), projection: { id: 'e1', state: 'repairing' } }] });
  const opened = [];
  const wrap = (name, value) => (...args) => { opened.push(name); return gate(name)().then(() => (typeof value === 'function' ? value(...args) : value)); };
  const run = composeLearningRecord('u-1', {}, { ...deps,
    getStudyPreferences: wrap('prefs', { minutes: 20 }), getAttempts: wrap('attempts', []),
    loadEpisodes: wrap('episodes', deps.loadEpisodes), loadActiveSession: wrap('session', deps.loadActiveSession), releasedPathways: wrap('released', [pathway('c-1')]) });
  await new Promise(resolve => setImmediate(resolve));
  // Before any read has answered, all five are already in flight.
  assert.deepEqual(opened.sort(), ['attempts', 'episodes', 'prefs', 'released', 'session']);
  for (const p of pending) p.resolve();
  const out = await run;
  assert.equal(out.recordState, 'ready');
});

test('with equal read latency the parallel record finishes in far fewer rounds', async () => {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const slow = (fn, ms = 15) => async (...args) => { await delay(ms); return fn(...args); };
  const over = { released: [pathway('c-1'), pathway('c-2'), pathway('c-3')], episodes: ['c-1', 'c-2', 'c-3', 'c-4'].map((c, i) => ({ id: `e${i}`, pathway: pathway(c), projection: { id: `e${i}`, state: 'repairing' } })) };
  const timed = async run => { const { deps } = world(over); const slowDeps = { ...deps };
    for (const k of ['getStudyPreferences', 'getAttempts', 'loadEpisodes', 'loadActiveSession', 'validateCurrentPathway', 'studyRecord']) slowDeps[k] = slow(deps[k]);
    // releasedPathways validates each pathway itself, one by one before W1.3.
    slowDeps.releasedPathways = async () => { for (const p of over.released) await slowDeps.validateCurrentPathway(p); return over.released; };
    const t0 = performance.now(); await run(slowDeps); return performance.now() - t0; };
  const before = await timed(d => legacyLearningRecord('u-1', {}, d));
  const after = await timed(d => composeLearningRecord('u-1', {}, { ...d, releasedPathways: async () => { await allInOrder(over.released.map(p => () => d.validateCurrentPathway(p))); return over.released; } }));
  // Sequential: prefs, attempts, rows, 4 episode checks, 3 pathway checks, study = 11 rounds.
  // Parallel: max(prefs, attempts, rows then checks, pathway checks), then study = about 3 rounds.
  assert.ok(after < before / 2, `after ${after.toFixed(0)} ms, before ${before.toFixed(0)} ms`);
});

test('allInOrder runs together but fails like a loop: first failure by position', async () => {
  const order = [];
  const task = (name, ms, fail) => () => new Promise((resolve, reject) => setTimeout(() => { order.push(name); fail ? reject(new Error(name)) : resolve(name); }, ms));
  assert.deepEqual(await allInOrder([task('a', 15), task('b', 1), task('c', 5)]), ['a', 'b', 'c']);
  await assert.rejects(allInOrder([task('ok', 1), task('first', 20, true), task('second', 2, true)]), /first/);
  await assert.rejects(allInOrder([() => { throw new Error('sync'); }]), /sync/);
  assert.deepEqual(await allInOrder([]), []);
});

test('memoValidator checks each distinct pathway once per request', async () => {
  let calls = 0;
  const validate = memoValidator(async p => { calls += 1; if (p.bad) throw new Error('CONTENT_EVIDENCE_CHANGED'); });
  await Promise.all([validate(pathway('c-1')), validate(pathway('c-1')), validate(pathway('c-2'))]);
  assert.equal(calls, 2);
  await assert.rejects(validate(pathway('c-3', { bad: true })), /CHANGED/);
  await assert.rejects(validate(pathway('c-3', { bad: true })), /CHANGED/);
  assert.equal(calls, 3);
  // A changed pathway with the same id is a different check.
  await validate(pathway('c-1', { version: 2 }));
  assert.equal(calls, 4);
});

test('started() never leaves an unhandled rejection but still throws when awaited', async () => {
  const p = started(() => { throw new Error('later'); });
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(p, /later/);
});

// ---------- client cache ----------
function memoryStorage() {
  const map = new Map();
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k),
    key: i => [...map.keys()][i] ?? null, get length() { return map.size; }, map };
}
const PLAN = { primary: { kind: 'ordinary_practice', title: 'Start 20 practice questions', href: '/dashboard?mode=quick&count=20' }, alternatives: [], minutes: 20 };

test('age label: whole minutes, then whole hours, plain words', () => {
  assert.equal(planAgeLabel(NOW, NOW), 'From less than a minute ago');
  assert.equal(planAgeLabel(NOW - 59000, NOW), 'From less than a minute ago');
  assert.equal(planAgeLabel(NOW - 60000, NOW), 'From 1 minute ago');
  assert.equal(planAgeLabel(NOW - 4 * 60000 - 30000, NOW), 'From 4 minutes ago');
  assert.equal(planAgeLabel(NOW - 61 * 60000, NOW), 'From 1 hour ago');
  assert.equal(planAgeLabel(NOW - 5 * HOUR, NOW), 'From 5 hours ago');
  assert.equal(planAgeLabel(NOW + 5000, NOW), 'From less than a minute ago');
});

test('keys and paths: one slot per time choice, step view always', () => {
  assert.equal(planSlot(null), 'auto'); assert.equal(planSlot(undefined), 'auto'); assert.equal(planSlot(15), 'auto'); assert.equal(planSlot('20'), '20');
  assert.equal(planKey('u-1', null), 'mm.plan.v1.u-1.auto');
  assert.equal(planPath(null), '/api/learning/plan?view=step');
  assert.equal(planPath(30), '/api/learning/plan?view=step&minutes=30');
});

test('saved plan: returned for the same student, day and time; dropped when old, foreign or broken', () => {
  resetPlanCacheMemory();
  const storage = memoryStorage();
  writeCachedPlan({ userId: 'u-1', minutes: null, plan: PLAN, now: NOW, storage });
  resetPlanCacheMemory(); // as after a reload: only storage remains
  assert.deepEqual(readCachedPlan({ userId: 'u-1', minutes: null, now: NOW + 4 * 60000, storage }), { plan: PLAN, savedAt: NOW });
  assert.equal(readCachedPlan({ userId: 'u-2', minutes: null, now: NOW, storage }), null, 'another student');
  assert.equal(readCachedPlan({ userId: 'u-1', minutes: 30, now: NOW, storage }), null, 'another time choice');
  assert.equal(readCachedPlan({ userId: null, now: NOW, storage }), null, 'no student');
  // 9:00 PM IST + 3h30m is the next India day.
  assert.equal(readCachedPlan({ userId: 'u-1', minutes: null, now: NOW + 3.5 * HOUR, storage }), null, 'next day');
  assert.equal(storage.map.size, 0, 'stale entry removed');
  writeCachedPlan({ userId: 'u-1', minutes: null, plan: PLAN, now: NOW - 7 * HOUR, storage });
  resetPlanCacheMemory();
  assert.equal(readCachedPlan({ userId: 'u-1', minutes: null, now: NOW, storage }), null, 'older than the limit');
  storage.setItem(planKey('u-1', null), '{not json');
  assert.equal(readCachedPlan({ userId: 'u-1', minutes: null, now: NOW, storage }), null, 'malformed');
  storage.setItem(planKey('u-1', null), JSON.stringify({ userId: 'u-2', savedAt: NOW, plan: PLAN }));
  assert.equal(readCachedPlan({ userId: 'u-1', minutes: null, now: NOW, storage }), null, 'entry for another student under this key');
  assert.ok(MAX_AGE_MS <= 6 * HOUR);
});

test('blocked storage means no cache, never an error', () => {
  resetPlanCacheMemory();
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); }, removeItem() { throw new Error('x'); }, key() { throw new Error('x'); }, get length() { throw new Error('x'); } };
  assert.doesNotThrow(() => writeCachedPlan({ userId: 'u-1', minutes: null, plan: PLAN, now: NOW, storage: blocked }));
  // Memory still serves this page view.
  assert.deepEqual(readCachedPlan({ userId: 'u-1', minutes: null, now: NOW + 1000, storage: blocked }), { plan: PLAN, savedAt: NOW });
  resetPlanCacheMemory();
  assert.equal(readCachedPlan({ userId: 'u-1', minutes: null, now: NOW, storage: blocked }), null);
  assert.doesNotThrow(() => clearCachedPlans({ storage: blocked }));
});

test('clearing: one time choice, one student, or everyone', () => {
  resetPlanCacheMemory();
  const storage = memoryStorage();
  for (const [u, m] of [['u-1', null], ['u-1', 20], ['u-2', null]]) writeCachedPlan({ userId: u, minutes: m, plan: PLAN, now: NOW, storage });
  storage.setItem('unrelated', '1');
  clearCachedPlans({ userId: 'u-1', minutes: null, storage });
  assert.deepEqual([...storage.map.keys()].sort(), ['mm.plan.v1.u-1.20', 'mm.plan.v1.u-2.auto', 'unrelated']);
  clearCachedPlans({ userId: 'u-1', storage });
  assert.deepEqual([...storage.map.keys()].sort(), ['mm.plan.v1.u-2.auto', 'unrelated']);
  clearCachedPlans({ storage });
  assert.deepEqual([...storage.map.keys()], ['unrelated']);
  assert.equal(readCachedPlan({ userId: 'u-2', minutes: null, now: NOW, storage }), null);
});

test('freshness: a plan from the last minute needs no new request', () => {
  assert.equal(isFresh({ savedAt: NOW }, NOW + FRESH_MS - 1), true);
  assert.equal(isFresh({ savedAt: NOW }, NOW + FRESH_MS), false);
  assert.equal(isFresh(null, NOW), false);
});

test('two callers share one request; the settle wait opens when it ends', async () => {
  resetPlanCacheMemory();
  let calls = 0, release;
  const fetcher = path => { calls += 1; assert.equal(path, '/api/learning/plan?view=step'); return new Promise(resolve => { release = () => resolve(PLAN); }); };
  const a = fetchLearningPlan({ fetcher }), b = fetchLearningPlan({ fetcher });
  assert.equal(a, b);
  let opened = false;
  const waiting = waitForPlanSettled(5000).then(() => { opened = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(opened, false, 'still waiting while the plan loads');
  release();
  assert.deepEqual(await a, PLAN);
  await waiting;
  assert.equal(opened, true);
  assert.equal(calls, 1);
});

test('a failed request is shared too, and the next call tries again', async () => {
  resetPlanCacheMemory();
  let calls = 0;
  const failing = () => { calls += 1; return Promise.reject(Object.assign(new Error('Unauthorized'), { status: 401 })); };
  await Promise.all([assert.rejects(fetchLearningPlan({ fetcher: failing }), e => e.status === 401), assert.rejects(fetchLearningPlan({ fetcher: failing }), e => e.status === 401)]);
  assert.equal(calls, 1);
  await assert.rejects(fetchLearningPlan({ fetcher: failing }));
  assert.equal(calls, 2);
});

test('settle wait gives up after its timeout so secondary content still appears', async () => {
  resetPlanCacheMemory();
  const t0 = performance.now();
  await waitForPlanSettled(30);
  assert.ok(performance.now() - t0 >= 25);
});

test('prefetch without a student, or with a fresh copy, makes no request', () => {
  resetPlanCacheMemory();
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { ok: true, status: 200, json: async () => PLAN }; };
  try {
    prefetchLearningPlan(null);
    assert.equal(calls, 0);
    writeCachedPlan({ userId: 'u-1', minutes: null, plan: PLAN, storage: null });
    prefetchLearningPlan('u-1');
    assert.equal(calls, 0);
  } finally { globalThis.fetch = realFetch; resetPlanCacheMemory(); }
});

test('prefetch warms the cache for Today', async () => {
  resetPlanCacheMemory();
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (path, init) => { seen.push([path, init.cache]); return { ok: true, status: 200, json: async () => PLAN }; };
  try {
    prefetchLearningPlan('u-1');
    await waitForPlanSettled(1000);
    assert.deepEqual(seen, [['/api/learning/plan?view=step', 'no-store']]);
    const held = readCachedPlan({ userId: 'u-1', storage: null });
    assert.deepEqual(held.plan, PLAN);
    assert.equal(isFresh(held), true);
  } finally { globalThis.fetch = realFetch; resetPlanCacheMemory(); }
});
