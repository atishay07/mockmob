import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  ARENA_FIRST_KEY, DEFAULT_START_ON, FIRST_CHECK_HREF, PRACTICE_HREF, START_ON_KEY, START_ON_OPTIONS, STARTED_CHECK_GAP_MS, VISITOR_BOOT_SCRIPT, VISITOR_KEY,
  findResumableTest, firstName, forgetArenaFirst, forgetStartOn, memberCopy, nextHint, parseHint, parseStartOn, readStartOn, serializeHint,
  readStarted, shouldCheckStarted, stageOf, startDestination, startRedirectPlan, startedFromSummary, visitorState, writeStartOn,
} from '../visitor_state.mjs';

const free = { id: 'u1', name: 'Aarav Mehta', isPremium: false, creditBalance: 8 };
const pro = { id: 'u2', name: 'Diya', isPremium: true, premiumUntil: '2026-12-31T18:29:59.000Z', creditBalance: 0 };

test('signed-in free and Pro students are members with their plan', () => {
  assert.deepEqual(visitorState({ status: 'authenticated', user: free }), { kind: 'member', plan: 'free', confirmed: true, name: 'Aarav', stage: null });
  assert.equal(visitorState({ status: 'authenticated', user: pro }).plan, 'pro');
});

test('signed out: first visit is new, a remembered visit is returning', () => {
  assert.equal(visitorState({ status: 'unauthenticated', user: null, hint: null }).kind, 'new');
  assert.equal(visitorState({ status: 'unauthenticated', user: null, hint: serializeHint({ kind: 'returning' }) }).kind, 'returning');
});

test('a visitor who never signed in stays new, however many times they come back', () => {
  let stored = null;
  for (let visit = 0; visit < 5; visit++) {
    // Every page load: the check ends signed out, the visitor is judged on what was stored before it.
    assert.equal(visitorState({ status: 'unauthenticated', user: null, hint: stored }).kind, 'new', `visit ${visit + 1}`);
    const next = nextHint({ status: 'unauthenticated', user: null, current: stored });
    assert.equal(next, null, 'nothing is remembered about a visitor who never had an account');
    if (next) stored = serializeHint(next);
  }
  // Signing in, then out, is what makes someone a returning visitor.
  stored = serializeHint(nextHint({ status: 'authenticated', user: free, current: stored }));
  assert.equal(parseHint(stored).kind, 'member');
  stored = serializeHint(nextHint({ status: 'unauthenticated', user: null, current: stored }));
  assert.equal(visitorState({ status: 'unauthenticated', user: null, hint: stored }).kind, 'returning');
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
  for (const raw of [null, '', 'not json', '{"kind":"admin"}', '[]', '42']) assert.deepEqual(parseHint(raw), { kind: 'new', plan: null, started: null });
  assert.deepEqual(parseHint('{"kind":"member","plan":"gold"}'), { kind: 'member', plan: 'free', started: null });
  assert.deepEqual(parseHint('{"kind":"member","plan":"pro","started":"yes"}'), { kind: 'member', plan: 'pro', started: null }, 'only a real boolean counts');
  assert.deepEqual(parseHint('{"kind":"returning","started":false}'), { kind: 'returning', plan: null, started: null }, 'only members have a stage');
});

test('nextHint records sign-in, plan changes and sign-out, and ignores an unreachable server', () => {
  assert.deepEqual(nextHint({ status: 'authenticated', user: free, current: null }), { kind: 'member', plan: 'free' });
  assert.equal(nextHint({ status: 'authenticated', user: free, current: serializeHint({ kind: 'member', plan: 'free' }) }), null);
  assert.deepEqual(nextHint({ status: 'authenticated', user: pro, current: serializeHint({ kind: 'member', plan: 'free' }) }), { kind: 'member', plan: 'pro' });
  assert.deepEqual(nextHint({ status: 'unauthenticated', user: null, current: serializeHint({ kind: 'member', plan: 'pro' }) }), { kind: 'returning' }, 'signing out makes a returning visitor');
  assert.equal(nextHint({ status: 'unauthenticated', user: null, current: serializeHint({ kind: 'returning' }) }), null);
  assert.equal(nextHint({ status: 'unavailable', user: null, current: serializeHint({ kind: 'member', plan: 'pro' }) }), null);
  assert.equal(nextHint({ status: 'unavailable', user: null, current: serializeHint({ kind: 'member', plan: 'pro' }), started: true }), null, 'an unconfirmed session records nothing');
  assert.equal(nextHint({ status: 'loading', user: null, current: null }), null);
});

test('the day-one stage is known only for certain, and once started it stays started', () => {
  // Fresh sign-in: the stage is unknown until the attempts list answers.
  let stored = serializeHint(nextHint({ status: 'authenticated', user: free, current: null }));
  assert.equal(stageOf(stored), null, 'unknown is treated as an active member');
  // The attempts list says none yet.
  stored = serializeHint(nextHint({ status: 'authenticated', user: free, current: stored, started: false }));
  assert.equal(stageOf(stored), 'first');
  assert.equal(visitorState({ status: 'loading', user: null, hint: stored }).stage, 'first', 'the hint carries the stage before the check');
  assert.equal(visitorState({ status: 'authenticated', user: free, hint: stored }).stage, 'first');
  assert.equal(nextHint({ status: 'authenticated', user: free, current: stored, started: false }), null, 'nothing new to store');
  // Plan changes keep the stage.
  stored = serializeHint(nextHint({ status: 'authenticated', user: pro, current: stored }));
  assert.equal(parseHint(stored).plan, 'pro');
  assert.equal(stageOf(stored), 'first');
  // First scored session.
  stored = serializeHint(nextHint({ status: 'authenticated', user: pro, current: stored, started: true }));
  assert.equal(stageOf(stored), null);
  assert.equal(parseHint(stored).started, true);
  // A later empty or failed read never sends an active student back to day one.
  assert.equal(nextHint({ status: 'authenticated', user: pro, current: stored, started: false }), null);
  assert.equal(nextHint({ status: 'authenticated', user: pro, current: stored, started: undefined }), null);
  // Signing out drops the stage; the next sign-in on this device starts unknown again.
  stored = serializeHint(nextHint({ status: 'unauthenticated', user: null, current: stored }));
  assert.deepEqual(parseHint(stored), { kind: 'returning', plan: null, started: null });
  assert.equal(visitorState({ status: 'unauthenticated', user: null, hint: serializeHint({ kind: 'member', plan: 'free', started: false }) }).stage, null);
  assert.equal(stageOf(serializeHint(nextHint({ status: 'authenticated', user: free, current: stored }))), null);
});

test('hints hold no personal data', () => {
  const stored = serializeHint({ ...nextHint({ status: 'authenticated', user: free, current: null, started: true }), name: 'Aarav', email: 'a@b.c', id: 'u1' });
  assert.deepEqual(Object.keys(JSON.parse(stored)).sort(), ['kind', 'plan', 'started']);
});

test('the attempts summary is read strictly', () => {
  assert.equal(startedFromSummary({ items: [{ id: 'a' }], nextCursor: null }), true);
  assert.equal(startedFromSummary({ items: [], nextCursor: null }), false);
  for (const body of [null, undefined, 'x', {}, { items: 'none' }, { error: 'unavailable' }]) assert.equal(startedFromSummary(body), undefined);
});

test('an empty peek is confirmed by the finalising read before day one is believed', async () => {
  const calls = [];
  const reader = (name, body) => async () => { calls.push(name); return body; };
  const has = { items: [{ id: 'a' }] };
  const none = { items: [] };
  assert.equal(await readStarted(reader('peek', has), reader('confirm', none)), true);
  assert.deepEqual(calls, ['peek'], 'a found attempt needs no second read');
  calls.length = 0;
  assert.equal(await readStarted(reader('peek', none), reader('confirm', has)), true, 'an expired session finalised by the second read');
  assert.deepEqual(calls, ['peek', 'confirm']);
  assert.equal(await readStarted(reader('peek', none), reader('confirm', none)), false);
  assert.equal(await readStarted(reader('peek', { error: 'x' }), reader('confirm', none)), undefined, 'an unreadable peek stays unknown');
  assert.equal(await readStarted(reader('peek', none), reader('confirm', { error: 'x' })), undefined, 'an unreadable confirm stays unknown');
  await assert.rejects(() => readStarted(reader('peek', none), async () => { throw new Error('offline'); }), /offline/);
});

test('the day-one check runs only when useful, never on the test screen, and not too often', () => {
  const now = 1_000_000;
  const unknown = serializeHint({ kind: 'member', plan: 'free' });
  const first = serializeHint({ kind: 'member', plan: 'free', started: false });
  const started = serializeHint({ kind: 'member', plan: 'free', started: true });
  const args = { status: 'authenticated', hint: unknown, pathname: '/', previousPath: '', lastCheckAt: 0, now };
  assert.equal(shouldCheckStarted(args), true);
  assert.equal(shouldCheckStarted({ ...args, hint: first }), true);
  assert.equal(shouldCheckStarted({ ...args, hint: started }), false, 'started is final');
  for (const status of ['loading', 'unavailable', 'unauthenticated']) assert.equal(shouldCheckStarted({ ...args, status }), false, status);
  assert.equal(shouldCheckStarted({ ...args, pathname: '/test' }), false, 'nothing competes with a timed test');
  assert.equal(shouldCheckStarted({ ...args, pathname: '/test/nta' }), false);
  assert.equal(shouldCheckStarted({ ...args, pathname: '/testimonials' }), true, 'only the test screen itself');
  assert.equal(shouldCheckStarted({ ...args, inFlight: true }), false);
  assert.equal(shouldCheckStarted({ ...args, lastCheckAt: now - 1000 }), false, 'throttled');
  assert.equal(shouldCheckStarted({ ...args, lastCheckAt: now - STARTED_CHECK_GAP_MS }), true);
  assert.equal(shouldCheckStarted({ ...args, lastCheckAt: now - 1000, previousPath: '/test', pathname: '/result/abc' }), true, 'straight after a test, a first result was likely saved');
});

test('member copy for a free student shows the plan and credits and offers Practice', () => {
  const copy = memberCopy(visitorState({ status: 'authenticated', user: free }), free);
  assert.equal(copy.greeting, 'Welcome back, Aarav');
  assert.equal(copy.plan, 'Free plan');
  assert.equal(copy.planDetail, '8 practice credits left');
  assert.deepEqual(copy.primary, { label: 'Continue practice', href: PRACTICE_HREF });
  assert.equal(copy.secondary.href, '/pricing');
  assert.doesNotMatch(JSON.stringify(copy), /five questions|sign up|signup/i);
});

test('member copy for Pro shows the paid-through date and no upgrade pitch', () => {
  const copy = memberCopy(visitorState({ status: 'authenticated', user: pro }), pro);
  assert.equal(copy.plan, 'Pro plan');
  assert.equal(copy.planDetail, 'Active until 31 Dec 2026');
  assert.equal(copy.secondary.href, '/review');
  assert.doesNotMatch(JSON.stringify(copy), /pricing|upgrade|compare plans/i);
  assert.equal(memberCopy({ kind: 'member', plan: 'pro', name: '' }, { isPremium: true }).planDetail, 'Unlimited practice', 'no date, no invented one');
});

test('member copy copes with a missing name, one credit and no balance', () => {
  assert.equal(memberCopy({ kind: 'member', plan: 'free', name: '' }, { creditBalance: 1 }).planDetail, '1 practice credit left');
  assert.equal(memberCopy({ kind: 'member', plan: 'free', name: '' }, { id: 'x' }).planDetail, '');
  assert.equal(memberCopy({ kind: 'member', plan: 'free', name: '' }, { creditBalance: -3 }).planDetail, '0 practice credits left');
  assert.equal(memberCopy({ kind: 'member', plan: 'free', name: '' }, null).greeting, 'Welcome back');
  assert.equal(firstName({ name: '   ' }), '');
});

test('day one: a member with no scored session is welcomed and offered one action, the 10-question check', () => {
  for (const user of [free, pro]) {
    const state = { ...visitorState({ status: 'authenticated', user }), stage: 'first' };
    const copy = memberCopy(state, user);
    assert.match(copy.greeting, /^Welcome, /);
    assert.doesNotMatch(copy.greeting, /back/, 'never "welcome back" to someone brand new');
    assert.deepEqual(copy.primary, { label: 'Start your 10-question check', href: FIRST_CHECK_HREF });
    assert.equal(copy.secondary, null, 'one dominant action');
  }
  assert.equal(memberCopy({ kind: 'member', plan: 'free', name: '', stage: 'first' }, null).greeting, 'Welcome');
});

test('a test in progress outranks day one', () => {
  const resume = { href: '/test?subject=english&sessionId=s1', label: 'english test', minutesLeft: 7 };
  const copy = memberCopy({ kind: 'member', plan: 'free', name: 'Aarav', stage: 'first' }, free, resume);
  assert.equal(copy.primary.label, 'Resume your test');
  assert.equal(copy.greeting, 'Welcome, Aarav');
});

test('member copy uses no retired names, dotted meta strings, exclamation marks or em dashes', () => {
  const resume = { href: '/test?subject=english&sessionId=s1', label: 'english test', minutesLeft: 7 };
  for (const stage of [null, 'first']) for (const user of [free, pro]) for (const r of [null, resume]) {
    const text = JSON.stringify(memberCopy({ ...visitorState({ status: 'authenticated', user }), stage }, user, r));
    assert.doesNotMatch(text, /Arena|·|!|—/);
  }
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
  assert.equal(copy.secondary.href, PRACTICE_HREF);
  assert.match(copy.line, /25 min left/);
});

const member = { kind: 'member', plan: 'free', confirmed: true };
const base = { preference: null, state: member, landedOnHome: true, referrer: '', origin: 'https://www.mockmob.in', search: '', navigationType: 'navigate' };

test('D2: a confirmed member opening the site fresh goes straight to Practice by default', () => {
  assert.equal(startDestination(base), PRACTICE_HREF, 'no preference stored means Practice');
  assert.equal(startDestination({ ...base, referrer: 'https://www.google.com/' }), PRACTICE_HREF, 'a link from elsewhere is a fresh visit');
  assert.equal(startDestination({ ...base, preference: '1' }), PRACTICE_HREF, 'the old checkbox value reads as Practice');
  assert.equal(startDestination({ ...base, preference: 'garbage' }), PRACTICE_HREF);
  assert.equal(startDestination({ ...base, state: { ...member, plan: 'pro' } }), PRACTICE_HREF);
  assert.equal(startDestination({ ...base, state: { ...member, stage: 'first' } }), PRACTICE_HREF, 'day one lands on Practice too');
  const { navigationType: _omit, ...withoutType } = base;
  assert.equal(startDestination(withoutType), PRACTICE_HREF, 'no navigation timing counts as a fresh visit');
});

test('the start page setting picks Practice, Today or Home', () => {
  assert.equal(startDestination({ ...base, preference: 'practice' }), PRACTICE_HREF);
  assert.equal(startDestination({ ...base, preference: 'today' }), '/today');
  assert.equal(startDestination({ ...base, preference: 'home' }), null);
});

test('nobody else is redirected, and a request for home is respected', () => {
  assert.equal(startDestination({ ...base, state: { ...member, confirmed: false } }), null, 'unconfirmed session (loading or unreachable)');
  assert.equal(startDestination({ ...base, state: { kind: 'returning', confirmed: true } }), null, 'signed out visitors are never redirected');
  assert.equal(startDestination({ ...base, state: { kind: 'new', confirmed: true } }), null);
  assert.equal(startDestination({ ...base, state: null }), null);
  assert.equal(startDestination({ ...base, landedOnHome: false }), null, 'the logo inside the app means home');
  assert.equal(startDestination({ ...base, referrer: 'https://www.mockmob.in/pricing' }), null, 'came from a MockMob page');
  assert.equal(startDestination({ ...base, search: '?home' }), null, 'the ?home override');
  assert.equal(startDestination({ ...base, search: '?home=1&utm_source=x' }), null);
  assert.equal(startDestination({ ...base, referrer: 'garbage' }), null);
  assert.equal(startDestination({ ...base, navigationType: 'reload' }), null, 'reloading the home page keeps it');
  assert.equal(startDestination({ ...base, navigationType: 'back_forward' }), null, 'coming back to home with the back button keeps it');
});

test('a confirmed "stay on home" decision latches, so the logo does not bounce the student to Practice later', () => {
  // The page script keeps one latch per document load; this plays the sequence it sees.
  let latched = false;
  const decide = (input) => {
    const plan = startRedirectPlan({ latched, ...input });
    if (plan.latch) latched = true;
    return plan.destination;
  };
  assert.equal(decide({ ...base, search: '?home' }), null, 'the first load asked for home');
  assert.equal(latched, true);
  // In the app, then the logo: the external referrer is unchanged but the load is the same document.
  assert.equal(decide({ ...base, referrer: 'https://www.google.com/' }), null, 'logo after an earlier ?home load stays home');
  // The same holds for a reload-type or Home-as-start-page decision.
  latched = false;
  assert.equal(decide({ ...base, preference: 'home' }), null);
  assert.equal(decide({ ...base }), null, 'a later visit to / in the same document is not a fresh visit');
});

test('an unconfirmed session decides nothing and does not latch; a fresh confirmed visit still redirects once', () => {
  assert.deepEqual(startRedirectPlan({ ...base, state: { ...member, confirmed: false } }), { latch: false, destination: null });
  assert.deepEqual(startRedirectPlan({ ...base }), { latch: true, destination: PRACTICE_HREF });
  assert.deepEqual(startRedirectPlan({ ...base, latched: true }), { latch: false, destination: null });
});

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)); }, removeItem: (k) => { map.delete(k); } };
}

test('the start page is read with a safe default and saved only when the browser keeps it', () => {
  assert.deepEqual(START_ON_OPTIONS.map((o) => o.id), ['practice', 'today', 'home']);
  assert.equal(DEFAULT_START_ON, 'practice');
  assert.equal(parseStartOn(undefined), 'practice');
  assert.deepEqual(readStartOn(memoryStorage()), { value: 'practice', available: true });
  assert.deepEqual(readStartOn(memoryStorage({ [START_ON_KEY]: 'today' })), { value: 'today', available: true });
  assert.deepEqual(readStartOn(null), { value: 'practice', available: false });
  assert.deepEqual(readStartOn({ getItem: () => { throw new Error('blocked'); } }), { value: 'practice', available: false });

  const storage = memoryStorage({ [ARENA_FIRST_KEY]: '1' });
  assert.equal(writeStartOn(storage, 'home'), true);
  assert.equal(storage.getItem(START_ON_KEY), 'home');
  assert.equal(storage.getItem(ARENA_FIRST_KEY), null, 'the old checkbox key is cleared');
  assert.equal(writeStartOn(storage, 'arena'), false, 'unknown pages are refused');
  assert.equal(storage.getItem(START_ON_KEY), 'home');
  assert.equal(writeStartOn({ setItem: () => { throw new Error('quota'); }, getItem: () => null, removeItem: () => {} }, 'today'), false);
  assert.equal(writeStartOn({ setItem: () => {}, getItem: () => null, removeItem: () => {} }, 'today'), false, 'a write that did not stick is not reported as saved');
});

function bootWith(stored, { throws = false, before = {} } = {}) {
  const documentElement = { dataset: { ...before } };
  const localStorage = { getItem: (key) => { if (throws) throw new Error('blocked'); assert.equal(key, VISITOR_KEY); return stored; } };
  vm.runInNewContext(VISITOR_BOOT_SCRIPT, { document: { documentElement }, localStorage });
  return documentElement.dataset;
}

test('the boot script sets the visitor kind and plan before first paint and never throws', () => {
  assert.deepEqual({ ...bootWith(null) }, { visitor: 'new', visitorPlan: 'free' });
  assert.deepEqual({ ...bootWith(serializeHint({ kind: 'returning' })) }, { visitor: 'returning', visitorPlan: 'free' });
  assert.deepEqual({ ...bootWith(serializeHint({ kind: 'member', plan: 'pro' })) }, { visitor: 'member', visitorPlan: 'pro' });
  assert.deepEqual({ ...bootWith(serializeHint({ kind: 'member', plan: 'free' })) }, { visitor: 'member', visitorPlan: 'free' });
  assert.deepEqual({ ...bootWith('{"kind":"admin","plan":"pro"}') }, { visitor: 'new', visitorPlan: 'free' });
  assert.deepEqual({ ...bootWith('{"kind":"returning","plan":"pro"}') }, { visitor: 'returning', visitorPlan: 'free' }, 'only a member can be pro');
  assert.deepEqual({ ...bootWith('garbage') }, { visitor: 'new', visitorPlan: 'free' });
  assert.deepEqual({ ...bootWith(null, { throws: true }) }, { visitor: 'new', visitorPlan: 'free' });
});

test('the boot script marks day one only for a member known to have no scored session', () => {
  assert.deepEqual({ ...bootWith(serializeHint({ kind: 'member', plan: 'free', started: false })) }, { visitor: 'member', visitorPlan: 'free', visitorStage: 'first' });
  assert.deepEqual({ ...bootWith(serializeHint({ kind: 'member', plan: 'pro', started: false })) }, { visitor: 'member', visitorPlan: 'pro', visitorStage: 'first' });
  assert.equal(bootWith(serializeHint({ kind: 'member', plan: 'free', started: true })).visitorStage, undefined);
  assert.equal(bootWith(serializeHint({ kind: 'member', plan: 'free' })).visitorStage, undefined, 'unknown is not day one');
  assert.equal(bootWith('{"kind":"returning","started":false}').visitorStage, undefined);
  assert.equal(bootWith(null, { before: { visitorStage: 'first' } }).visitorStage, undefined, 'a stale attribute is cleared');
  assert.equal(bootWith(null, { throws: true, before: { visitorStage: 'first' } }).visitorStage, undefined);
});

test('the boot script and parseHint agree on every stored value', () => {
  for (const raw of [null, 'x', '{"kind":"member"}', '{"kind":"member","plan":"pro"}', '{"kind":"member","plan":"gold"}', '{"kind":"returning"}', '{"kind":"new"}', '{"kind":"owner"}',
    '{"kind":"member","started":false}', '{"kind":"member","plan":"pro","started":true}', '{"kind":"member","started":"false"}', '{"kind":"member","started":0}']) {
    const parsed = parseHint(raw);
    const booted = bootWith(raw);
    assert.equal(booted.visitor, parsed.kind, String(raw));
    assert.equal(booted.visitorPlan, parsed.plan === 'pro' ? 'pro' : 'free', String(raw));
    assert.equal(booted.visitorStage ?? null, stageOf(raw), String(raw));
  }
});

test('signing out forgets the start page (and the old checkbox) and tolerates blocked storage', () => {
  const removed = [];
  forgetStartOn({ removeItem: (key) => removed.push(key) });
  assert.deepEqual(removed, [START_ON_KEY, ARENA_FIRST_KEY]);
  assert.equal(forgetArenaFirst, forgetStartOn, 'AuthProvider still calls the old name');
  assert.doesNotThrow(() => forgetStartOn({ removeItem: () => { throw new Error('blocked'); } }));
  assert.doesNotThrow(() => forgetStartOn(null));
});
