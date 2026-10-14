import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APP_GROUPS, APP_PRIMARY, AUDIENCE_CLASS, DU_PLANNING_LINKS, FIRST_CHECK_HREF, FOOTER_COLUMNS, FOOTER_MEMBER_LINKS, HEADER_ACTIONS,
  PRACTICE_HREF, PUBLIC_NAV, RESOURCE_LINKS, accountMenu, allDestinations, appNavigation, audienceClass, audienceIncludes, fullLabel,
  headerActionsFor, isActivePath, memberDockActions, memberPrimaryAction, planLine, publicNavFor, renderedHeaderActions, shellGate,
  startActions, titleForPath, visitorStateId,
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
  // A saved test wins over Start your first check too (S3 plus resume), the same as the dock.
  assert.deepEqual(headerActionsFor(S3, resume).map((a) => [a.label, a.href]), [['Resume your test', resume.href]]);
  assert.deepEqual(headerActionsFor(S5, resume).map((a) => a.label), ['Resume your test']);
  // A saved test does not change what a guest sees.
  assert.deepEqual(headerActionsFor(S1, resume).map((a) => a.label), ['Log in', 'Start free']);
  // A member never sees a Start free pitch.
  for (const visitor of [S3, S4, S5]) assert.ok(!headerActionsFor(visitor).some((a) => a.label === 'Start free'));
});

test('the dock action for a member', () => {
  assert.deepEqual(
    { ...memberPrimaryAction({}) },
    { id: 'continue', label: 'Continue practice', href: PRACTICE_HREF, show: 'memberStarted' },
  );
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

// ---- What ships: the pages render every variant and visitor.css hides the ones a state should
// not see, so evaluate the real CSS for each state and compare it with the data helpers above.

const visitorCss = readFileSync(new URL('../../src/app/visitor.css', import.meta.url), 'utf8');

// The attributes <html> carries for each state (see VisitorSync and the inline script).
const HTML_ATTRS = {
  S1: { 'data-visitor': 'new' },
  S2: { 'data-visitor': 'returning' },
  S3: { 'data-visitor': 'member', 'data-visitor-plan': 'free', 'data-visitor-stage': 'first' },
  S4: { 'data-visitor': 'member', 'data-visitor-plan': 'free' },
  S5: { 'data-visitor': 'member', 'data-visitor-plan': 'pro' },
};

// Rules of the form `html[a='x']:not([b='y']) .cls, ... { display: none !important; }`.
function hidingRules() {
  const rules = [];
  const block = /([^{}]+)\{\s*display:\s*none\s*!important;?\s*\}/g;
  for (const [, selectors] of visitorCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(block)) {
    for (const selector of selectors.split(',').map((part) => part.trim()).filter(Boolean)) {
      const match = selector.match(/^html((?:\[[^\]]+\]|:not\(\[[^\]]+\]\))*)\s+\.([\w-]+)$/);
      if (!match) continue;
      const conditions = [...match[1].matchAll(/(:not\()?\[([\w-]+)='([^']*)'\]\)?/g)]
        .map(([, negated, attr, value]) => ({ negated: Boolean(negated), attr, value }));
      rules.push({ cls: match[2], conditions });
    }
  }
  return rules;
}

function hiddenBy(cssClasses, attrs, rules) {
  return cssClasses.some((cls) => rules.some((rule) => rule.cls === cls
    && rule.conditions.every(({ negated, attr, value }) => (attrs[attr] === value) !== negated)));
}

function visibleUnder(show, stateId, rules) {
  return !hiddenBy(audienceClass(show).split(/\s+/).filter(Boolean), HTML_ATTRS[stateId], rules);
}

test('visitor.css hides exactly what audienceIncludes says, for every audience and state', () => {
  const rules = hidingRules();
  assert.ok(rules.length >= 5, `parsed ${rules.length} rules`);
  for (const show of Object.keys(AUDIENCE_CLASS)) {
    for (const [id, visitor] of Object.entries(STATES)) {
      assert.equal(visibleUnder(show, id, rules), audienceIncludes(show, visitor), `${show} in ${id}`);
    }
  }
  // Every class the source hands out has a rule, except the one that is never hidden.
  const used = new Set(Object.values(AUDIENCE_CLASS).flatMap((tokens) => tokens.split(/\s+/).filter(Boolean)));
  for (const cls of used) assert.ok(rules.some((rule) => rule.cls === cls), `no rule for ${cls}`);
});

test('shipped header: the items CSS leaves visible are the ones publicNavFor lists, at most five', () => {
  const rules = hidingRules();
  for (const [id, visitor] of Object.entries(STATES)) {
    const shown = PUBLIC_NAV.filter((item) => visibleUnder(item.show, id, rules)).map((item) => item.id);
    assert.deepEqual(shown, publicNavFor(visitor).map((item) => item.id), id);
    assert.ok(shown.length <= 5, `${id} sees ${shown.length}`);
  }
});

test('shipped header actions and dock: exactly one primary action is visible per state, with or without a saved test', () => {
  const rules = hidingRules();
  for (const savedTest of [null, resume]) {
    for (const [id, visitor] of Object.entries(STATES)) {
      const shown = renderedHeaderActions(savedTest).filter((action) => visibleUnder(action.show, id, rules));
      assert.deepEqual(shown.map((a) => a.id), headerActionsFor(visitor, savedTest).map((a) => a.id), `${id} header`);
      assert.equal(shown.filter((a) => a.variant === 'primary').length, 1, `${id} header primary`);
      if (visitor.kind !== 'member') continue;
      const dock = memberDockActions(savedTest).filter((action) => visibleUnder(action.show, id, rules));
      assert.equal(dock.length, 1, `${id} dock`);
      assert.deepEqual(dock[0], memberPrimaryAction({ stage: visitor.stage, resume: savedTest }), `${id} dock action`);
      // Header and dock agree on the member's one action.
      assert.equal(shown[0].label, dock[0].label, `${id} header and dock`);
      assert.equal(shown[0].href, dock[0].href, `${id} header and dock href`);
    }
  }
});

test('the navigation test runs in test:visitor', () => {
  const scripts = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts;
  assert.match(scripts['test:visitor'], /data\/tests\/navigation\.test\.mjs/);
});

test('the account menu names the setting Start on, and the guide hands focus back to the account trigger', () => {
  assert.ok(accountMenu({ plan: 'free', guide: true }).some((item) => item.id === 'start-on' && item.label === 'Start on'));
  const menu = readFileSync(new URL('../../src/components/shell/AccountMenu.jsx', import.meta.url), 'utf8');
  assert.match(menu, /onGuide\?\.\(back\)/, 'the Guide row passes the trigger it captured before the menu closes');
  const tour = readFileSync(new URL('../../src/components/shell/GuideTour.jsx', import.meta.url), 'utf8');
  assert.match(tour, /returnRef\.current = typeof HTMLElement/, 'start() keeps the element it was given');
});
