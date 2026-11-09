// The 10 Nov 2026 conversion pass: the sample's result goes with the reader into sign-up (sampleCarry.mjs), the home
// page sends its steps of the aggregate funnel (FunnelBeacon, DemoDrill), and the first-visit theme note no longer hangs
// over a phone page's first words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAMPLE_MAX_AGE_MS, clearSample, packSample, rawSample, readSample, saveSample, signupWords } from './sampleCarry.mjs';
import { FUNNEL_STEPS, SERVER_ONLY_STEPS } from '../../lib/funnelSteps.js';
import { createFunnelTracker } from '../../lib/funnel.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const memory = () => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
};
const NOW = Date.UTC(2026, 10, 10, 6, 0, 0);
const MISSES = [
  { n: 2, chapter: 'Accounting equation', q: 'q', picked: 'a', answer: 'b', why: 'w' },
  { n: 4, chapter: 'Partnership: admission of a partner', q: 'q', picked: 'a', answer: 'b', why: 'w' },
];

test('a finished sample is kept as its score and the missed chapters, named once each, and nothing else', () => {
  const note = packSample({ score: 3, subject: null, misses: MISSES }, NOW);
  assert.deepEqual(note, { score: 3, total: 5, subject: null, chapters: ['Accounting equation', 'Partnership: admission of a partner'], at: NOW });
  // Two misses in one chapter name it once; a live subject keeps its name; long or odd text is cut and cleaned.
  const same = packSample({ score: 2, subject: ' Accountancy ', misses: [{ chapter: 'Ratios' }, { chapter: 'Ratios' }, { chapter: `Cash\nflow ${'x'.repeat(200)}` }] }, NOW);
  assert.deepEqual(same.chapters.slice(0, 1), ['Ratios']);
  assert.equal(same.chapters.length, 2);
  assert.equal(same.chapters[1].length, 80);
  assert.ok(!/\n/.test(same.chapters[1]));
  assert.equal(same.subject, 'Accountancy');
  // Not a finished sample: a score outside 0 to 5, or five right with something missed.
  for (const bad of [{ score: 6 }, { score: -1 }, { score: 'x' }, { score: 5, misses: MISSES }]) assert.equal(packSample(bad, NOW), null);
  assert.deepEqual(packSample({ score: 5 }, NOW).chapters, []);
});

test('the note lives in this browser for a day, is checked again on every read, and is cleared on request', () => {
  const store = memory();
  assert.equal(readSample({ store, now: NOW }), null, 'nothing saved, nothing said');
  assert.ok(saveSample({ score: 3, misses: MISSES }, { store, now: NOW }));
  assert.equal(store.map.size, 1, 'one key');
  assert.equal(typeof rawSample({ store }), 'string');
  assert.deepEqual(readSample({ store, now: NOW + 60_000 }).chapters, ['Accounting equation', 'Partnership: admission of a partner']);
  assert.equal(readSample({ store, now: NOW + SAMPLE_MAX_AGE_MS + 1 }), null, 'a day old: gone');
  assert.equal(readSample({ store, now: NOW - 5 * 60_000 }), null, 'a note from the future is not trusted');
  // Tampered text never reaches the page: a wrong shape, a score with no chapter to name, markup cut to plain length.
  for (const text of ['{', '[]', '{"score":3,"at":"x"}', JSON.stringify({ score: 3, chapters: [], at: NOW }), JSON.stringify({ score: 9, chapters: ['A'], at: NOW })]) {
    store.setItem('mm:sample-result:v1', text);
    assert.equal(readSample({ store, now: NOW }), null, text);
  }
  saveSample({ score: 4, misses: MISSES.slice(0, 1) }, { store, now: NOW });
  clearSample({ store });
  assert.equal(readSample({ store, now: NOW }), null);
  assert.equal(rawSample({ store }), null);
  // No storage (private mode, blocked): the page works, and nothing throws.
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(saveSample({ score: 3, misses: MISSES }, { store: blocked, now: NOW }), null);
  assert.equal(readSample({ store: blocked, now: NOW }), null);
  assert.equal(rawSample({ store: blocked }), null);
  assert.doesNotThrow(() => clearSample({ store: blocked }));
});

test('/signup greets a sample finisher with their own result, in the card’s own promise; anyone else as before', () => {
  assert.equal(signupWords(null), null);
  const three = signupWords(packSample({ score: 3, misses: MISSES }, NOW));
  assert.deepEqual(three, {
    title: 'You got 3 of 5. Keep going.',
    lead: 'Sign up free, then choose chapters like Accounting equation and Partnership: admission of a partner in Practice.',
  });
  // One chapter is named alone; more than two name the first two ("like" covers the rest).
  assert.equal(signupWords(packSample({ score: 4, misses: MISSES.slice(0, 1) }, NOW)).lead, 'Sign up free, then choose chapters like Accounting equation in Practice.');
  const many = signupWords(packSample({ score: 2, misses: [{ chapter: 'A' }, { chapter: 'B' }, { chapter: 'C' }] }, NOW));
  assert.equal(many.lead, 'Sign up free, then choose chapters like A and B in Practice.');
  // A low score is never the headline; five of five is pointed at the full mock, as the card's own verdict does.
  for (const score of [0, 1]) {
    const low = signupWords(packSample({ score, misses: MISSES }, NOW));
    assert.equal(low.title, 'Your five are done. Here’s where to start.');
    assert.ok(!/\d of 5/.test(low.title));
  }
  const five = signupWords(packSample({ score: 5 }, NOW));
  assert.equal(five.title.replace(/ /g, ' '), 'All five right. Now a full mock.');
  assert.ok(five.title.includes('Now a full mock.'), 'the second sentence never splits');
  assert.match(five.lead, /50 questions in 60 minutes, marked \+5 \/ −1/);
  // Copy rules: sentence case, no exclamation mark, no em dash, no marks promised.
  for (const words of [three, many, five]) for (const line of Object.values(words)) {
    assert.ok(!/[!—]/.test(line), line);
    assert.ok(!/\b(guarantee|recover|improve your score|marks back)\b/i.test(line), line);
  }
  assert.equal(signupWords({ score: 3, total: 5, chapters: [] }), null, 'no chapter to name: say nothing');
});

test('the card saves its result when the score appears; /signup reads it, keeps invites first and forgets it once signed in', () => {
  const drill = code(read('./DemoDrill.jsx'));
  assert.match(drill, /import \{ saveSample \} from '\.\/sampleCarry\.mjs';/);
  assert.match(drill, /setDone\(true\);\s*saveSample\(\{ score, subject: live \? live\.name : null, misses: missed \}\);/);
  const signup = code(read('../../app/signup/SignupPageClient.jsx'));
  assert.match(signup, /useSyncExternalStore\(subscribeSample, rawSample, noSample\)/, 'no result on the server render: no mismatch');
  assert.match(signup, /const carried = invite \|\| friendInvited \? null : sample;/);
  assert.match(signup, /carried \? carried\.title : 'Start your CUET 2027 practice\.'/);
  assert.match(signup, /carried \? carried\.lead : 'Keep your recorded mocks, chapter mistakes and saved questions together\.'/);
  assert.match(signup, /if \(status !== 'authenticated'\) return;\s*clearSample\(\);/);
  // Nothing sends the note anywhere: the module makes no request.
  assert.ok(!/fetch\(|sendBeacon|XMLHttpRequest/.test(code(read('./sampleCarry.mjs'))));
});

test('the home page sends its funnel steps: names only, once each, guests only, and only steps the browser may send', () => {
  const beacon = code(read('./FunnelBeacon.jsx'));
  assert.match(beacon, /const guest = status === 'unauthenticated';/);
  assert.match(beacon, /if \(!guest\) return undefined;\s*trackFunnel\('landing_view'\);/);
  assert.match(beacon, /trackFunnel\('signup_click'\)/);
  assert.match(beacon, /trackFunnel\('login_click'\)/);
  assert.match(code(read('../../app/page.js')), /<FunnelBeacon \/>/);
  const drill = code(read('./DemoDrill.jsx'));
  for (const step of ['sample_started', 'sample_subject_chosen', 'sample_done']) assert.match(drill, new RegExp(`trackFunnel\\('${step}'\\)`));
  const sentFromBrowser = [...`${beacon}\n${drill}`.matchAll(/trackFunnel\('([a-z_]+)'\)/g)].map((m) => m[1]);
  for (const step of sentFromBrowser) {
    assert.ok(FUNNEL_STEPS.includes(step), `${step} is on the whitelist`);
    assert.ok(!SERVER_ONLY_STEPS.includes(step), `${step} is not one the server counts itself`);
  }
  // The link test the beacon uses: every way in to /signup and /login, never a look-alike path.
  const signupLink = /^\/signup(?:[/?#]|$)/;
  for (const href of ['/signup', '/signup?next=%2Frecovery', '/signup#x']) assert.ok(signupLink.test(href), href);
  for (const href of ['/signups', '/cuet/signup', 'https://x.test/signup', '/login']) assert.ok(!signupLink.test(href), href);
  // The helper: one beacon per step per page load, the step's name and nothing else.
  const sent = [];
  const track = createFunnelTracker(() => ({ navigator: { sendBeacon: (url, blob) => { sent.push([url, blob.size]); return true; } } }));
  assert.equal(track('landing_view'), true);
  assert.equal(track('landing_view'), false, 'once per page load');
  assert.equal(track('sample_done'), true);
  assert.deepEqual(sent.map(([url]) => url), ['/api/funnel', '/api/funnel']);
  assert.equal(sent[0][1], JSON.stringify({ step: 'landing_view' }).length, 'the body is the step name only');
});

test('on a phone the first-visit theme note is not drawn over the page; the switch still pulses', () => {
  const css = read('../../app/marketing-theme.css');
  assert.match(css, /@media \(max-width: 959px\) \{ \.mm-theme-hint \{ display: none; \} \}/);
  assert.match(css, /\.mm-theme-toggle\[data-hint='true'\] \.mm-theme-toggle__sky \{ animation: mm-theme-nudge/, 'the pulse is the prompt there');
  // The note's timing and its once-only key are untouched: the switch is still marked for the same nine seconds.
  const toggle = code(read('../ThemeToggle.jsx'));
  assert.match(toggle, /window\.setTimeout\(\(\) => setShowHint\(true\), 1400\)/);
  assert.match(toggle, /window\.setTimeout\(\(\) => dismissHint\(\), 9000\)/);
});
