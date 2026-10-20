// The website first run in two steps (subjects, then study days a week): the step and redirect
// rules (the live ones, plus the days step), the days choices and their copy, the week ring the
// dial draws, and the page's motion and copy rules. Run: node --test data/tests/onboarding_first_run.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DAY_OPTIONS, DAY_RHYTHMS, DEFAULT_DAYS, DONE_PATH, GOAL_PATH, SIGNUP_PATH, STEPS, STUDY_DAY_RULE, SUBJECT_CAP,
  cleanDays, dayRhythm, daysLine, goalBody, mobiForDays, onboardingEntry, pickedLine, pickedSlots, resolveStep, ringArcs, thumbIndex,
} from '../../src/app/onboarding/firstRun.js';
import { MIN_ANSWERED } from '../../src/lib/server/rhythm.js';
import { MOBI_ACTS } from '../../src/components/brand/mobiActs.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const page = read('src/app/onboarding/OnboardingPageClient.jsx');
const css = read('src/app/onboarding/onboarding.css');

test('two steps; editing is subjects only; days needs saved subjects', () => {
  assert.deepEqual([...STEPS], ['subjects', 'days', 'colleges']);
  assert.equal(resolveStep({ wanted: 'colleges', hasSubjects: true }), 'colleges', 'colleges are picked inside onboarding (owner, 16 Oct)');
  assert.equal(resolveStep({ wanted: 'colleges', hasSubjects: false }), 'subjects');
  assert.equal(resolveStep({ wanted: 'subjects' }), 'subjects');
  assert.equal(resolveStep({ wanted: 'days', hasSubjects: true }), 'days');
  assert.equal(resolveStep({ wanted: 'days', hasSubjects: false }), 'subjects', 'no saved subjects: days is never shown');
  assert.equal(resolveStep({ wanted: 'days', hasSubjects: true, edit: true }), 'subjects', 'Edit subjects is one step');
  assert.equal(resolveStep(), 'subjects');
});

test('the live redirect rules hold: sign-up when signed out, Practice for a member who already has subjects', () => {
  assert.equal(SIGNUP_PATH, '/signup');
  assert.equal(DONE_PATH, '/dashboard');
  assert.equal(onboardingEntry({ status: 'loading' }), 'wait');
  assert.equal(onboardingEntry({ status: 'unauthenticated' }), 'signup');
  assert.equal(onboardingEntry({ status: 'unauthenticated', edit: true }), 'signup');
  assert.equal(onboardingEntry({ status: 'authenticated', savedSubjects: 0 }), 'stay', 'a new student stays');
  assert.equal(onboardingEntry({ status: 'authenticated', savedSubjects: 3 }), 'leave', 'a member is sent on, as before');
  assert.equal(onboardingEntry({ status: 'authenticated', savedSubjects: 3, edit: true }), 'stay', 'Edit subjects stays');
  // The one addition: subjects just saved in this visit (or a reload on ?step=days) keep the days step.
  assert.equal(onboardingEntry({ status: 'authenticated', savedSubjects: 3, inFlow: true }), 'stay');
});

test('the page wires the live rules and saves the goal the server checks', () => {
  assert.ok(page.includes('router.push(SIGNUP_PATH)'));
  assert.ok(page.includes('router.push(DONE_PATH)'));
  assert.ok(page.includes('onboardingEntry({ status, savedSubjects, edit, inFlow: savedThisVisit || arrivedForDays })'));
  // The flag that keeps the student on the days step is set before the session refresh resolves.
  assert.ok(page.indexOf('setSavedThisVisit(true)') < page.indexOf('refreshing.current = Promise.resolve(refreshSession())'));
  assert.ok(page.includes("method: 'PUT'") && page.includes('JSON.stringify({ ...goalBody(days, pausedUntil.current), ...(minutes ? { dailyMinutes: minutes } : {}) })'));
  assert.equal(GOAL_PATH, '/api/me/goal');
  const route = read('src/app/api/me/goal/route.js');
  assert.ok(route.includes('export async function PUT'));
  // The goal is checked by the shared rule (1 to 7, with or without chosen weekdays), tested in study_weekdays.test.mjs.
  assert.ok(route.includes('resolveGoalWeekdays(body)'), 'the server takes 1 to 7');
  // Preview never writes the goal (the fixture blocks unknown writes).
  assert.ok(/if \(preview\) \{ setNotice\('Preview only: your days were checked here/.test(page));
  assert.ok(page.includes("That's five, the most CUET allows. Remove one to swap."));
});

test('days: 1 to 7, Skip keeps the server default of 4', () => {
  assert.deepEqual([...DAY_OPTIONS], [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(DEFAULT_DAYS, 4);
  assert.match(read('src/lib/server/appPrefs.js'), /const daysPerWeek = row\?\.days_per_week \?\? 4;/, 'the server reads a missing goal as 4');
  assert.equal(cleanDays(5), 5);
  assert.equal(cleanDays('6'), 6);
  for (const bad of [0, 8, -1, NaN, null, undefined, 'x']) assert.equal(cleanDays(bad), DEFAULT_DAYS);
  assert.equal(daysLine(1), '1 day a week');
  assert.equal(daysLine(4), '4 days a week');
  assert.equal(thumbIndex(1), 0);
  assert.equal(thumbIndex(7), 6);
});

test('saving days keeps a pause set in the app, and drops one that has ended', () => {
  const now = Date.parse('2026-10-15T10:00:00Z');
  assert.deepEqual(goalBody(5, null, now), { daysPerWeek: 5, pausedUntil: null });
  assert.deepEqual(goalBody(5, '2026-10-20', now), { daysPerWeek: 5, pausedUntil: '2026-10-20' });
  assert.deepEqual(goalBody(5, '2026-10-15', now), { daysPerWeek: 5, pausedUntil: '2026-10-15' }, 'a pause ending today still runs');
  assert.deepEqual(goalBody(5, '2026-10-01', now), { daysPerWeek: 5, pausedUntil: null });
  assert.deepEqual(goalBody(9, 'soon', now), { daysPerWeek: DEFAULT_DAYS, pausedUntil: null });
});

test('subject tiles show the shared lamp-lit object, lit when picked', () => {
  assert.ok(page.includes("import { SubjectObject } from '@/components/brand/SubjectObject'"));
  assert.ok(/<SubjectObject id=\{s\.internalId \|\| s\.id\} size=\{76\} lit/.test(page));
  assert.ok(css.includes('.ob-tile .subj-obj__light { opacity: 0; }'));
  assert.ok(css.includes('.ob-tile[data-selected] .subj-obj__light { opacity: 1; }'));
});

test('subjects: the count line and the five slots', () => {
  assert.equal(SUBJECT_CAP, 5);
  assert.equal(pickedLine(0), '0 of 5 picked');
  assert.equal(pickedLine(3), '3 of 5 picked');
  assert.deepEqual(pickedSlots(['a', 'b']), ['a', 'b', null, null, null]);
  assert.deepEqual(pickedSlots([]), [null, null, null, null, null]);
  assert.equal(pickedSlots(['a', 'b', 'c', 'd', 'e', 'f']).length, 5);
});

test('every choice has a name and a plain line that follow the copy rules', () => {
  for (const n of DAY_OPTIONS) {
    const r = dayRhythm(n);
    assert.equal(r, DAY_RHYTHMS[n]);
    for (const text of [r.name, r.line]) {
      assert.ok(text.length > 0);
      assert.ok(!/[!—]/.test(text), `no "!" or em dash: ${text}`);
      assert.ok(!/\b(score|marks|rank|guarantee)/i.test(text), `no promise of marks: ${text}`);
      assert.equal(text[0], text[0].toUpperCase(), `sentence case: ${text}`);
    }
    assert.equal(r.name.slice(1), r.name.slice(1).toLowerCase(), `sentence case name: ${r.name}`);
  }
  assert.ok(STUDY_DAY_RULE.includes(`at least ${MIN_ANSWERED} answers`), 'the rule matches what the server counts');
  assert.ok(STUDY_DAY_RULE.includes('Mistake Repair'));
});

test('Mobi answers a choice with an act he has', () => {
  for (const n of DAY_OPTIONS) assert.ok(MOBI_ACTS.includes(mobiForDays(n)), `day ${n}`);
  assert.equal(mobiForDays(7), 'cheer');
  assert.equal(mobiForDays(1), 'encourage');
  assert.equal(mobiForDays(4), 'nod');
  // One Mobi on the page.
  assert.equal((page.match(/<MobiReact\b/g) || []).length, 1);
});

test('the week ring draws one arc per study day, round from the top', () => {
  for (const n of DAY_OPTIONS) {
    const arcs = ringArcs(n);
    assert.equal(arcs.length, n);
    for (const d of arcs) assert.match(d, /^M-?\d+(\.\d+)? -?\d+(\.\d+)?A46 46 0 [01] 1 -?\d+(\.\d+)? -?\d+(\.\d+)?$/);
  }
  // A single arc is almost a full circle starting at the top.
  assert.match(ringArcs(1)[0], /^M60 14A46 46 0 1 1 /);
});

test('motion: transform and opacity, no transition: all, and reduced motion covers every animation', () => {
  assert.ok(!/transition:\s*all/.test(css));
  const animated = [...css.matchAll(/^\s*\.([\w-]+)[^{]*\{[^}]*animation:\s*ob-/gm)].map((m) => m[1]);
  assert.ok(animated.length >= 6, 'the page animates its own moments');
  const reduced = css.slice(css.indexOf('Reduced motion'));
  for (const name of ['ob-step', 'ob-tile', 'ob-tile__art', 'ob-stage__swap', 'ob-dial__arcs', 'ob-dial__arc', 'ob-slot', 'ob-tick--on', 'ob-track__thumb', 'ob-progress__bar i']) {
    assert.ok(reduced.includes(name), `reduced motion handles .${name}`);
    assert.ok(reduced.includes(`html[data-motion='reduced']`), 'the MockMob setting, not only the device');
  }
  // Light and dark both set the lamp and the plate.
  assert.ok(/html\[data-theme='light'\] \.ob \{[^}]*--ob-lamp/.test(css));
  // No "!" in the page's own strings.
  const strings = [...page.matchAll(/'([^'\n]{6,})'/g)].map((m) => m[1]).filter((s) => /\s/.test(s));
  for (const s of strings) assert.ok(!s.includes('!') && !s.includes('—'), s);
});
