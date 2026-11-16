// The first minute after sign-up (16 Nov 2026): the page a sign-up door promised survives onboarding for a new account, only
// pages on the short list do, hostile `next` values never do, the invite keeps its priority, and the promised page says its line
// once. node --test src/lib/firstRunPromise.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  firstRunDestination, forgetFirstRunPath, keepFirstRunPath, loginPathFor, noteArrival, peekArrival, peekFirstRunPath, postSignInPath,
  rememberNextPath, signupPathFor, takeArrival, takeNextPath,
} from './auth-redirect.js';
import { ARRIVAL_LINES, FIRST_RUN_KEYS, arrivalLine, firstRunKey } from './firstRunPromise.mjs';
import { appDeckPath } from './keycardsPublic.mjs';
import { previewFinish } from '../app/onboarding/firstRun.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const MIN = 60 * 1000;

function memoryStore() {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

/** The whole hand-off as a browser runs it: the door's link, the card saving ?next=, then the sign-in finishing. */
function signUpThrough(href, { needsOnboarding = true, store = memoryStore(), now = 1_000_000 } = {}) {
  const next = new URL(href, 'https://www.mockmob.in').searchParams.get('next');
  rememberNextPath(next, { store, now });
  const lands = postSignInPath({ needsOnboarding, store, now: now + 2 * MIN });
  return { lands, store, kept: peekFirstRunPath({ store, now: now + 5 * MIN }) };
}

const CHAPTER = 'accountancy.partnership-fundamentals';
// Every door that names a page (tmp/1116-tools/first-minute-map.md), as the door builds its link today.
const DOORS = [
  { door: 'a public chapter deck', href: signupPathFor(appDeckPath(CHAPTER)), kind: 'chapter', path: `/cards/${CHAPTER}` },
  { door: 'the home Key cards demo and /key-cards', href: signupPathFor('/cards'), kind: 'cards', path: '/cards' },
  { door: '/sunday-mock sign up', href: signupPathFor('/sunday'), kind: 'sunday', path: '/sunday' },
  { door: '/sunday-mock log in', href: loginPathFor('/sunday'), kind: 'sunday', path: '/sunday' },
  { door: 'the Pro key on /pricing', href: loginPathFor('/pricing#plans'), kind: 'pricing', path: '/pricing#plans' },
  { door: 'Start your own Mob', href: loginPathFor('/mob'), kind: 'mob', path: '/mob' },
  { door: 'the Daily Five (once its link carries next)', href: signupPathFor('/daily'), kind: 'daily', path: '/daily' },
  { door: 'the cutoff calculator (once it sends next)', href: loginPathFor('/cuet-cutoff-calculator'), kind: 'cutoffs', path: '/cuet-cutoff-calculator' },
  { door: 'Score Recovery (dormant)', href: '/signup?next=%2Frecovery', kind: 'recovery', path: '/recovery' },
];

test('each door: a new account goes through onboarding, and the promised page is kept for its end', () => {
  for (const { door, href, kind, path } of DOORS) {
    const { lands, kept, store } = signUpThrough(href);
    assert.equal(lands, '/onboarding', `${door}: onboarding still comes first`);
    assert.deepEqual(kept && { kind: kept.kind, path: kept.path }, { kind, path }, `${door}: kept for the end of onboarding`);
    assert.equal(takeNextPath({ store }), null, `${door}: the sign-in return page was read once`);
    assert.equal(peekArrival(kind, { chapter: kept.chapter, store, now: 1_000_000 + 3 * MIN }), false, `${door}: no line before the page is reached`);
  }
});

test('each door: a returning student goes straight to the page, which says its line once', () => {
  for (const { door, href, kind, path } of DOORS) {
    const { lands, kept, store } = signUpThrough(href, { needsOnboarding: false });
    assert.equal(lands, path, `${door}: straight to the page`);
    assert.equal(kept, null, `${door}: nothing kept for onboarding`);
    const chapter = kind === 'chapter' ? CHAPTER : null;
    const at = 1_000_000 + 3 * MIN;
    assert.equal(takeArrival(kind, { chapter, store, now: at }), true, `${door}: the page knows the student came for it`);
    assert.equal(takeArrival(kind, { chapter, store, now: at }), false, `${door}: once`);
  }
});

test('a Mob invite keeps its priority: a new account opens it before onboarding, and nothing else is kept', () => {
  const { lands, kept } = signUpThrough(signupPathFor('/join/MR1SNQ'));
  assert.equal(lands, '/join/MR1SNQ');
  assert.equal(kept, null);
  assert.equal(signUpThrough(signupPathFor('/join/MR1SNQ'), { needsOnboarding: false }).lands, '/join/MR1SNQ');
});

test('doors that name no page, and pages a new account cannot use yet, end onboarding as before', () => {
  for (const href of ['/signup', '/login', '/signup?invite=1', signupPathFor('/today'), signupPathFor('/dashboard'), loginPathFor('/review?x=1'),
    loginPathFor('/result/abc'), loginPathFor('/test?subject=accountancy&mode=quick'), loginPathFor('/onboarding'), loginPathFor('/profile')]) {
    const { lands, kept } = signUpThrough(href);
    assert.equal(lands, '/onboarding', href);
    assert.equal(kept, null, `${href}: nothing kept`);
  }
  // A returning student keeps every page safeNextPath allows, as before.
  assert.equal(signUpThrough(loginPathFor('/review?x=1'), { needsOnboarding: false }).lands, '/review?x=1');
});

test('hostile or malformed next values never become a destination', () => {
  const hostile = [
    'https://evil.example/cards', '//evil.example/cards', '/\\evil.example', '\\\\evil.example', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)',
    'data:text/html,hi', ' https://evil.example', '/ca\nrds', '/cards/accountancy.x\t/y', '/cards\u0000', `/cards/${'a'.repeat(600)}`, '/Cards', '/CARDS/x.y',
    '/cards/', '/cards/../admin', '/cards/%2e%2e/admin', '/cards/x%2F..%2Fadmin', '/cards/accountancy', '/cards/accountancy.x/extra',
    '/cards/%E0%A4%A', '/cards/accountancy.x%00', '/cards/<script>.x', '/cards/a b.c', '/constructor', '/__proto__', '/toString', '/hasOwnProperty',
    '/join/../admin', '/auth/callback', '/api/me', '/login?next=/cards', '/signup', '/_next/static/x', '/cards//evil.example', '///evil.example',
    '/%2F%2Fevil.example', null, undefined, 42, {}, ['/cards'], '',
  ];
  for (const raw of hostile) {
    assert.equal(firstRunDestination(raw), null, `rejected: ${JSON.stringify(raw)}`);
    const store = memoryStore();
    assert.equal(keepFirstRunPath(raw, { store, now: 1 }), null);
    assert.equal(store.map.size, 0, `nothing stored for ${JSON.stringify(raw)}`);
  }
});

test('only the matched parts are kept: queries and hashes are dropped, the plans anchor is the one kept', () => {
  assert.deepEqual(firstRunDestination('/sunday?next=//evil.example#x'), { kind: 'sunday', path: '/sunday' });
  assert.deepEqual(firstRunDestination('/daily?ref=wa'), { kind: 'daily', path: '/daily' });
  assert.deepEqual(firstRunDestination('/pricing#plans'), { kind: 'pricing', path: '/pricing#plans' });
  assert.deepEqual(firstRunDestination('/pricing?x=1#evil'), { kind: 'pricing', path: '/pricing' });
  assert.deepEqual(firstRunDestination(`/cards/${CHAPTER}?mode=last#top`), { kind: 'chapter', path: `/cards/${CHAPTER}`, chapter: CHAPTER });
  assert.deepEqual(firstRunDestination(`/cards/${encodeURIComponent(CHAPTER)}`), { kind: 'chapter', path: `/cards/${CHAPTER}`, chapter: CHAPTER });
  assert.deepEqual(firstRunDestination('/cards?subject=accountancy'), { kind: 'cards', path: '/cards' });
  assert.deepEqual(firstRunDestination(' /cards\n'), { kind: 'cards', path: '/cards' }, 'outer white space is trimmed, as safeNextPath always has');
});

test('the kept page lasts an hour, is re-checked on every read, and a new sign-in drops an old one', () => {
  const store = memoryStore();
  keepFirstRunPath('/sunday', { store, now: 0 });
  assert.equal(peekFirstRunPath({ store, now: 59 * MIN })?.path, '/sunday', 'read as often as needed while onboarding runs');
  assert.equal(peekFirstRunPath({ store, now: 59 * MIN })?.path, '/sunday');
  assert.equal(peekFirstRunPath({ store, now: 61 * MIN }), null, 'gone after an hour');
  assert.equal(store.map.size, 0, 'and removed');

  keepFirstRunPath('/sunday', { store, now: 10 * MIN });
  assert.equal(peekFirstRunPath({ store, now: 0 }), null, 'a mark from the future is not trusted');

  store.setItem('mm_first_run_next', JSON.stringify({ path: 'https://evil.example', at: 1 }));
  assert.equal(peekFirstRunPath({ store, now: 2 }), null, 'a tampered value is rejected');
  store.setItem('mm_first_run_next', JSON.stringify({ path: '/review', at: 1 }));
  assert.equal(peekFirstRunPath({ store, now: 2 }), null, 'a page off the list is rejected');
  store.setItem('mm_first_run_next', '{not json');
  assert.equal(peekFirstRunPath({ store, now: 2 }), null);

  keepFirstRunPath('/sunday', { store, now: 0 });
  rememberNextPath(null, { store, now: 1 });
  assert.equal(peekFirstRunPath({ store, now: 2 }), null, 'opening /signup or /login starts again');

  keepFirstRunPath('/sunday', { store, now: 0 });
  forgetFirstRunPath({ store });
  assert.equal(peekFirstRunPath({ store, now: 1 }), null, 'onboarding forgets it as it opens the page');
});

test('storage that throws or is missing never breaks a sign-in', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(keepFirstRunPath('/sunday', { store: broken }), null);
  assert.equal(peekFirstRunPath({ store: broken }), null);
  assert.doesNotThrow(() => forgetFirstRunPath({ store: broken }));
  assert.doesNotThrow(() => noteArrival({ kind: 'sunday' }, { store: broken }));
  assert.equal(takeArrival('sunday', { store: broken }), false);
  assert.equal(postSignInPath({ needsOnboarding: true, store: broken }), '/onboarding');
  assert.equal(postSignInPath({ needsOnboarding: false, store: broken }), '/today');
});

test('the arrival line: one page, its own chapter, ten minutes, once', () => {
  const store = memoryStore();
  noteArrival({ kind: 'chapter', chapter: CHAPTER }, { store, now: 0 });
  assert.equal(peekArrival('chapter', { chapter: 'economics.money-and-banking', store, now: 1 }), false, 'another chapter says nothing');
  assert.equal(takeArrival('sunday', { store, now: 1 }), false, 'another page says nothing');
  assert.equal(store.map.size, 1, 'and leaves the mark for its page');
  assert.equal(peekArrival('chapter', { chapter: CHAPTER, store, now: 2 }), true);
  assert.equal(peekArrival('chapter', { chapter: CHAPTER, store, now: 2 }), true, 'peeking reads only');
  assert.equal(takeArrival('chapter', { chapter: CHAPTER, store, now: 3 }), true);
  assert.equal(takeArrival('chapter', { chapter: CHAPTER, store, now: 3 }), false, 'once on this device');

  noteArrival({ kind: 'sunday' }, { store, now: 0 });
  assert.equal(takeArrival('sunday', { store, now: 11 * MIN }), false, 'an old mark says nothing');
  assert.equal(store.map.size, 0, 'and is dropped');
  noteArrival(null, { store, now: 0 });
  noteArrival({ path: '/x' }, { store, now: 0 });
  assert.equal(store.map.size, 0, 'nothing without a kind');
});

test('every kept page has its last key; the lines are plain and say only what the page does', () => {
  const kinds = new Set(DOORS.map((d) => d.kind));
  for (const kind of kinds) {
    const words = firstRunKey({ kind });
    assert.ok(words, `${kind} has a last key`);
    assert.match(words.key, /^Finish and [a-z]/, `${kind}: the first run's last key, as "Finish and open Practice" reads`);
    assert.match(words.opening, /^Opening [^.]+…$/);
  }
  assert.equal(firstRunKey(null), null);
  assert.equal(firstRunKey({ kind: 'invented' }), null);
  assert.equal(FIRST_RUN_KEYS.chapter.key, 'Finish and open your Key cards');
  assert.equal(FIRST_RUN_KEYS.daily.key, 'Finish and see your Daily Five');
  const all = [...Object.values(FIRST_RUN_KEYS).flatMap((w) => [w.key, w.opening]), ...Object.values(ARRIVAL_LINES)];
  for (const line of all) {
    assert.doesNotMatch(line, /!|→|->|\p{Extended_Pictographic}/u, line);
    assert.match(line, /^[A-Z]/, `sentence case: ${line}`);
  }
  assert.match(arrivalLine('chapter'), /goes into Revise/, 'the free account’s promise on the public deck, as the app keeps it');
  assert.equal(arrivalLine('daily'), null, 'the Daily Five draws no line here (its page is another lane’s)');
  assert.equal(arrivalLine('nothing'), null);
});

test('the preview mirrors the ending: each promised page opens its view, or the public page itself', () => {
  assert.equal(previewFinish(`/cards/${CHAPTER}`, '?view=onboarding&step=colleges&decks=real&study=on'), `/preview/arena?view=learn2-cards&chapter=${encodeURIComponent(CHAPTER)}&study=on&decks=real`);
  assert.equal(previewFinish('/cards', '?view=onboarding'), '/preview/arena?view=learn2');
  assert.equal(previewFinish('/sunday', '?view=onboarding&plan=free'), '/preview/arena?view=sunday&plan=free');
  assert.equal(previewFinish('/daily', '?view=onboarding'), '/daily');
  assert.equal(previewFinish('/pricing#plans', '?view=onboarding'), '/pricing#plans');
  // As before for the first set and Practice.
  assert.equal(previewFinish('/test?subject=a&count=10&mode=quick&generationKey=k', '?view=onboarding&fresh=1&allowance=on&data=empty'), '/preview/arena?view=test&data=empty&allowance=on&subject=a&count=10&mode=quick&generationKey=k');
  assert.equal(previewFinish('/dashboard?subject=economics', '?view=onboarding&quote=fail'), '/preview/arena?view=dashboard&quote=fail&subject=economics');
});

test('onboarding ends on the promised page, names it on its last key, and reads no quote for the first set then', () => {
  const page = read('src/app/onboarding/OnboardingPageClient.jsx');
  assert.match(page, /firstRunDestination\(\(preview && query\?\.get\('promise'\)\) \|\| promisedPath\)/, 'only the preview takes ?promise=, through the same check');
  assert.match(page, /if \(promised\) \{\s*saveLock\.current = false;\s*forgetFirstRunPath\(\);\s*noteArrival\(promised\);/);
  assert.match(page, /finish\('cheer', promised\.path\);\s*return;/);
  assert.match(page, /const firstSubject = !edit && !promised \? firstSetSubject\(/);
  assert.match(page, /\{promisedKey \? \(finishing \? promisedKey\.opening : promisedKey\.key\)/);
  assert.match(page, /edit \? null : firstRunDestination/, 'Edit subjects never ends on a promised page');
  // The steps themselves are untouched: the same three, the same saves.
  assert.match(read('src/app/onboarding/firstRun.js'), /export const STEPS = Object\.freeze\(\['subjects', 'days', 'colleges'\]\);/);
});

test('the promised pages say their line, drawn with their loaded content', () => {
  const cards = read('src/components/learn2/cards/CardsView.jsx');
  assert.match(cards, /useArrival\('chapter', \{ chapter: chapterKey \}\)/);
  assert.match(cards, /<p className="l2c-ref">\{headLine\}<\/p>\s*<ArrivalLine line=\{arrived\} \/>/);
  const sunday = read('src/components/sunday/SundayPage.jsx');
  assert.match(sunday, /useArrival\('sunday'\)/);
  assert.match(sunday, /\{d\.subjects\.length \? <ArrivalLine line=\{arrived\} className="sun-arrive" \/> : null\}/);
  assert.match(read('src/components/learn2/home/LearnHome.jsx'), /useArrival\('cards'\)/);
  const line = read('src/components/arrival/ArrivalLine.jsx');
  assert.match(line, /useSyncExternalStore\(noSubscribe, \(\) => peekArrival\(kind, \{ chapter \}\), serverNone\)/, 'the server draws no line');
  assert.match(line, /role="status"/);
});

test('the doors build the links the hand-off reads', () => {
  assert.match(read('src/app/key-cards/[subject]/[chapter]/page.js'), /signupHref=\{signupPathFor\(deck\.appPath\)\}/);
  assert.match(read('src/app/sunday-mock/page.js'), /const next = '\/sunday';/);
  assert.match(read('src/components/landing/KeyCardsDemo.jsx'), /const KEEP_GOING_HREF = signupPathFor\('\/cards'\);/);
  assert.match(read('src/components/billing/RazorpayPaymentButton.jsx'), /loginPathFor\('\/pricing#plans'\)/);
  assert.match(read('src/components/mob/join/JoinV3.jsx'), /loginPathFor\('\/mob'\)/);
});
