import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  ARENA_HREF, VISITOR_BOOT_SCRIPT, VISITOR_KEY, findResumableTest, firstName, memberCopy, nextHint, parseHint, serializeHint, shouldEnterArena, visitorState,
} from '../visitor_state.mjs';

const free = { id: 'u1', name: 'Aarav Mehta', isPremium: false, creditBalance: 8 };
const pro = { id: 'u2', name: 'Diya', isPremium: true, premiumUntil: '2026-12-31T18:29:59.000Z', creditBalance: 0 };

test('signed-in free and Pro students are members with their plan', () => {
  assert.deepEqual(visitorState({ status: 'authenticated', user: free }), { kind: 'member', plan: 'free', confirmed: true, name: 'Aarav' });
  assert.equal(visitorState({ status: 'authenticated', user: pro }).plan, 'pro');
});

test('signed out: first visit is new, a remembered visit is returning', () => {
  assert.equal(visitorState({ status: 'unauthenticated', user: null, hint: null }).kind, 'new');
  assert.equal(visitorState({ status: 'unauthenticated', user: null, hint: serializeHint({ kind: 'returning' }) }).kind, 'returning');
});

test('a student who was signed in and is now signed out is a returning visitor, not a stranger', () => {
  const hint = serializeHint({ kind: 'member', plan: 'pro' });
  const state = visitorState({ status: 'unauthenticated', user: null, hint });
  assert.equal(state.kind, 'returning');
  assert.equal(state.plan, null);
});

test('while the check runs, or MockMob is unreachable, the remembered hint decides and is not confirmed', () => {
  const hint = serializeHint({ kind: 'member', plan: 'pro' });
  for (const status of ['loading', 'unavailable']) {
    const state = visitorState({ status, user: null, hint });
    assert.equal(state.kind, 'member');
    assert.equal(state.plan, 'pro');
    assert.equal(state.confirmed, false);
  }
  assert.equal(visitorState({ status: 'loading', user: null, hint: null }).kind, 'new');
});

test('hints survive corrupt storage and unknown values', () => {
  for (const raw of [null, '', 'not json', '{"kind":"admin"}', '[]', '42']) assert.deepEqual(parseHint(raw), { kind: 'new', plan: null });
  assert.deepEqual(parseHint('{"kind":"member","plan":"gold"}'), { kind: 'member', plan: 'free' });
});

test('nextHint records sign-in, plan changes and first visits, and ignores an unreachable server', () => {
  assert.deepEqual(nextHint({ status: 'authenticated', user: free, current: null }), { kind: 'member', plan: 'free' });
  assert.equal(nextHint({ status: 'authenticated', user: free, current: serializeHint({ kind: 'member', plan: 'free' }) }), null);
  assert.deepEqual(nextHint({ status: 'authenticated', user: pro, current: serializeHint({ kind: 'member', plan: 'free' }) }), { kind: 'member', plan: 'pro' });
  assert.deepEqual(nextHint({ status: 'unauthenticated', user: null, current: null }), { kind: 'returning' });
  assert.equal(nextHint({ status: 'unauthenticated', user: null, current: serializeHint({ kind: 'returning' }) }), null);
  assert.equal(nextHint({ status: 'unavailable', user: null, current: serializeHint({ kind: 'member', plan: 'pro' }) }), null);
  assert.equal(nextHint({ status: 'loading', user: null, current: null }), null);
});

test('member copy for a free student shows the plan and credits and offers the Arena', () => {
  const copy = memberCopy(visitorState({ status: 'authenticated', user: free }), free);
  assert.equal(copy.eyebrow, 'Welcome back, Aarav');
  assert.equal(copy.plan, 'Free plan · 8 practice credits left');
  assert.deepEqual(copy.primary, { label: 'Enter the Arena', href: ARENA_HREF });
  assert.equal(copy.secondary.href, '/pricing');
  assert.doesNotMatch(JSON.stringify(copy), /five questions|sign up|signup/i);
});

test('member copy for Pro shows the paid-through date and no upgrade pitch', () => {
  const copy = memberCopy(visitorState({ status: 'authenticated', user: pro }), pro);
  assert.equal(copy.plan, 'Pro plan · active until 31 Dec 2026');
  assert.equal(copy.unlimited, 'Unlimited practice');
  assert.equal(copy.secondary.href, '/review');
  assert.doesNotMatch(JSON.stringify(copy), /pricing|upgrade|compare plans/i);
});

test('member copy copes with a missing name, one credit and no balance', () => {
  assert.equal(memberCopy({ kind: 'member', plan: 'free', name: '' }, { creditBalance: 1 }).plan, 'Free plan · 1 practice credit left');
  assert.equal(memberCopy({ kind: 'member', plan: 'free', name: '' }, { id: 'x' }).plan, 'Free plan');
  assert.equal(memberCopy({ kind: 'member', plan: 'free', name: '' }, null).eyebrow, 'Welcome back');
  assert.equal(firstName({ name: '   ' }), '');
});

function storageOf(entries) {
  const map = new Map(Object.entries(entries).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return { get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null, getItem: (k) => map.get(k) ?? null };
}
const NOW = Date.parse('2026-10-13T10:00:00Z');
const draft = (over = {}) => ({
  questions: [{ id: 'q1' }], selectionMeta: { sessionId: 's1' }, generationKey: 'gen-123456789012', endsAt: NOW + 25 * 60000,
  resumeUrl: '/test?subject=english&mode=nta&count=50&generationKey=gen-123456789012&sessionId=s1', ...over,
});

test('resume finds the newest live test of this student and ignores everyone else and stale drafts', () => {
  const storage = storageOf({
    'mm:test:u1:english:*:50:auto:nta': draft(),
    'mm:test:u1:accountancy:*:10:auto:quick': draft({ endsAt: NOW + 5 * 60000, selectionMeta: { sessionId: 's2' }, resumeUrl: '/test?subject=accountancy&sessionId=s2&generationKey=gen-123456789012' }),
    'mm:test:u1:economics:*:10:auto:quick': draft({ endsAt: NOW - 1000 }),
    'mm:test:u2:english:*:50:auto:nta': draft({ endsAt: NOW + 55 * 60000 }),
    'mm:test:u1:english:*:50:auto:nta:integrity:s1': { strikes: 1 },
  });
  const found = findResumableTest(storage, 'u1', NOW);
  assert.equal(found.minutesLeft, 25);
  assert.equal(found.label, 'english test');
  assert.match(found.href, /^\/test\?subject=english/);
  assert.equal(findResumableTest(storage, 'nobody', NOW), null);
  assert.equal(findResumableTest(storage, null, NOW), null);
});

test('resume skips submissions in flight, drafts without a safe URL, and corrupt entries', () => {
  const storage = storageOf({
    'mm:test:u1:a': draft({ pendingSubmission: true }),
    'mm:test:u1:b': draft({ resumeUrl: 'https://evil.example/test?x=1' }),
    'mm:test:u1:c': draft({ resumeUrl: undefined }),
    'mm:test:u1:d': 'not json',
  });
  assert.equal(findResumableTest(storage, 'u1', NOW), null);
  assert.equal(findResumableTest({ get length() { throw new Error('blocked'); } }, 'u1', NOW), null);
});

test('a resumable test becomes the main action', () => {
  const resume = { href: '/test?subject=english&sessionId=s1', label: 'english test', minutesLeft: 25 };
  const copy = memberCopy(visitorState({ status: 'authenticated', user: free }), free, resume);
  assert.deepEqual(copy.primary, { label: 'Resume your test', href: resume.href });
  assert.equal(copy.secondary.href, ARENA_HREF);
  assert.match(copy.line, /25 min left/);
});

const member = { kind: 'member', plan: 'free', confirmed: true };
const base = { preference: '1', state: member, landedOnHome: true, referrer: '', origin: 'https://www.mockmob.in', search: '' };

test('the Arena opens straight away only for a confirmed member who asked for it, on a fresh visit', () => {
  assert.equal(shouldEnterArena(base), true);
  assert.equal(shouldEnterArena({ ...base, referrer: 'https://www.google.com/' }), true);
  assert.equal(shouldEnterArena({ ...base, preference: null }), false, 'no preference, no redirect');
  assert.equal(shouldEnterArena({ ...base, preference: '0' }), false);
  assert.equal(shouldEnterArena({ ...base, state: { ...member, confirmed: false } }), false, 'unconfirmed session');
  assert.equal(shouldEnterArena({ ...base, state: { kind: 'returning', confirmed: true } }), false, 'signed out visitors are never redirected');
  assert.equal(shouldEnterArena({ ...base, state: { kind: 'new', confirmed: true } }), false);
  assert.equal(shouldEnterArena({ ...base, landedOnHome: false }), false, 'the logo inside the app means home');
  assert.equal(shouldEnterArena({ ...base, referrer: 'https://www.mockmob.in/pricing' }), false);
  assert.equal(shouldEnterArena({ ...base, search: '?home=1' }), false);
  assert.equal(shouldEnterArena({ ...base, referrer: 'garbage' }), false);
});

function bootWith(stored, { throws = false } = {}) {
  const documentElement = { dataset: {} };
  const localStorage = { getItem: (key) => { if (throws) throw new Error('blocked'); assert.equal(key, VISITOR_KEY); return stored; } };
  vm.runInNewContext(VISITOR_BOOT_SCRIPT, { document: { documentElement }, localStorage });
  return documentElement.dataset.visitor;
}

test('the boot script sets the visitor kind before first paint and never throws', () => {
  assert.equal(bootWith(null), 'new');
  assert.equal(bootWith(serializeHint({ kind: 'returning' })), 'returning');
  assert.equal(bootWith(serializeHint({ kind: 'member', plan: 'pro' })), 'member');
  assert.equal(bootWith('{"kind":"admin"}'), 'new');
  assert.equal(bootWith('garbage'), 'new');
  assert.equal(bootWith(null, { throws: true }), 'new');
});

test('the boot script and parseHint agree on every stored value', () => {
  for (const raw of [null, 'x', '{"kind":"member"}', '{"kind":"returning"}', '{"kind":"new"}', '{"kind":"owner"}']) {
    assert.equal(bootWith(raw), parseHint(raw).kind, String(raw));
  }
});
