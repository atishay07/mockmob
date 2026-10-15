import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUDIENCE_CLASS, DEFAULT_START_ON, FOOTER_COLUMNS, HEADER_ACTIONS, NON_AFFILIATION_LINE, PLACES, PLACE_CONTENTS, PUBLIC_DOCK, PUBLIC_NAV,
  START_ON_OPTIONS, START_SHEET_FOOTER, allNavigationHrefs, allNavigationLabels, audienceClass, audienceIncludes, chromeFor, headerActionsFor,
  isActivePlace, isSignedInPath, legacyArenaNavigation, parseVisitorHint, placeContents, placeForPath, publicNavFor, reviewBadge, shellGate,
  shellItems, shellLayout, startActions, startOnHref, startRowFromQuery, titleForPath, visitorStateId,
} from '../../src/lib/navigation.js';
import { STUDY_NAV, MOBILE_STUDY_NAV, arenaNavigation } from '../../src/lib/arenaNavigation.js';
import { retiredTermIn } from '../glossary.mjs';
import { nextMove } from '../next_step_rules.mjs';
import { PUBLIC_SUBJECTS } from '../subject_art.mjs';
import { CUET_PUBLIC_ALLOWED_SUBJECTS } from '../cuet_controls.js';
import { ROUTE_MOVES } from '../route_moves.mjs';
import { appPageRoutes, resolvesHref } from './ia_helpers.mjs';

const S1 = { kind: 'new' };
const S2 = { kind: 'returning' };
const S3 = { kind: 'member', plan: 'free', stage: 'first' };
const S4 = { kind: 'member', plan: 'free' };
const S5 = { kind: 'member', plan: 'pro' };

test('visitor states map to the plan ids, and a corrupt hint is a new visitor', () => {
  assert.deepEqual([S1, S2, S3, S4, S5].map(visitorStateId), ['S1', 'S2', 'S3', 'S4', 'S5']);
  assert.deepEqual(parseVisitorHint('{bad'), { kind: 'new', plan: null, started: null });
  assert.deepEqual(parseVisitorHint('{"kind":"member","plan":"pro","started":false}'), { kind: 'member', plan: 'pro', started: false });
  assert.equal(audienceClass('nope'), '');
  assert.ok(Object.values(AUDIENCE_CLASS).every((c) => typeof c === 'string'));
});

test('phone bar: exactly 5 slots in the app order, Start in the middle; rail and sidebar lead with Start', () => {
  assert.deepEqual(shellItems('phone').map((i) => i.id), ['today', 'practice', 'start', 'review', 'you']);
  assert.deepEqual(shellItems('rail').map((i) => i.id), ['start', 'today', 'practice', 'review', 'you']);
  assert.deepEqual(shellItems('sidebar').map((i) => i.id), ['start', 'today', 'practice', 'review', 'you']);
  assert.equal(shellLayout(375), 'phone');
  assert.equal(shellLayout(767), 'phone');
  assert.equal(shellLayout(768), 'rail');
  assert.equal(shellLayout(1023), 'rail');
  assert.equal(shellLayout(1024), 'sidebar');
  assert.equal(shellItems('phone').find((i) => i.id === 'start').action, 'start-sheet');
  assert.ok(shellItems('phone').every((i) => i.label), 'never icon only');
});

test('every old signed-in route is reachable within 2 clicks from a place', () => {
  const reachable = new Set();
  for (const id of Object.keys(PLACES)) {
    reachable.add(PLACES[id].href.split(/[?#]/)[0]);
    for (const item of placeContents(id, { studyEnabled: true, moderator: true })) if (item.href) reachable.add(item.href.split(/[?#]/)[0]);
  }
  const oldSignedIn = ['/today', '/dashboard', '/review', '/analytics', '/saved', '/mentor', '/explore', '/learn', '/profile', '/admission-compass',
    '/leaderboard', '/upload', '/moderation', '/onboarding'];
  for (const path of oldSignedIn) assert.ok(reachable.has(path), path);
  // Redirected or folded pages land on a reachable page.
  for (const [from, to] of [['/progress', '/you'], ['/my-uploads', '/upload'], ['/recovery', '/review']]) {
    assert.ok(reachable.has(to), `${from} -> ${to}`);
    assert.ok(ROUTE_MOVES.find((m) => m.from === from && m.action === 'redirect'));
  }
});

test('Concepts only with the study flags; Moderation only for moderators', () => {
  assert.ok(!placeContents('practice').some((i) => i.id === 'learn'));
  assert.ok(placeContents('practice', { studyEnabled: true }).some((i) => i.id === 'learn'));
  assert.ok(!placeContents('you').some((i) => i.id === 'moderation'));
  assert.ok(placeContents('you', { moderator: true }).some((i) => i.id === 'moderation'));
});

test('active place and titles follow the plan: results open over Review, the runner is focus mode', () => {
  assert.equal(placeForPath('/result/abc'), 'review');
  assert.ok(isActivePlace('/analytics', 'review'));
  assert.ok(isActivePlace('/dashboard?mode=full', 'practice'));
  assert.ok(isActivePlace('/admission-compass', 'you'));
  assert.equal(placeForPath('/test'), null);
  assert.equal(chromeFor('/test?mode=nta'), 'focus');
  assert.equal(chromeFor('/today'), 'full');
  assert.equal(titleForPath('/analytics'), 'Your record');
  assert.equal(titleForPath('/explore'), 'Question stream');
  assert.equal(titleForPath('/today'), 'Today');
  assert.equal(titleForPath('/result/x'), 'Result');
});

test('badges show real counts only, capped at 9+', () => {
  assert.equal(reviewBadge(0), null);
  assert.equal(reviewBadge(undefined), null);
  assert.equal(reviewBadge(4), '4');
  assert.equal(reviewBadge(9), '9');
  assert.equal(reviewBadge(12), '9+');
});

test('shellGate: nothing private before the session is confirmed', () => {
  assert.equal(shellGate({ status: 'loading' }), 'pending');
  assert.equal(shellGate({ status: 'authenticated' }), 'ready');
  assert.equal(shellGate({ status: 'authenticated', path: '/moderation' }), 'checking');
  assert.equal(shellGate({ status: 'authenticated', path: '/moderation', moderator: true }), 'ready');
  assert.equal(shellGate({ status: 'unauthenticated' }), 'signedOut');
  assert.equal(shellGate({ status: 'unavailable' }), 'unavailable');
});

test('Start sheet: at most 5 rows, hero first, a confirm line with the cost, nothing spent on the first tap', () => {
  const move = nextMove({ now: '2026-10-15T14:30:00Z', practiceCredits: 40, subjects: ['accountancy'], attempts: [] });
  const rows = startActions({ move, plan: 'free', balance: 40, aiBalance: 9, subjects: ['accountancy', 'economics'], repairAttemptId: 'att-7', mistakeRepair: true });
  assert.ok(rows.length <= 5);
  assert.deepEqual(rows.map((r) => r.id), ['move', 'quick', 'full', 'nta', 'repair']);
  assert.ok(rows[0].hero);
  assert.equal(rows.find((r) => r.id === 'quick').confirm, '10 questions, about 10 minutes. +5 right, -1 wrong. Uses 10 of your 40 practice credits.');
  assert.deepEqual(rows.find((r) => r.id === 'quick').chips.map((c) => c.label), ['Accountancy', 'Economics']);
  assert.equal(rows.find((r) => r.id === 'nta').tag, 'Pro');
  assert.equal(rows.find((r) => r.id === 'repair').confirm, '1 AI credit each. You have 9.');
  assert.equal(rows.find((r) => r.id === 'repair').href, '/result/att-7');
  // Every row goes to a setup or result page; none starts a session or charges by itself.
  for (const row of rows) assert.doesNotMatch(row.href, /^\/test|^\/api\//, row.id);
  const resumeRows = startActions({ resume: { href: '/test?sessionId=s1', label: 'Resume Accountancy mock, 23 of 50', minutesLeft: 31 }, plan: 'pro', mistakeRepair: false });
  assert.equal(resumeRows[0].id, 'resume');
  assert.equal(resumeRows.find((r) => r.id === 'nta').tag, null);
  assert.ok(!resumeRows.some((r) => r.id === 'repair'), 'no repair row while Mistake Repair is off');
  assert.equal(START_SHEET_FOOTER.label, 'Choose your own in Practice');
  assert.equal(startRowFromQuery('quick'), 'quick');
  assert.equal(startRowFromQuery('<script>'), null);
});

test('public header: guests see How it works, Subjects, Free tools, Pricing; members get Open MockMob', () => {
  for (const v of [S1, S2]) assert.deepEqual(publicNavFor(v).map((i) => i.id), ['how', 'subjects', 'tools', 'pricing']);
  assert.deepEqual(publicNavFor(S4).map((i) => i.id), ['tools', 'pricing']);
  assert.deepEqual(publicNavFor(S5).map((i) => i.id), ['tools'], 'Pricing hidden for Pro');
  assert.deepEqual(headerActionsFor(S1).map((a) => `${a.label}:${a.variant}`), ['Log in:text', 'Start free:primary']);
  assert.deepEqual(headerActionsFor(S2).map((a) => `${a.label}:${a.variant}`), ['Start free:text', 'Log in:primary']);
  assert.deepEqual(headerActionsFor(S4).map((a) => `${a.label}:${a.href}`), ['Open MockMob:/today']);
  assert.ok(audienceIncludes('notPro', S4) && !audienceIncludes('notPro', S5));
  assert.equal(PUBLIC_DOCK.label, 'Try 5 questions');
  assert.equal(PUBLIC_DOCK.href, '/#try');
});

test('public chrome never links a guest into a signed-in page', () => {
  const guestHrefs = [...PUBLIC_NAV.flatMap((i) => [i.href, ...(i.items || []).map((s) => s.href)]), PUBLIC_DOCK.href,
    ...HEADER_ACTIONS.filter((a) => a.show !== 'member').map((a) => a.href), ...FOOTER_COLUMNS.flatMap((c) => c.links.map((l) => l.href))].filter(Boolean);
  for (const href of guestHrefs) assert.equal(isSignedInPath(href), false, href);
  assert.ok(isSignedInPath('/dashboard'));
  assert.ok(isSignedInPath('/admission-compass'));
  assert.ok(isSignedInPath('/result/abc'));
});

test('footer: all 15 subjects (hubs where they exist), the guides, the tools and the non-affiliation line', () => {
  const subjects = FOOTER_COLUMNS.find((c) => c.id === 'subjects').links;
  assert.equal(subjects.length, 15);
  assert.deepEqual(PUBLIC_SUBJECTS.map((s) => s.id), [...CUET_PUBLIC_ALLOWED_SUBJECTS]);
  const pages = appPageRoutes();
  for (const s of PUBLIC_SUBJECTS) if (s.hub) assert.ok(resolvesHref(s.hub, pages), s.hub);
  assert.equal(subjects.filter((l) => l.href).length, 6);
  assert.equal(NON_AFFILIATION_LINE, 'Not affiliated with NTA or DU.');
  assert.ok(!FOOTER_COLUMNS.flatMap((c) => c.links).some((l) => l.href === '/features'), '/features leaves the footer');
});

test('Start on: Today by default (N1), Practice as the option', () => {
  assert.equal(DEFAULT_START_ON, 'today');
  assert.deepEqual(START_ON_OPTIONS.map((o) => o.id), ['today', 'practice']);
  assert.equal(startOnHref('practice'), '/dashboard');
  assert.equal(startOnHref('nope'), '/today');
});

test('every href the navigation emits resolves to a page or a planned move', () => {
  const pages = appPageRoutes();
  for (const href of allNavigationHrefs()) {
    if (!href.startsWith('/')) continue;
    assert.ok(resolvesHref(href, pages), href);
  }
});

test('labels: approved names only, sentence case, no "!", em dash, arrows or middle dots', () => {
  for (const label of allNavigationLabels()) {
    assert.equal(retiredTermIn(label), null, label);
    assert.doesNotMatch(label, /[!—·→↗]/, label);
    assert.equal(label.trim(), label);
    // Sentence case: no word after the first is capitalised unless it is a name.
    const words = label.split(/\s+/).slice(1);
    const NAMES = /^(Mobi|MockMob|NTA|DU|CUET|AI|Pro|May|English|Accountancy|Economics|Business|Studies|General|Test|Mathematics|Physics|Chemistry|Biology|History|Political|Science|Geography|Psychology|Sociology|Computer|Today|Practice)$/;
    for (const w of words) if (/^[A-Z][a-z]/.test(w)) assert.match(w.replace(/[^A-Za-z]/g, ''), NAMES, `${label}: ${w}`);
  }
});

test('the old shell keeps working through the shim, with the same ids and new names', () => {
  assert.equal(arenaNavigation, legacyArenaNavigation);
  const ids = arenaNavigation(true).flatMap((g) => g.items.map((i) => i.id));
  for (const id of ['today', 'dashboard', 'learn', 'review', 'explore', 'saved', 'progress', 'analytics', 'admission-compass', 'mentor', 'leaderboard', 'upload', 'my-uploads', 'profile', 'moderation']) {
    assert.ok(ids.includes(id), id);
  }
  assert.ok(!arenaNavigation(false).some((g) => g.label === 'Moderation'));
  assert.deepEqual(MOBILE_STUDY_NAV.map((t) => t.id), ['today', 'dashboard', 'learn', 'review']);
  assert.ok(STUDY_NAV.every((t) => t.id && t.label && t.icon && t.href));
  const shim = readFileSync(new URL('../../src/lib/arenaNavigation.js', import.meta.url), 'utf8');
  assert.ok(shim.includes("from './navigation.js'"));
  assert.ok(Object.keys(PLACE_CONTENTS).every((id) => PLACES[id]));
});
