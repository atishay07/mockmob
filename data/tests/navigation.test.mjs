import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APP_GROUPS, APP_PRIMARY, AUDIENCE_CLASS, DU_PLANNING_LINKS, FIRST_CHECK_HREF, FOOTER_COLUMNS, FOOTER_MEMBER_LINKS, HEADER_ACTIONS,
  PRACTICE_HREF, PUBLIC_NAV, RESOURCE_LINKS, accountMenu, allDestinations, appNavigation, audienceIncludes, fullLabel,
  headerActionsFor, isActivePath, memberPrimaryAction, planLine, publicNavFor, shellGate, startActions, titleForPath, visitorStateId,
} from '../../src/lib/navigation.js';

const S1 = { kind: 'new' };
const S2 = { kind: 'returning' };
const S3 = { kind: 'member', plan: 'free', stage: 'first' };
const S4 = { kind: 'member', plan: 'free' };
const S5 = { kind: 'member', plan: 'pro' };
const STATES = { S1, S2, S3, S4, S5 };
const resume = { href: '/test?subject=accountancy&count=10', minutesLeft: 23, label: 'accountancy test' };

// Every user-visible string the navigation source holds.
function labels() {
  const out = [];
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === 'object') {
      for (const key of ['label', 'detail', 'descriptor', 'tag']) if (typeof value[key] === 'string') out.push(value[key]);
      Object.values(value).forEach((child) => { if (child && typeof child === 'object') walk(child); });
    }
  };
  walk([PUBLIC_NAV, HEADER_ACTIONS, FOOTER_COLUMNS, FOOTER_MEMBER_LINKS, APP_PRIMARY, APP_GROUPS]);
  walk(startActions({ resume, plan: 'free' }));
  walk(accountMenu({ plan: 'free', guide: true }));
  walk(accountMenu({ plan: 'pro', guide: true }));
  return out;
}

test('states map to the plan ids', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(STATES).map(([id, v]) => [id, visitorStateId(v)])), { S1: 'S1', S2: 'S2', S3: 'S3', S4: 'S4', S5: 'S5' });
  assert.equal(visitorStateId(), 'S1');
});

test('D1: nothing a visitor reads says Arena', () => {
  for (const label of labels()) assert.doesNotMatch(label, /arena/i, label);
});

test('copy rules: no exclamation marks, em dashes, middle dots or appended arrows in labels', () => {
  for (const label of labels()) {
    assert.doesNotMatch(label, /[!—·→↗]/, label);
    assert.equal(label.trim(), label);
  }
});

test('public header: at most five top-level items for every state', () => {
  for (const [id, visitor] of Object.entries(STATES)) {
    const items = publicNavFor(visitor);
    assert.ok(items.length <= 5, `${id} sees ${items.length}`);
    assert.ok(items.length >= 4, `${id} sees ${items.length}`);
  }
});

test('public header: guests see the free test first, members see Practice first and Review third', () => {
  for (const visitor of [S1, S2]) {
    assert.deepEqual(publicNavFor(visitor).map((item) => item.id), ['free-test', 'du', 'what-you-get', 'pricing', 'resources']);
  }
  for (const visitor of [S3, S4]) {
    assert.deepEqual(publicNavFor(visitor).map((item) => item.id), ['practice', 'du', 'review', 'pricing', 'resources']);
  }
  assert.equal(publicNavFor(S4)[0].href, PRACTICE_HREF);
});

test('D12: Pricing is in the header for S1 to S4 and hidden for Pro', () => {
  for (const visitor of [S1, S2, S3, S4]) assert.ok(publicNavFor(visitor).some((item) => item.id === 'pricing'));
  assert.ok(!publicNavFor(S5).some((item) => item.id === 'pricing'));
});

test('public groups keep every page the old header and sheet reached', () => {
  const hrefs = new Set([...PUBLIC_NAV, ...DU_PLANNING_LINKS, ...RESOURCE_LINKS].map((item) => item.href).filter(Boolean));
  for (const href of ['/cuet-mock-test-free', '/cuet-cutoff-calculator', '/#your-prep', '/cuet-previous-year-questions', '/pricing', '/about']) {
    assert.ok(hrefs.has(href), href);
  }
});

test('header actions: one primary per state, and the right one', () => {
  const primary = (visitor, r = null) => headerActionsFor(visitor, r).filter((a) => a.variant === 'primary');
  for (const [id, visitor] of Object.entries(STATES)) assert.equal(primary(visitor).length, 1, id);
  assert.deepEqual(headerActionsFor(S1).map((a) => [a.label, a.variant]), [['Log in', 'text'], ['Start free', 'primary']]);
  assert.deepEqual(headerActionsFor(S2).map((a) => [a.label, a.variant]), [['Start free', 'text'], ['Log in', 'primary']]);
  assert.deepEqual(headerActionsFor(S3).map((a) => a.label), ['Start your first check']);
  assert.deepEqual(headerActionsFor(S4).map((a) => a.label), ['Continue practice']);
  assert.deepEqual(headerActionsFor(S5).map((a) => a.label), ['Continue practice']);
  assert.deepEqual(headerActionsFor(S4, resume).map((a) => [a.label, a.href]), [['Resume your test', resume.href]]);
  // A member never sees a Start free pitch.
  for (const visitor of [S3, S4, S5]) assert.ok(!headerActionsFor(visitor).some((a) => a.label === 'Start free'));
});

test('the dock action for a member', () => {
  assert.deepEqual(memberPrimaryAction({}), { id: 'continue', label: 'Continue practice', href: PRACTICE_HREF });
  assert.equal(memberPrimaryAction({ stage: 'first' }).href, FIRST_CHECK_HREF);
  assert.equal(memberPrimaryAction({ stage: 'first', resume }).label, 'Resume your test');
});

test('audience classes exist in visitor.css and agree with audienceIncludes', () => {
  const css = readFileSync(new URL('../../src/app/visitor.css', import.meta.url), 'utf8');
  for (const tokens of Object.values(AUDIENCE_CLASS)) {
    for (const token of tokens.split(/\s+/).filter(Boolean)) assert.ok(css.includes(`.${token}`), token);
  }
  assert.equal(audienceIncludes('guest', S2), true);
  assert.equal(audienceIncludes('guest', S4), false);
  assert.equal(audienceIncludes('notPro', S5), false);
  assert.equal(audienceIncludes('notPro', S4), true);
  assert.equal(audienceIncludes('memberFirst', S3), true);
  assert.equal(audienceIncludes('memberFirst', S4), false);
  assert.equal(audienceIncludes('memberStarted', S3), false);
  assert.equal(audienceIncludes('memberStarted', S5), true);
  assert.equal(audienceIncludes('newGuest', S1), true);
  assert.equal(audienceIncludes('newGuest', S2), false);
  // A stage flag on someone signed out means nothing.
  assert.equal(audienceIncludes('memberFirst', { kind: 'returning', stage: 'first' }), false);
});

test('D3: Practice first, Today second, Review third; Learn only with study content', () => {
  assert.deepEqual(appNavigation().primary.map((item) => item.label), ['Practice', 'Today', 'Review']);
  assert.deepEqual(appNavigation({ studyEnabled: true }).primary.map((item) => item.label), ['Practice', 'Today', 'Review', 'Learn']);
  assert.ok(appNavigation({ studyEnabled: true }).primary.length <= 4);
  assert.equal(appNavigation().primary[0].href, PRACTICE_HREF);
});

test('signed-in menu keeps every destination the old menu had (account things move to the account menu)', () => {
  const ids = new Set(allDestinations(appNavigation({ studyEnabled: true, moderator: true })).map((item) => item.id));
  for (const id of ['today', 'dashboard', 'learn', 'review', 'explore', 'saved', 'progress', 'analytics', 'admission-compass', 'mentor', 'leaderboard', 'upload', 'my-uploads', 'moderation']) {
    assert.ok(ids.has(id), id);
  }
  assert.ok(ids.has('rival'), 'D11: the practice rival is reachable under More');
  assert.ok(accountMenu().some((item) => item.href === '/profile'));
});

test('signed-in menu: moderation only for moderators, the assistant hidden during a test', () => {
  assert.ok(!appNavigation().groups.some((group) => group.id === 'moderation'));
  assert.equal(appNavigation({ moderator: true }).groups[0].id, 'moderation');
  const inTest = allDestinations(appNavigation({ testRoute: true })).map((item) => item.id);
  assert.ok(!inTest.includes('mentor'));
  assert.ok(allDestinations(appNavigation()).some((item) => item.id === 'mentor'));
});

test('D10 and D11: plain names first with the brand as descriptor; Study tools and More fold away', () => {
  const all = allDestinations(appNavigation());
  const byId = Object.fromEntries(all.map((item) => [item.id, item]));
  assert.equal(fullLabel(byId.analytics), 'Weak chapters (Radar)');
  assert.equal(fullLabel(byId.mentor), 'Ask about your record (PrepOS)');
  assert.equal(byId['admission-compass'].label, 'DU Compass');
  assert.equal(byId.leaderboard.label, 'Leaderboard');
  for (const item of all) assert.ok(!['Radar', 'PrepOS', 'Ranks', 'Compass'].includes(item.label), item.label);
  const groups = Object.fromEntries(appNavigation().groups.map((group) => [group.id, group]));
  assert.equal(groups.plan.collapsed, undefined);
  assert.equal(groups.tools.collapsed, true);
  assert.equal(groups.more.collapsed, true);
  assert.deepEqual(groups.more.items.map((item) => item.label), ['Leaderboard', 'Contribute', 'My uploads', 'Practice rival']);
});

test('active path matches the route and below, never a longer word or a query', () => {
  const review = { href: '/review' };
  assert.equal(isActivePath('/review', review), true);
  assert.equal(isActivePath('/review/abc', review), true);
  assert.equal(isActivePath('/reviewer', review), false);
  assert.equal(isActivePath('/dashboard', { href: '/dashboard?mode=full' }), true);
  assert.equal(isActivePath('/', { href: '/' }), false);
  assert.equal(isActivePath('', review), false);
});

test('top bar title', () => {
  const nav = appNavigation();
  assert.equal(titleForPath('/dashboard', nav), 'Practice');
  assert.equal(titleForPath('/analytics', nav), 'Weak chapters');
  assert.equal(titleForPath('/result/123', nav), 'Result');
  assert.equal(titleForPath('/something', nav), '');
});

test('Start sheet: resume leads when it exists, NTA carries a Pro tag only for free members', () => {
  const free = startActions({ plan: 'free', recoveryAvailable: false });
  assert.deepEqual(free.map((a) => a.id), ['quick', 'full', 'repair', 'nta']);
  assert.equal(free.find((a) => a.id === 'nta').tag, 'Pro');
  assert.equal(free.find((a) => a.id === 'repair').href, '/review');
  assert.equal(startActions({ plan: 'free', recoveryAvailable: true }).find((a) => a.id === 'repair').href, '/recovery');
  assert.equal(startActions({ plan: 'pro' }).find((a) => a.id === 'nta').tag, null);
  const withResume = startActions({ resume, plan: 'free' });
  assert.equal(withResume[0].id, 'resume');
  assert.equal(withResume[0].href, resume.href);
  assert.match(withResume[0].detail, /23 min left/);
  for (const action of free) assert.ok(action.href.startsWith('/'), action.href);
  assert.equal(free.find((a) => a.id === 'quick').href, '/dashboard?mode=quick&count=10');
});

test('account menu: free members get Go Pro, Pro members get plan status and no upgrade', () => {
  const free = accountMenu({ plan: 'free' });
  assert.ok(free.some((item) => item.id === 'upgrade'));
  assert.equal(free.find((item) => item.id === 'plan').label, 'Plan and credits');
  const pro = accountMenu({ plan: 'pro' });
  assert.ok(!pro.some((item) => item.id === 'upgrade' || item.href === '/pricing'));
  assert.equal(pro.find((item) => item.id === 'plan').label, 'Plan status');
  assert.ok(!free.some((item) => item.id === 'guide'));
  assert.ok(accountMenu({ guide: true }).some((item) => item.id === 'guide'));
  assert.ok(free.some((item) => item.id === 'start-on'));
});

test('plan line is written plainly and only from a confirmed account', () => {
  assert.equal(planLine(null), '');
  assert.equal(planLine({ isPremium: false }), 'Free plan');
  assert.equal(planLine({ isPremium: false, creditBalance: 1 }), 'Free plan, 1 practice credit left');
  assert.equal(planLine({ isPremium: false, creditBalance: 40 }), 'Free plan, 40 practice credits left');
  assert.equal(planLine({ isPremium: false, creditBalance: -3 }), 'Free plan, 0 practice credits left');
  assert.equal(planLine({ isPremium: true }), 'Pro');
  assert.equal(planLine({ isPremium: true, premiumUntil: 'not a date' }), 'Pro');
  assert.match(planLine({ isPremium: true, premiumUntil: '2027-07-31T10:00:00Z' }), /^Pro until 31 Jul 2027$/);
});

test('auth gate: the shell never waits for the check, and only a confirmed sign-out redirects', () => {
  assert.equal(shellGate({ status: 'loading' }), 'pending');
  assert.equal(shellGate({}), 'pending');
  assert.equal(shellGate({ status: 'authenticated', path: '/dashboard' }), 'ready');
  assert.equal(shellGate({ status: 'unauthenticated', path: '/dashboard' }), 'signedOut');
  assert.equal(shellGate({ status: 'unavailable', path: '/today' }), 'unavailable');
  assert.equal(shellGate({ status: 'authenticated', path: '/moderation', moderator: false }), 'checking');
  assert.equal(shellGate({ status: 'authenticated', path: '/moderation/queue', moderator: true }), 'ready');
  // The moderation check waits for a confirmed session; it never decides from a hint.
  assert.equal(shellGate({ status: 'loading', path: '/moderation', moderator: false }), 'pending');
});
