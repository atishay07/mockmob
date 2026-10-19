// Website release 8, the two adoption pieces on Today (owner W-064 and F18, FEATURE-ADOPTION-2026-10-17 items 5 and 7): how the first-week path
// is wired into the lead card, Road to CUET and Last paper, what it keeps (the regular move among the choices, the one volt key, Night subtle,
// reduced motion), and the preview fixtures. The path's own rules are in first_week_path.test.mjs; the receipt's in repair_receipt.test.mjs.
// Run: node --test data/tests/today_release8.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMove, alternatives } from '../../src/lib/today/move.mjs';
import { choiceMoves, leadOf, pickChoices } from '../../src/lib/today/lead.mjs';
import { firstWeekPath, reviseRecalled, withFirstWeek } from '../../src/lib/today/firstWeek.mjs';
import { roadLayers, roadFigures } from '../../src/lib/today/road.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, '');
const NOW = Date.parse('2026-10-18T14:00:00Z'); // Sunday 18 Oct, 7:30 PM IST
const DAY = 86400000;
const subjectName = (id) => ({ accountancy: 'Accountancy', economics: 'Economics', english: 'English' })[id] || id;

test('Revise used: a question asked today, or an active card above box 1; unknown without either, never false by guess', () => {
  assert.equal(reviseRecalled({ answeredToday: 3, boxes: [5, 0, 0, 0] }), true);
  assert.equal(reviseRecalled({ answeredToday: 0, boxes: [1, 3, 0, 0] }), true, 'a card in box 2 was recalled right');
  assert.equal(reviseRecalled({ answeredToday: 0, boxes: [0, 0, 0, 2] }), true);
  assert.equal(reviseRecalled({ answeredToday: 0, boxes: [5, 0, 0, 0] }), false, 'every card is still in box 1');
  assert.equal(reviseRecalled({ boxes: [0, 0, 0, 0] }), false, 'no cards yet');
  assert.equal(reviseRecalled({ answeredToday: 0 }), null, 'no box counts: not known');
  assert.equal(reviseRecalled({ answeredToday: 0, boxes: [1, 'x', 0, 0] }), null);
  assert.equal(reviseRecalled({ boxes: [1] }), null);
  assert.equal(reviseRecalled(null), null);
  assert.equal(reviseRecalled(undefined), null);
});

test('the regular move is never lost: the path leads, and Repair waits among the two choices; More ways to practise stays', () => {
  // Day 2: a first set with open mistakes and no Repair, and Revise due. The regular move is the first Repair.
  const paper = { id: 'p1', subject: 'accountancy', mode: 'quick', correct: 5, wrong: 4, unattempted: 1, total: 10, marks: 21, maxMarks: 50, completedAt: NOW - DAY };
  const rhythm = { weekStart: '2026-10-12', studyDays: 1, studyDayDates: ['2026-10-17'], daysGoal: 4, metThisWeek: false, paused: false, returning: false, daysSinceLastActivity: 1, counts: { sessions: 1, repairs: 0 }, milestones: [{ id: 'first_scored_session', achievedAt: new Date(NOW - DAY).toISOString() }], lastClosedWeek: null };
  const facts = { sessions: 1, mocks: 0, timedMocks: 0, subject: 'accountancy' };
  const revise = { due: 5, dueTotal: 5, minutes: 5, answeredToday: 0, recalled: false, subjects: ['accountancy'] };
  const top = { subject: 'accountancy', chapter: 'Partnership Fundamentals', open: 30, sessions: 1, wrong: 5, skip: 1, n: 18 };
  const plan = { primary: { kind: 'ordinary_practice', title: 'Start 10 practice questions', href: '/dashboard?mode=quick&count=10', reason: 'x', facts: [] }, alternatives: [], minutes: 10, tonight: { state: 'ready' } };
  const repaired = new Map();
  const regular = leadOf(buildMove({ plan, papers: [paper], rhythm, revise, facts, repaired, top, subjectName, now: NOW }), { now: NOW });
  assert.equal(regular.id, 'firstRepair', 'the regular move');
  const path = firstWeekPath({
    now: NOW, firstAt: rhythm.milestones[0].achievedAt, sessions: 1, papers: [paper], repaired, repairs: 0, mocks: 0, revise,
    road: { onAccount: true, examDate: null, mockTarget: null }, weekdays: null, subjects: ['accountancy', 'economics'], top, facts, firstSubject: 'accountancy', subjectName,
  });
  assert.equal(path.day, 2);
  const lead = withFirstWeek(regular, path.move);
  assert.equal(lead.id, 'revise', 'the path leads');
  const pool = choiceMoves({ papers: [paper], revise, facts, repaired, top, subjectName, subjects: ['accountancy', 'economics'], firstSubject: 'accountancy', length: 10, now: NOW });
  const choices = pickChoices(lead, pool);
  assert.equal(choices.length, 2);
  assert.equal(choices[0].id, 'repair', 'the regular move is one tap away');
  assert.notEqual(choices[1].id, 'revise', 'never the lead\'s own kind');
  assert.ok(alternatives({ move: lead, papers: [paper], revise, facts, repaired, subjectName }).some((a) => a.id === 'repair'), 'and in More ways to practise');
  // A session waiting, a check and "Done for tonight" keep the card.
  for (const id of ['resume', 'check', 'done']) assert.equal(withFirstWeek({ id }, path.move).id, id);
});

test('Road to CUET\'s "Due today" never names Change plan as the session, and the lead\'s plan costs nothing to name', () => {
  const fig = roadFigures({ today: '2026-10-18', plan: {}, goal: 4, taken: 1 });
  const rhythm = { weekStart: '2026-10-12', studyDays: 2, studyDayDates: ['2026-10-15', '2026-10-16'], daysGoal: 4, returning: false, mocksThisWeek: 0 };
  const plan = leadOf({ id: 'plan', title: 'Plan your weeks to CUET', number: 27, label: 'weeks to CUET UG', key: { label: 'Plan my weeks', href: '#road', action: 'plan', minutes: null } }, { now: NOW });
  const layers = roadLayers({ today: '2026-10-18', rhythm, weekdays: [0, 3, 5, 6], revise: null, move: plan, fig, target: 14, taken: 1 });
  const session = layers.today.items.find((i) => i.id === 'session');
  assert.equal(session.title, 'A study session');
  assert.equal(session.href, '/dashboard');
  const named = roadLayers({ today: '2026-10-18', rhythm, weekdays: [0, 3, 5, 6], revise: null, move: { id: 'weakest', title: 'Practise your weakest chapter', key: { minutes: 10, href: '/dashboard?x=1' } }, fig, target: 14, taken: 1 });
  assert.equal(named.today.items.find((i) => i.id === 'session').title, 'Practise your weakest chapter');
});

test('wired on Today: the path leads through withFirstWeek, the rail rides on the lead card, Change plan opens from the day 7 key', () => {
  const page = read('src/app/(app)/today/page.jsx');
  assert.match(page, /import \{ firstWeekClock, firstWeekPath, stepOfDay, withFirstWeek \} from '@\/lib\/today\/firstWeek\.mjs'/);
  assert.match(page, /const rec = useMemo\(\(\) => withFirstWeek\(regular, stepped\), \[regular, stepped\]\)/);
  assert.match(page, /const stepped = useMemo\(\(\) => \(path\?\.move \? finish\(path\.move\) : null\), \[path, finish\]\)/, 'the same finishing (length, price, art) as every other lead');
  assert.match(page, /path=\{phase === 'ready' \? path : null\} onPlan=\{\(\) => setPlanAsk\(\(n\) => n \+ 1\)\}/);
  assert.match(page, /planAsk=\{planAsk\} onPlanSaved=\{\(\) => setPlanSaved\(true\)\}/);
  assert.match(read('src/lib/today/priceLine.mjs'), /\['resume', 'check', 'done', 'plan'\]\.includes\(m\.id\)/, 'Change plan is priced nowhere (the price line moved to src/lib/today/priceLine.mjs)');
  assert.match(page, /priceLineOf\(m, \{ premium, balance, dailySet, firstFull \}\)/);
  assert.match(page, /first_scored_session'\)\?\.achievedAt/, 'the clock is the first scored session');
  assert.match(page, /sessions: everSessions/);
  // The card lands once: it holds, for 1.5 s at most, while the reads that decide today's step are loading.
  assert.match(page, /const stepReads = \{ revise: \[data\.revise\], aim: \[insights\], lab: \[data\.repaired\], plan: \[data\.road, data\.goal\] \}\[stepOfDay\(weekDay\)\] \|\| \[\]/);
  assert.match(page, /window\.setTimeout\(\(\) => setWaitedOut\(true\), 1500\)/);
  assert.match(page, /const phase = holdForStep \|\| holdForPage \? 'loading' :/);
  assert.doesNotMatch(page, /const \[nowMs\][\s\S]*const \[nowMs\]/, 'one clock for the page');
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /Day \$\{path\.day\} of your first week/);
  assert.match(move, /<ol className="tm__rail">/);
  assert.match(move, /className="tm__step" data-state=\{s\.state\} data-day=\{s\.day\}/);
  assert.match(move, /\{path\?\.day \? <p className="sr-only">\{railLine\(path\)\}\{caption && !week \? ` \$\{caption\}` : ''\}<\/p> : null\}/, 'a screen reader hears the rail once, in words');
  // The one volt key: Change plan is a button, a link is a link, offline is disabled; exactly one of them is drawn.
  assert.match(move, /\{isPlan \? \(\s*<button type="button" className="tm__key" data-page-primary aria-haspopup="dialog" onClick=\{onPlan\}>\{m\.key\.label\}<\/button>\s*\) : offline \? \(/);
  assert.doesNotMatch(move, /Flag size=\{34\}/, 'release 10: Mobi points the way on day 7, not a flat flag tile');
  const road = read('src/components/today/TodayRoad.jsx');
  assert.match(road, /planAsk = 0, onPlanSaved/);
  assert.match(road, /if \(planAsk !== asked\) \{ setAsked\(planAsk\); if \(!hold && layers\) \{ setFromKey\(true\); setFlow\(1\); \} \}/, 'it opens once per ask, and only once the road has loaded');
  assert.match(road, /const planTitle = fromKey \|\| dayOne \? 'Plan your weeks' : 'Change plan';/, 'release 10 (D15): the sheet opened by "Plan my weeks" is "Plan your weeks"');
  assert.match(road, /onDone=\{\(s\) => \{ onPlanSaved\?\.\(\); setReceipt\(/);
  const hook = read('src/components/today/useToday.js');
  assert.match(hook, /recalled: reviseRecalled\(body\)/);
});

test('nothing looks like a form, Night stays subtle, one volt, motion with a reason and reduced motion', () => {
  const sheet = css('src/components/today/today.css');
  const rail = [...sheet.matchAll(/[^{}]*\.tm__(?:rail|step)[^{]*\{[^}]*\}/g)].map((m) => m[0]).join('\n');
  assert.ok(rail.includes('.tm__step[data-state=\'done\']'), 'the rail is styled');
  // No volt, no glow, no coloured shadow in the rail: ink, rings and dots.
  assert.doesNotMatch(rail, /#d2f000|--a-accent|volt|glow|drop-shadow|rgb\(/i);
  assert.doesNotMatch(rail, /box-shadow:[^;]*0 0 \d+px/, 'no blur radius: a ring only');
  const rule = (selector) => sheet.match(new RegExp(`${selector.replace(/[.[\]()']/g, '\\$&')} \\{([^}]*)\\}`))?.[1] || '';
  assert.match(rule('.app-shell .tm__step[data-state=\'done\']'), /background: var\(--a-ink\)/);
  assert.match(rule('.app-shell .tm__step[data-state=\'done\']'), /animation: today-mark 220ms var\(--t-out\) both/, 'the pop of the week\'s counted days');
  assert.match(rule('.app-shell .tm__step path'), /animation: today-tick 160ms var\(--t-out\) forwards/, 'the tick draws as the week\'s do');
  assert.match(sheet, /\.tm__step\[data-state='today'\] \{ box-shadow: inset 0 0 0 1\.5px var\(--a-ink\); \}/);
  // Transform and opacity only; the reduced-motion blocks name the rail and the receipt.
  assert.match(sheet, /prefers-reduced-motion: reduce\) \{[\s\S]*\.tm__step, \.tm__step path[\s\S]*\.tpp__receipt/);
  assert.match(sheet, /html\[data-motion='reduced'\] \.app-shell :is\([^)]*\.tpp__receipt/);
  assert.match(sheet, /html\[data-motion='reduced'\] \.app-shell :is\(\.tw__dot, \.tm__step,/);
  // The receipt on Last paper is a hairline-set line below the keys, like the week's caption.
  assert.match(rule('.app-shell .tpp__receipt'), /border-top: 1px solid var\(--a-line\)/);
  // No checkbox, radio or switch semantics on the rail.
  const move = read('src/components/today/TodayMove.jsx');
  const railMarkup = move.match(/<ol className="tm__rail">[\s\S]*?<\/ol>/)[0];
  assert.doesNotMatch(railMarkup, /checkbox|radio|switch|<input|role=/);
  // Release 10 (N1): each mark is a plain tap target that says its own line; out of the Tab order, since the words reach a screen reader once.
  assert.match(railMarkup, /<button type="button" className="tm__step-hit" tabIndex=\{-1\}/);
});

test('the preview: ?firstweek=1 to 7 serves a student on that day, and the result opens the first full mock with ?attempt=', () => {
  const preview = read('src/app/preview/arena/ArenaPreviewClient.jsx');
  assert.match(preview, /import \{ previewFirstWeek \} from '\.\/previewFirstWeek'/);
  assert.match(preview, /const firstWeek = previewFirstWeek\(url, method, fixture, json\);\s*if \(firstWeek\) return firstWeek;/);
  assert.match(preview, /<ResultPageClient previewId=\{params\.get\('attempt'\) \|\| 'fixture-attempt'\} \/>/);
  const fx = read('src/app/preview/arena/previewFirstWeek.js');
  for (const path of ['/api/attempts/summary', '/api/me/rhythm', '/api/me/timed-mock', '/api/me/repair-record', '/api/me/revise', '/api/prepos/insights', '/api/me/goal']) assert.ok(fx.includes(`'${path}'`), path);
  assert.match(fx, /day < 1 \|\| day > 7 \|\| method !== 'GET'\) return null/, 'only GETs, only days 1 to 7');
  assert.match(fx, /\['question', 'none'\]\.includes\(fixture\.get\('receipt'\)\)/);
  // The fixtures use the real rhythm engine and the real scorer.
  assert.match(fx, /computeRhythm\(\{ activities, daysPerWeek: 4, now \}\)/);
  assert.match(read('src/app/preview/arena/previewRecord.js'), /export \{ attempt as previewAttempt \}/);
});
