// First run for a new student (web IA plan section 3, packet IA3): where sign-in lands, the
// two onboarding steps, the returning hint, the silent sample import, and the copy rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { postSignInPath, loginPathFor, rememberNextPath, takeNextPath } from '../../src/lib/auth-redirect.js';
import {
  DAY_OPTIONS, DEFAULT_DAYS, SUBJECT_CAP, cleanDays, daysLine, hasPendingSample, isKnownVisitor, onboardingEntry, pickedLine,
  readVisitorKind, rememberMember, rememberReturning, resolveStep, runSampleImport, sampleNoteLine, signupFactsLine,
} from '../../src/app/onboarding/firstRun.js';
import { SAMPLE_HANDOFF_KEY, buildSampleHandoff, readSampleHandoff, writeSampleHandoff } from '../sample_handoff.mjs';
import { PLAN_FACTS } from '../plan_facts.mjs';
import { START_ON_KEY, VISITOR_KEY } from '../../src/lib/navigation.js';
import { retiredHits, studentStrings, CAVEAT_PATTERNS } from '../glossary.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(`${ROOT}${rel}`, 'utf8');

function memoryStore(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
}

test('sign-in lands on Today, or the Start on place, or the saved page', () => {
  const store = memoryStore();
  assert.equal(postSignInPath({ needsOnboarding: false, store, now: 1 }), '/today');
  store.setItem(START_ON_KEY, 'practice');
  assert.equal(postSignInPath({ needsOnboarding: false, store, now: 1 }), '/dashboard');
  store.setItem(START_ON_KEY, JSON.stringify({ id: 'today' }));
  assert.equal(postSignInPath({ needsOnboarding: false, store, now: 1 }), '/today');
  store.setItem(START_ON_KEY, 'https://evil.example');
  assert.equal(postSignInPath({ needsOnboarding: false, store, now: 1 }), '/today', 'an unknown value falls back to Today');
  rememberNextPath('/review?tab=mistakes', { store, now: 1 });
  assert.equal(postSignInPath({ needsOnboarding: false, store, now: 2 }), '/review?tab=mistakes');
});

test('?next from pricing survives the first run: onboarding first, then pricing', () => {
  const store = memoryStore();
  rememberNextPath('/pricing', { store, now: 1000 });
  assert.equal(postSignInPath({ needsOnboarding: true, store, now: 2000 }), '/onboarding');
  // The end of onboarding asks again with the subjects saved.
  assert.equal(postSignInPath({ needsOnboarding: false, store, now: 60_000 }), '/pricing');
  assert.equal(takeNextPath({ store, now: 60_001 }), null, 'read once');
  // A saved /onboarding is never kept for later (it would loop).
  rememberNextPath('/onboarding?edit=true', { store, now: 1 });
  assert.equal(postSignInPath({ needsOnboarding: true, store, now: 2 }), '/onboarding');
  assert.equal(takeNextPath({ store, now: 3 }), null);
});

test('a gated link keeps its page; the home places need no ?next', () => {
  assert.equal(loginPathFor('/today'), '/login');
  assert.equal(loginPathFor('/dashboard'), '/login');
  assert.equal(loginPathFor('/pricing'), '/login?next=%2Fpricing');
  assert.equal(loginPathFor('/dashboard?subject=accountancy&mode=quick&count=10'), '/login?next=%2Fdashboard%3Fsubject%3Daccountancy%26mode%3Dquick%26count%3D10');
  assert.equal(loginPathFor('/onboarding?edit=true'), '/login?next=%2Fonboarding%3Fedit%3Dtrue');
  assert.equal(loginPathFor('//evil.example'), '/login');
});

test('onboarding has two steps; editing is subjects only; days needs saved subjects', () => {
  assert.equal(resolveStep({}), 'subjects');
  assert.equal(resolveStep({ step: 'days', hasSubjects: false }), 'subjects');
  assert.equal(resolveStep({ step: 'days', hasSubjects: true }), 'days');
  assert.equal(resolveStep({ step: 'days', hasSubjects: true, edit: true }), 'subjects');
  assert.equal(onboardingEntry({ status: 'loading' }), 'wait');
  assert.equal(onboardingEntry({ status: 'unauthenticated' }), 'signup');
  assert.equal(onboardingEntry({ status: 'unauthenticated', edit: true }), 'login');
  assert.equal(onboardingEntry({ status: 'authenticated', hasSubjects: false }), 'stay');
  assert.equal(onboardingEntry({ status: 'authenticated', hasSubjects: true }), 'leave', 'a member who finished goes home');
  assert.equal(onboardingEntry({ status: 'authenticated', hasSubjects: true, step: 'days' }), 'stay', 'a reload on days stays');
  assert.equal(onboardingEntry({ status: 'authenticated', hasSubjects: true, edit: true }), 'stay', '/onboarding?edit=true still works');
});

test('days a week: 1 to 7, default 4 (the server reads a missing goal as 4)', () => {
  assert.deepEqual([...DAY_OPTIONS], [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(DEFAULT_DAYS, 4);
  assert.equal(cleanDays('6'), 6);
  assert.equal(cleanDays(0), 4);
  assert.equal(cleanDays(9), 4);
  assert.equal(cleanDays('x'), 4);
  assert.equal(daysLine(1), '1 day a week');
  assert.equal(daysLine(5), '5 days a week');
  assert.equal(SUBJECT_CAP, 5);
  assert.equal(pickedLine(3), '3 of 5 picked');
  const appPrefs = read('src/lib/server/appPrefs.js');
  assert.match(appPrefs, /daysPerWeek: row\?\.days_per_week \?\? 4/, 'Skip keeps 4 only while the server default is 4');
});

test('sign-up facts come from plan_facts and say exactly what is free', () => {
  const line = signupFactsLine();
  assert.ok(line.includes(`${PLAN_FACTS.practiceCredits.startingBalance.value} practice credits`));
  assert.ok(line.includes(`${PLAN_FACTS.aiCredits.freeMonthly.value} AI credits every month`));
  assert.match(line, /^Free to start, no card\./);
  assert.equal(sampleNoteLine(), `Your ${PLAN_FACTS.sessions.sampleQuestions.value} sample answers will be saved to your account.`);
});

test('the returning hint: a new visitor is never welcomed back', () => {
  const store = memoryStore();
  assert.equal(readVisitorKind(store), 'new');
  assert.equal(isKnownVisitor(readVisitorKind(store)), false);
  assert.equal(rememberReturning(store), false, 'a new visitor stays new');
  assert.equal(readVisitorKind(store), 'new');
  rememberMember({ pro: false, started: false }, store);
  assert.deepEqual(JSON.parse(store.getItem(VISITOR_KEY)), { kind: 'member', plan: 'free', started: false });
  rememberMember({ pro: true, started: null }, store);
  assert.deepEqual(JSON.parse(store.getItem(VISITOR_KEY)), { kind: 'member', plan: 'pro', started: false }, 'an unknown started keeps the stored one');
  assert.equal(isKnownVisitor(readVisitorKind(store)), true);
  assert.equal(rememberReturning(store), true);
  assert.equal(readVisitorKind(store), 'returning');
  assert.equal(isKnownVisitor('returning'), true);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readVisitorKind(broken), 'new');
  assert.equal(rememberMember({}, broken), false);
  assert.equal(rememberReturning(broken), false);
});

const ANSWERS = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id, i) => ({ sampleQuestionId: id, optionKey: 'ABCD'[i % 4] }));
const reply = (status) => async () => ({ status });

test('the sample import posts once, even after a reload, and never shows anything', async () => {
  const storage = memoryStore();
  writeSampleHandoff(storage, buildSampleHandoff({ answers: ANSWERS, subject: 'Accountancy' }));
  assert.equal(hasPendingSample(storage), true);
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { status: 200 }; };
  // Two mounts at once (React strict mode) and a reload afterwards: one request.
  const [a, b] = await Promise.all([runSampleImport({ storage, fetchImpl }), runSampleImport({ storage, fetchImpl })]);
  assert.equal(a, 'done');
  assert.equal(b, 'done');
  assert.equal(await runSampleImport({ storage, fetchImpl }), 'none');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/me/sample-import');
  assert.equal(calls[0].body.answers.length, 5);
  assert.equal(hasPendingSample(storage), false);
});

test('the sample import: 409 is done, a failure waits for the next load, a refusal is dropped', async () => {
  const conflict = memoryStore();
  writeSampleHandoff(conflict, buildSampleHandoff({ answers: ANSWERS }));
  assert.equal(await runSampleImport({ storage: conflict, fetchImpl: reply(409) }), 'done');
  assert.equal(readSampleHandoff(conflict).imported, true);

  const offline = memoryStore();
  writeSampleHandoff(offline, buildSampleHandoff({ answers: ANSWERS }));
  assert.equal(await runSampleImport({ storage: offline, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), 'later');
  assert.equal(readSampleHandoff(offline).imported, false, 'kept for the next page load');
  assert.equal(await runSampleImport({ storage: offline, fetchImpl: reply(503) }), 'later');
  assert.equal(await runSampleImport({ storage: offline, fetchImpl: reply(201) }), 'done');

  const refused = memoryStore();
  writeSampleHandoff(refused, buildSampleHandoff({ answers: ANSWERS }));
  assert.equal(await runSampleImport({ storage: refused, fetchImpl: reply(400) }), 'drop');
  assert.equal(refused.getItem(SAMPLE_HANDOFF_KEY), null);

  assert.equal(await runSampleImport({ storage: memoryStore(), fetchImpl: reply(200) }), 'none', 'no sample, no request');
  assert.equal(await runSampleImport({ storage: null, fetchImpl: reply(200) }), 'none', 'storage blocked');
});

// ---------------------------------------------------------------------------------------------
// Copy: one primary per screen, sentence case, no "!", no em dash, no retired names or caveats.

const FILES = [
  'src/app/signup/SignupPageClient.jsx', 'src/app/login/LoginPageClient.jsx', 'src/components/ui/SignupCard.jsx',
  'src/components/auth/AuthShell.jsx', 'src/app/onboarding/OnboardingPageClient.jsx', 'src/app/onboarding/firstRun.js',
];

test('first-run copy: no "!", no em dash, no retired names, no caveats', () => {
  for (const file of FILES) {
    const strings = studentStrings(read(file));
    for (const s of strings) {
      assert.doesNotMatch(s, /!(?!=)/, `${file}: "${s}"`);
      assert.doesNotMatch(s, /—/, `${file}: "${s}"`);
      for (const re of CAVEAT_PATTERNS) assert.doesNotMatch(s, re, `${file}: "${s}"`);
    }
    assert.deepEqual(retiredHits(read(file), file), [], file);
    assert.doesNotMatch(read(file), /practice board|Radar|Arena/, file);
  }
});

test('"Welcome back" only for a returning device; the code field shows 6 digits', () => {
  const login = read('src/app/login/LoginPageClient.jsx');
  assert.match(login, /className="auth-v-returning">Welcome back</);
  assert.match(login, /className="auth-v-new">Log in</);
  const card = read('src/components/ui/SignupCard.jsx');
  assert.doesNotMatch(card, /Welcome back/);
  assert.match(card, /placeholder="000000"/);
  assert.doesNotMatch(card, /placeholder="0{7,}"/);
  const css = read('src/app/auth.css');
  assert.match(css, /\.auth \.auth-v-returning \{ display: none; \}/, 'hidden unless the hint says otherwise');
  assert.doesNotMatch(css, /\[data-visitor='new'\][^{]*auth-v-returning/, 'a new visitor never sees it');
  const signup = read('src/app/signup/SignupPageClient.jsx');
  assert.match(signup, /Create your free account\./);
  assert.doesNotMatch(signup, /points=/, 'no upsell bullets');
});
