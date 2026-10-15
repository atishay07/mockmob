// The signed-in shell's rules (web IA plan 2.1, IA1): src/components/shell/shellModel.mjs, plus
// source checks on the shell files that cannot run under node (React components and CSS).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BAR_ORDER, GUIDE_STOPS, aiRemaining, chipLabel, chipSpoken, creditLineParts, firstSegment, guideCardPlacement, guideRequestFromSearch,
  guideSeenKey, guideShouldOpen, initialOf, initialRowFor, lensFor, linkFor, memberHint, morphFrom, placeSpoken, popoverLines, reviewBadge,
  sheetRows, startRequestFromLocation, visitorDataset,
} from '../../src/components/shell/shellModel.mjs';
import { shellItems, PLACES } from '../../src/lib/navigation.js';
import { nextMove } from '../next_step_rules.mjs';
import { retiredTermIn } from '../glossary.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const SHELL_FILES = ['Sidebar.jsx', 'Rail.jsx', 'Dock.jsx', 'PlaceLink.jsx', 'StartKey.jsx', 'StartSheet.jsx', 'CreditsChip.jsx', 'CreditsLine.jsx', 'GuideTour.jsx']
  .map((f) => `src/components/shell/${f}`);

test('the phone bar has exactly 5 slots in the app order, Start in the middle, and the lens skips Start', () => {
  assert.deepEqual(BAR_ORDER, shellItems('phone').map((i) => i.id));
  assert.equal(BAR_ORDER.length, 5);
  assert.equal(BAR_ORDER[2], 'start');
  assert.deepEqual(lensFor('today'), { index: 0, k: 0, side: 'left' });
  assert.deepEqual(lensFor('practice'), { index: 1, k: 1, side: 'left' });
  assert.deepEqual(lensFor('review'), { index: 3, k: 2, side: 'right' });
  assert.deepEqual(lensFor('you'), { index: 4, k: 3, side: 'right' });
  assert.equal(lensFor('start'), null);
  assert.equal(lensFor(null), null, 'no current place: the lens hides');
  const dock = read('src/components/shell/Dock.jsx').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(dock, /More|hamburger|menu/i, 'no hamburger and no More');
});

test('links stay inside the development preview only when the preview gives one', () => {
  assert.equal(firstSegment('/dashboard?mode=quick#x'), 'dashboard');
  assert.equal(linkFor('/today', null), '/today');
  assert.equal(linkFor('/dashboard?subject=economics', { dashboard: '/preview/arena?view=dashboard' }), '/preview/arena?view=dashboard');
  assert.equal(linkFor('/you', { today: '/preview/arena?view=today' }), '/you', 'no preview view yet: the real path');
});

test('credits are always labelled, and unknown is never shown as 0', () => {
  assert.deepEqual(creditLineParts({ practiceBalance: 40, aiRemaining: 9 }).map((l) => [l.count, l.words]), [['40', 'practice credits'], ['9', 'AI credits']]);
  assert.deepEqual(creditLineParts({ practiceBalance: null, aiRemaining: null }), []);
  assert.deepEqual(creditLineParts({ practiceBalance: 40, aiRemaining: 50, pro: true }).map((l) => l.id), ['ai'], 'Pro: practice needs no credits');
  assert.equal(chipLabel({ practiceBalance: 40, aiRemaining: 9 }), '40 credits');
  assert.equal(chipLabel({ practiceBalance: 1 }), '1 credit');
  assert.equal(chipLabel({ practiceBalance: 0, aiRemaining: 3 }), '0 credits', 'a real zero is shown');
  assert.equal(chipLabel({ aiRemaining: 50, pro: true }), '50 AI credits');
  assert.equal(chipLabel({}), null, 'nothing known: no chip text');
  assert.match(chipSpoken({ practiceBalance: 40, aiRemaining: 9 }), /40 practice credits, 9 AI credits/);
  assert.equal(aiRemaining({ known: true, total: 68 }), 68);
  assert.equal(aiRemaining({ known: false, total: 0 }), null);
  assert.equal(aiRemaining(null), null);
});

test('the chip popover reads plan_facts and never says "68 of 50"', () => {
  const wallet = { known: true, total: 68, includedRemaining: 38, includedMonthlyCredits: 50, bonusCredits: 30, resetAt: '2026-10-31T18:30:00.000Z' };
  const lines = popoverLines({ practiceBalance: 40, wallet });
  assert.equal(lines[0].text, 'Practice credits 40: pay for mocks and practice.');
  assert.equal(lines[1].text, 'AI credits 38 of 50 this month: pay for Mistake Repair and Ask Mobi. Renews 1 Nov.');
  assert.equal(lines[2].text, 'Plus 30 extra AI credits.');
  assert.deepEqual(popoverLines({ practiceBalance: null, wallet: { known: false } }), []);
  for (const line of lines) {
    assert.doesNotMatch(line.text, /!|—/);
    assert.equal(retiredTermIn(line.text), null, line.text);
  }
});

test('Start sheet: the hero first, chips steer Quick 10 and Full mock, a repair hero drops the repair row', () => {
  const move = nextMove({ now: '2026-10-15T14:30:00Z', practiceCredits: 40, subjects: ['accountancy'], attempts: [] });
  const rows = sheetRows({ move, balance: 40, aiBalance: 9, subjects: ['accountancy', 'economics'], selectedSubject: 'economics', mistakeRepair: true });
  assert.ok(rows.length <= 5);
  assert.equal(rows[0].id, 'move');
  assert.equal(rows.find((r) => r.id === 'quick').href, '/dashboard?subject=economics&mode=quick&count=10');
  assert.equal(rows.find((r) => r.id === 'full').href, '/dashboard?subject=economics&mode=full');
  assert.equal(rows.find((r) => r.id === 'full').subjectLabel, 'Economics');
  assert.equal(rows.find((r) => r.id === 'nta').href, '/pricing', 'a locked NTA row opens the plans');
  assert.equal(rows.find((r) => r.id === 'repair').href, '/review', 'no repair attempt known: Review');
  const withTonight = sheetRows({ move, subjects: ['accountancy'], tonight: { count: 4, attemptId: 'att-7' }, mistakeRepair: true });
  assert.equal(withTonight.find((r) => r.id === 'repair').href, '/result/att-7');
  const repairMove = nextMove({ now: '2026-10-15T14:30:00Z', subjects: ['accountancy'], aiCredits: 10,
    attempts: [{ id: 'att-7', subject: 'accountancy', mode: 'full', completedAt: '2026-10-13T12:00:00Z' }],
    repair: { attemptId: 'att-7', mode: 'full', completedAt: '2026-10-13T12:00:00Z', open: 4 } });
  const repairRows = sheetRows({ move: repairMove, subjects: ['accountancy'], tonight: { count: 4, attemptId: 'att-7' }, mistakeRepair: true });
  assert.equal(repairRows[0].label, 'Repair 4 mistakes from Tuesday\'s mock, about 15 minutes');
  assert.ok(!repairRows.some((r) => r.id === 'repair'), 'the hero is already the repair');
  const pro = sheetRows({ plan: 'pro', subjects: ['accountancy'], mistakeRepair: false });
  assert.equal(pro.find((r) => r.id === 'nta').href, '/dashboard?mode=nta&interface=nta');
  assert.equal(pro.find((r) => r.id === 'quick').confirm, '10 questions, about 10 minutes. +5 right, -1 wrong. Included with Pro.');
  // Nothing on the sheet starts a session or calls an API: every row goes to a setup, a result or the plans.
  for (const row of [...rows, ...repairRows, ...pro]) assert.doesNotMatch(row.href, /^\/test|^\/api\//, row.id);
  // Unknown subjects fall back to the first sheet subject.
  assert.equal(sheetRows({ subjects: ['english'], selectedSubject: 'physics' }).find((r) => r.id === 'quick').subject, 'english');
});

test('/start opens the sheet, ?row= picks the row, anything else is ignored', () => {
  assert.deepEqual(startRequestFromLocation('/start', '?row=quick'), { row: 'quick' });
  assert.deepEqual(startRequestFromLocation('/start/', ''), { row: null });
  assert.deepEqual(startRequestFromLocation('/start', '?row=<script>'), { row: null });
  assert.equal(startRequestFromLocation('/today', '?row=quick'), null);
  const rows = [{ id: 'move', hero: true }, { id: 'quick' }, { id: 'full' }];
  assert.equal(initialRowFor(null, rows), 'move', 'the hero opens with its confirm line');
  assert.equal(initialRowFor('quick', rows), 'quick');
  assert.equal(initialRowFor('resume', rows), 'move', 'resume falls back to the hero');
  assert.equal(initialRowFor('repair', [{ id: 'quick' }]), null);
});

test('the morph starts over the Start key and ends on the sheet', () => {
  const m = morphFrom({ left: 150, top: 740, width: 60, height: 40 }, { left: 0, top: 300, width: 360, height: 480 });
  assert.equal(m.dx, 0);
  assert.equal(m.dy, 220);
  assert.equal(m.sx, 0.167);
  assert.equal(m.sy, 0.083);
  assert.match(m.transform, /^translate\(0px, 220px\) scale\(0\.167, 0\.083\)$/);
  assert.equal(morphFrom(null, { left: 0, top: 0, width: 10, height: 10 }), null);
  assert.equal(morphFrom({ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 10, height: 10 }), null, 'a hidden key: no morph');
});

test('the guide: 4 stops, opens by itself once, replays any time, never before it is asked', () => {
  assert.deepEqual(GUIDE_STOPS.map((s) => s.id), ['today', 'start', 'practice', 'review']);
  assert.deepEqual(GUIDE_STOPS.map((s) => s.target), ['nav-today', 'nav-start', 'nav-practice', 'nav-review']);
  assert.equal(guideShouldOpen({ mode: 'first', seen: false }), true);
  assert.equal(guideShouldOpen({ mode: 'first', seen: true }), false);
  assert.equal(guideShouldOpen({ mode: 'replay', seen: true }), true);
  assert.equal(guideShouldOpen({ mode: 'other' }), false);
  assert.equal(guideRequestFromSearch('?guide=first'), 'first');
  assert.equal(guideRequestFromSearch('?guide=1'), null);
  assert.equal(guideSeenKey('u1'), 'mm:guide-seen:v1:u1');
  for (const stop of GUIDE_STOPS) {
    assert.doesNotMatch(`${stop.title} ${stop.body}`, /!|—|fresh/i, stop.id);
    assert.equal(retiredTermIn(stop.body), null, stop.id);
  }
  // Every guide target exists in the shell markup.
  const markup = SHELL_FILES.map(read).join('\n');
  assert.match(markup, /data-tour=\{`nav-\$\{place\.id\}`\}/);
  assert.match(markup, /data-tour="nav-start"/);
});

test('the guide card stays inside the viewport: beside a rail item, above a bar item', () => {
  const vp = { width: 375, height: 812 };
  const bar = guideCardPlacement({ left: 20, top: 740, width: 60, height: 52, right: 80, bottom: 792 }, vp, { width: 360, height: 200 });
  assert.ok(bar.top + 200 <= 740 - 12 + 1, 'above the bar item');
  assert.ok(bar.left >= 16 && bar.left + bar.width <= 375 - 16);
  const desk = guideCardPlacement({ left: 14, top: 120, width: 204, height: 44, right: 218, bottom: 164 }, { width: 1366, height: 650 }, { width: 360, height: 200 });
  assert.equal(desk.left, 230, 'beside the sidebar item');
  assert.ok(desk.top >= 16 && desk.top + 200 <= 650 - 16);
  const none = guideCardPlacement(null, { width: 360, height: 780 });
  assert.equal(none.left, 16);
  assert.equal(none.width, 328);
});

test('the visitor hint holds no personal data and mirrors onto <html>', () => {
  const hint = memberHint({ id: 'u1', name: 'Asha', email: 'a@b.c', isPremium: true }, null);
  assert.deepEqual(hint, { kind: 'member', plan: 'pro', started: null });
  assert.deepEqual(memberHint({ isPremium: false }, '{"kind":"member","plan":"pro","started":true}'), { kind: 'member', plan: 'free', started: true });
  assert.deepEqual(visitorDataset(hint), { visitor: 'member', plan: 'pro', started: null });
  assert.deepEqual(visitorDataset({ kind: 'returning' }), { visitor: 'returning', plan: null, started: null });
  assert.deepEqual(visitorDataset('{bad'), { visitor: 'new', plan: null, started: null });
});

test('badges and spoken names carry real counts only', () => {
  assert.equal(reviewBadge(0), null);
  assert.equal(reviewBadge(12), '9+');
  assert.equal(placeSpoken('review', 4), 'Review, 4 mistakes to repair tonight');
  assert.equal(placeSpoken('review', 1), 'Review, 1 mistake to repair tonight');
  assert.equal(placeSpoken('review', 0), 'Review');
  assert.equal(placeSpoken('today', 4), 'Today', 'nothing else gets a badge');
  assert.equal(initialOf('  asha rao'), 'A');
  assert.equal(initialOf(''), '');
  assert.equal(initialOf(null), '');
  assert.ok(Object.keys(PLACES).every((id) => placeSpoken(id)));
});

test('shell source: focus mode on /test, login keeps ?next, no launcher, no unlabelled chips, copy rules', () => {
  const layout = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(layout, /chromeFor\(activePath\) === 'focus'/);
  assert.match(layout, /loginPathFor\(/);
  assert.doesNotMatch(layout, /Loading your session/);
  assert.doesNotMatch(layout, /arenaNavigation|MOBILE_STUDY_NAV|Feed the bank|PrepOS|Radar|Arena navigation/);
  const rootLayout = read('src/app/layout.js');
  assert.doesNotMatch(rootLayout, /AssistantLauncher/);
  assert.ok(!existsSync(resolve(root, 'src/components/ai/AssistantLauncherGate.jsx')));
  assert.match(rootLayout, /mm:visitor:v1/);
  assert.match(rootLayout, /prefers-color-scheme: dark/);
  for (const file of [...SHELL_FILES, 'src/app/(app)/AppLayoutClient.jsx']) {
    const src = read(file);
    // Visible strings in JSX text and string literals: sentence case, no "!", no em dash.
    assert.doesNotMatch(src, /—/, `${file}: em dash`);
    for (const m of src.matchAll(/>([^<>{}=;()&|]*[A-Za-z][^<>{}=;()&|]*)</g)) {
      const text = m[1].trim();
      if (!text) continue;
      assert.doesNotMatch(text, /!/, `${file}: "${text}"`);
      assert.equal(retiredTermIn(text), null, `${file}: "${text}"`);
    }
  }
  const css = read('src/components/shell/shell.css');
  assert.doesNotMatch(css, /transition:\s*all/);
  assert.doesNotMatch(css, /infinite/, 'no loops');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /html\[data-motion='reduced'\]/);
  assert.match(css, /@supports not/, 'glass has a solid fallback');
});
