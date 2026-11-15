// The 10 Nov 2026 conversion pass: the sample's result goes with the reader into sign-up (sampleCarry.mjs), the home
// page sends its steps of the aggregate funnel (FunnelBeacon, DemoDrill), and the first-visit theme note no longer hangs
// over a phone page's first words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILT_IN_CHAPTERS, SAMPLE_MAX_AGE_MS, clearSample, packSample, rawSample, readSample, sampleChapters, sampleFirst, sampleLine, samplePlan, sampleSubject, saveSample, signupWords, subjectIdForSlug } from './sampleCarry.mjs';
import { resolveChapter } from '../../../data/cuet_syllabus.js';
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
  assert.deepEqual(note, { score: 3, total: 5, subject: null, slug: null, chapters: ['Accounting equation', 'Partnership: admission of a partner'], at: NOW });
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

test('the card saves its result when the score appears; /signup reads it and keeps invites first; the first run forgets it', () => {
  const drill = code(read('./DemoDrill.jsx'));
  assert.match(drill, /import \{ saveSample \} from '\.\/sampleCarry\.mjs';/);
  assert.match(drill, /setDone\(true\);\s*saveSample\(\{ score, subject: live \? live\.name : null, slug: live \? live\.slug : null, misses: missed \}\);/);
  const signup = code(read('../../app/signup/SignupPageClient.jsx'));
  assert.match(signup, /useSyncExternalStore\(subscribeSample, rawSample, noSample\)/, 'no result on the server render: no mismatch');
  assert.match(signup, /const carried = invite \|\| friendInvited \? null : sample;/);
  assert.match(signup, /carried \? carried\.title : 'Start your CUET 2027 practice\.'/);
  assert.match(signup, /carried \? carried\.lead : 'Keep your recorded mocks, chapter mistakes and saved questions together\.'/);
  // 15 Nov 2026 (F3): /signup no longer forgets it; the first run does, as it ends (onboarding as the first set opens, or Practice).
  assert.doesNotMatch(signup, /clearSample/);
  assert.match(code(read('../../app/onboarding/OnboardingPageClient.jsx')), /clearSample\(\);/);
  assert.match(code(read('../../app/(app)/dashboard/DashboardPageClient.jsx')), /if \(note\) clearSample\(\);/);
  // Nothing sends the note anywhere: the module makes no request.
  assert.ok(!/fetch\(|sendBeacon|XMLHttpRequest/.test(code(read('./sampleCarry.mjs'))));
  // The privacy note says how long it lives and that it never leaves the browser.
  const head = read('./sampleCarry.mjs');
  assert.match(head, /for at most 24 hours/);
  assert.match(head, /It never leaves the browser: no request carries it, and the server never sees it\./);
});

test('into the first run: the slug is kept, the subject is found, and only chapters that map cleanly are preselected', () => {
  // A live set keeps its slug; a note from before (name only) is given it; a slug the card does not offer is dropped.
  assert.equal(packSample({ score: 2, subject: 'Physics', slug: 'physics', misses: [{ chapter: 'Electrostatics' }] }, NOW).slug, 'physics');
  assert.equal(packSample({ score: 2, subject: 'Business Studies', misses: [{ chapter: 'Controlling' }] }, NOW).slug, 'business-studies');
  assert.equal(packSample({ score: 2, subject: 'X', slug: 'nope', misses: [{ chapter: 'A' }] }, NOW).slug, null);
  const store = memory();
  saveSample({ score: 2, subject: 'General Test', slug: 'general-test', misses: [{ chapter: 'Number Series' }] }, { store, now: NOW });
  const live = readSample({ store, now: NOW + 1000 });
  assert.equal(live.slug, 'general-test');
  assert.equal(subjectIdForSlug('general-test'), 'general_test');
  assert.equal(subjectIdForSlug('computer-science'), 'computer_science');
  assert.equal(subjectIdForSlug('x'), null);
  assert.equal(sampleSubject(live), 'general_test');
  // The card's own five: the subject of the first miss.
  const mixed = packSample({ score: 3, misses: [{ chapter: 'Money and banking' }, { chapter: 'Accounting equation' }] }, NOW);
  assert.equal(sampleSubject(mixed), 'economics');
  assert.equal(sampleSubject(packSample({ score: 5 }, NOW)), null, 'five of five names no subject');
  assert.equal(sampleSubject(null), null);
  // Chapters: the built-in map for the card's own five, the resolver for a live set, nothing when unsure.
  assert.deepEqual(sampleChapters(mixed, 'economics'), ['Money & Banking']);
  assert.deepEqual(sampleChapters(mixed, 'accountancy'), [], 'another subject than the sample’s: none');
  assert.deepEqual(sampleChapters(packSample({ score: 4, misses: [{ chapter: 'Accounting equation' }] }, NOW), 'accountancy'), [], 'Class 11: no CUET chapter, none sent');
  const physics = packSample({ score: 2, subject: 'Physics', slug: 'physics', misses: [{ chapter: 'Electrostatic Potential and Capacitance' }, { chapter: 'Not a chapter' }] }, NOW);
  const resolve = (label) => { const hit = resolveChapter('physics', label); return hit && !hit.retired ? hit.name : null; };
  const chapters = sampleChapters(physics, 'physics', { resolve });
  assert.ok(chapters.length <= 1 && !chapters.includes('Not a chapter'), JSON.stringify(chapters));
  assert.deepEqual(sampleChapters(physics, 'physics', { resolve: () => { throw new Error('x'); } }), [], 'a resolver that fails sends nothing');
});

test('the card’s own five: every label is mapped, and every mapped chapter is a live chapter of the bank under its own name', () => {
  const drill = read('./DemoDrill.jsx');
  const labels = [...drill.slice(drill.indexOf('const DRILL = ['), drill.indexOf('];', drill.indexOf('const DRILL = ['))).matchAll(/chapter: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(labels.length, 5);
  assert.deepEqual([...labels].sort(), Object.keys(BUILT_IN_CHAPTERS).sort());
  for (const [label, { subject, chapter }] of Object.entries(BUILT_IN_CHAPTERS)) {
    if (chapter === null) { assert.equal(resolveChapter(subject, label), null, `${label}: no clean chapter, so none`); continue; }
    const hit = resolveChapter(subject, chapter);
    assert.ok(hit && !hit.retired && hit.name === chapter, `${label} -> ${subject} / ${chapter}`);
  }
  // The two the audit named: the card's labels are not the bank's names, so the map carries them.
  assert.equal(resolveChapter('accountancy', 'Partnership: admission of a partner'), null);
  assert.equal(BUILT_IN_CHAPTERS['Partnership: admission of a partner'].chapter, 'Admission of Partner');
  assert.equal(BUILT_IN_CHAPTERS['Money and banking'].chapter, 'Money & Banking');
});

test('onboarding: a sampled Commerce subject goes first in the four; another opens the grid with it ticked', () => {
  const preset = ['accountancy', 'business_studies', 'economics', 'english'];
  const available = [...preset, 'physics', 'mathematics'];
  assert.deepEqual(samplePlan('economics', { preset, available }), { subject: 'economics', mode: 'first' });
  assert.deepEqual(samplePlan('physics', { preset, available }), { subject: 'physics', mode: 'grid' });
  assert.equal(samplePlan('chemistry', { preset, available }), null, 'not offered for practice: nothing changes');
  assert.equal(samplePlan(null, { preset, available }), null);
  assert.deepEqual(sampleFirst(preset, 'economics'), ['economics', 'accountancy', 'business_studies', 'english']);
  assert.deepEqual(sampleFirst(preset, 'physics'), preset);
  assert.equal(sampleLine('Physics'), 'From your sample: Physics');
  const page = code(read('../../app/onboarding/OnboardingPageClient.jsx'));
  assert.match(page, /const sampleOpensGrid = fromSample\?\.mode === 'grid';/);
  assert.match(page, /presetAvailable\(available\) && !sampleOpensGrid;/);
  assert.match(page, /sampleFirst\(\[\.\.\.PRESET_BASE\], sampleLead\)/);
  assert.match(page, /setSelected\(\(now\) => \(now\.length \? now : \[fromSample\.subject\]\)\)/);
  assert.match(page, /sampleLine\(shortSubjectName\(find\(fromSample\.subject\)\)\)/);
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

test('on a phone the first-visit theme note is one short line under the switch, never over the page; the switch still pulses', () => {
  const css = read('../../app/marketing-theme.css');
  // Owner, 10 Nov 2026: the note is back on phones, as a one-line pill that the first scroll or press puts away.
  assert.match(css, /@media \(max-width: 959px\) \{\s*\.mm-theme-hint \{ display: block; top: calc\(100% \+ 1px\);[^}]*white-space: nowrap; \}/);
  assert.match(read('../ThemeToggle.jsx'), /const signs = \['scroll', 'wheel', 'pointerdown'\];/);
  assert.match(css, /\.mm-theme-toggle\[data-hint='true'\] \.mm-theme-toggle__sky \{ animation: mm-theme-nudge/, 'the pulse is the prompt there');
  // The note's timing and its once-only key are untouched: the switch is still marked for the same nine seconds.
  const toggle = code(read('../ThemeToggle.jsx'));
  assert.match(toggle, /window\.setTimeout\(\(\) => setShowHint\(true\), 1400\)/);
  assert.match(toggle, /window\.setTimeout\(\(\) => dismissHint\(\), 9000\)/);
});
