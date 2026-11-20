// /home-next, the clarity-first home (spec: mockmob-brain/docs/HOME-NEXT-SPEC-2026-11-20.md with Revision 2; owner LK360,
// LK361). What these hold: the words (headings of at most seven words, at most one sentence under each, no em dash, no "!"),
// the autoplay rules (never under reduced motion, each row 6 to 8 seconds, a tap holds), the Mistake Lab's four beats from
// labStory.mjs only, the coverage figures computed from the inventory and the syllabus (never typed), and the page's place:
// noindex, in no sitemap, linked from nowhere, the home sheet loaded after the marketing sheet, nothing the code cannot source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPASS_NEXT, COVER_HEAD, COVER_MIN, FIX, HEADING_MAX_WORDS, LAB_EXAMPLE, LAB_NEXT, PARTS, PRACTICE, PREP_HEAD, RHYTHM,
  SOCIAL_NEXT, TRY_NEXT, chapterLine, coverFine, coverLead, fixPrice, freeFaq, sentences, words,
} from '../../src/components/home2/homeNextCopy.mjs';
import { HOLD_MS, TOUCH_HOLD_MS, autoplayRuns, holdFor, holdKind, keyStep, nextIndex } from '../../src/components/home2/autoplay.mjs';
import { coverageModel, subjectChapters, COVER_MIN as MODEL_MIN } from '../../src/components/home2/coverageModel.mjs';
import { labStory } from '../../src/components/landing/labStory.mjs';
import { EXAM, EXAM_HEAD } from '../../src/components/landing/homeCopy.mjs';
import { SUBJECT_PAGES, subjectBank, syllabusUnits } from '../../src/lib/subjectPages.mjs';
import { publicStatsView } from '../../src/lib/server/publicStats.js';
import { FIRST_SET_COUNT } from '../../src/lib/firstSet.mjs';
import { PAPER_SHARE, PUBLIC_SUBJECT_COUNT } from '../../data/subject_claim.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const PAGE = read('src/app/home-next/page.js');
const S = labStory();

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(jsx?|mjs|css)$/.test(name)) out.push(p);
  }
  return out;
}
const HOME2 = sourceFiles(join(root, 'src/components/home2')).map((p) => ({ rel: relative(root, p).split(sep).join('/'), text: readFileSync(p, 'utf8') }));

// ------------------------------------------------------------------ words
const totals = { covered: 174, chapters: 199, subjects: 15, questions: 5117 }; // a fixture only: the page reads the inventory
const HEADS = [
  [PREP_HEAD.h2, null],
  [TRY_NEXT.h2, TRY_NEXT.sub],
  [LAB_NEXT.h2, null],
  [COVER_HEAD.h2, coverLead(totals.questions).text],
  [RHYTHM.h2, null],
  [COMPASS_NEXT.h2, COMPASS_NEXT.sub],
  [SOCIAL_NEXT.h2, SOCIAL_NEXT.sub],
];

test('every new heading is at most seven words, with at most one sentence under it', () => {
  for (const [h2, sub] of HEADS) {
    assert.ok(words(h2) <= HEADING_MAX_WORDS, `"${h2}" is ${words(h2)} words`);
    if (sub) assert.equal(sentences(sub), 1, `one sentence under "${h2}": "${sub}"`);
  }
});

test('the rows are three or four words and one short line; each beat is one short line', () => {
  for (const part of PARTS) {
    assert.ok(words(part.title) >= 3 && words(part.title) <= 4, part.title);
    assert.ok(words(part.line) <= 12, part.line);
    assert.equal(part.title.split(' ')[0], part.verb, 'the phone chip is the row title’s first word');
  }
  // Revision 2 gives the beats' words (the third is its two short sentences, pinned in the Lab test below).
  for (const beat of LAB_NEXT.beats) assert.ok(words(beat.line) <= 12 && sentences(beat.line) <= 2, beat.line);
});

test('no em dash, no exclamation mark and sentence case in the new words', () => {
  const lines = [
    ...HEADS.flat().filter(Boolean), ...PARTS.flatMap((p) => [p.title, p.line]), ...LAB_NEXT.beats.flatMap((b) => [b.title, b.line, b.unit]),
    LAB_NEXT.after, PRACTICE.nta, FIX.slip, coverFine({ ...totals, countedOn: '20 Nov' }), freeFaq({ freeCredits: 50, dailySize: 5 }).answer,
  ];
  for (const line of lines) {
    assert.doesNotMatch(line, /[—!]/, line);
    assert.doesNotMatch(line, /\b[A-Z]{2,}\b(?<!CUET|NTA|DU|UG|GT|SWOT)/, `no shouting: ${line}`);
  }
});

test('Practise says Unlimited on Pro, the NTA line is the exam section’s own, and the key is the exam view’s', () => {
  assert.match(PARTS[0].line, /Unlimited on Pro\./);
  assert.equal(PRACTICE.nta, 'NTA style is an exact copy of the real NTA exam screen.');
  assert.ok(EXAM_HEAD.sub.startsWith(PRACTICE.nta));
  assert.equal(PRACTICE.full, EXAM.full.open);
  assert.deepEqual(PRACTICE.question, EXAM.questions[EXAM.start.index]);
});

test('Fix says what a brought mistake gives and its price from the app’s own numbers', () => {
  assert.equal(FIX.leave.items.length, 4);
  const price = fixPrice({ photo: true, credits: 1, photoCredits: 2, free: 50 });
  assert.equal(price, 'A typed question uses 1 credit, a photo 2 credits. Free gives you 50 credits a month.');
  // The page builds it from the constants, never from typed figures.
  assert.match(PAGE, /fixPrice\(\{ photo: MISTAKE_PHOTO_ON, credits: MISTAKE_CREDITS, photoCredits: MISTAKE_PHOTO_CREDITS, free: AI_FREE_MONTHLY_CREDITS \}\)/);
});

// ------------------------------------------------------------------ the autoplay
test('the frames never advance under reduced motion, off screen, in a hidden tab, held, or before the page wakes', () => {
  const base = { ready: true, reduced: false, onScreen: true, visible: true, held: false };
  assert.equal(autoplayRuns(base), true);
  for (const key of ['ready', 'onScreen', 'visible']) assert.equal(autoplayRuns({ ...base, [key]: false }), false, key);
  assert.equal(autoplayRuns({ ...base, held: true }), false);
  // Reduced motion wins over every other state, in every combination.
  for (const ready of [true, false]) for (const onScreen of [true, false]) for (const visible of [true, false]) for (const held of [true, false]) {
    assert.equal(autoplayRuns({ ready, reduced: true, onScreen, visible, held }), false);
  }
  assert.equal(autoplayRuns(), false, 'no facts: no autoplay');
});

test('each row holds 6 to 8 seconds for its own demo, a tap holds 8 seconds, and the keys walk the tab list', () => {
  assert.deepEqual([HOLD_MS.min, HOLD_MS.max], [6000, 8000]);
  for (const item of [...PARTS, ...LAB_NEXT.beats]) {
    assert.ok(holdFor(item) >= 6000 && holdFor(item) <= 8000, item.id);
    assert.equal(holdFor(item), item.ms, `${item.id} keeps its own hold`);
  }
  assert.equal(holdFor({ ms: 2000 }), 6000);
  assert.equal(holdFor({ ms: 20000 }), 8000);
  assert.equal(TOUCH_HOLD_MS, 8000);
  assert.equal(nextIndex(3, 4), 0);
  assert.equal(keyStep('ArrowRight', 3, 4), 0);
  assert.equal(keyStep('ArrowLeft', 0, 4), 3);
  assert.equal(keyStep('ArrowDown', 1, 4), 2);
  assert.equal(keyStep('Home', 2, 4), 0);
  assert.equal(keyStep('End', 0, 4), 3);
  assert.equal(keyStep('Enter', 0, 4), null);
  assert.equal(holdKind(0, 'mouse'), 'keyboard');
  assert.equal(holdKind(1, 'mouse'), 'mouse');
  assert.equal(holdKind(1, 'touch'), 'touch');
});

test('the line is the clock: a transform animation paused by data-play, gone under reduced motion, no frame loop', () => {
  const css = read('src/components/home2/home-next.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /@keyframes hn-fill \{ to \{ transform: scaleX\(1\); \} \}/);
  assert.match(css, /\.hn \.hn-auto\[data-play='false'\] \.hn-tab__fill \{ animation-play-state: paused; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\}\s*\.hn \.hn-tab__fill \{ display: none; \}/);
  assert.match(css, /html\[data-motion='reduced'\] \.hn \.hn-tab__fill \{ display: none; \}/);
  assert.equal(/:has\(/.test(css), false, 'no :has() anywhere in the sheet');
  assert.equal(/backdrop-filter/.test(css), false, 'no blur');
  const code = HOME2.filter((f) => /\.(jsx?|mjs)$/.test(f.rel)).map((f) => f.text).join('\n');
  assert.doesNotMatch(code, /requestAnimationFrame|setInterval/, 'no frame loop, no interval');
  const hook = read('src/components/home2/useAutoplay.js');
  assert.match(hook, /motionReduced\(window\)/);
  assert.match(hook, /attributeFilter: \['data-motion'\]/);
  const frame = read('src/components/home2/AutoFrame.jsx');
  assert.match(frame, /\{on && !still \? <i key=\{cycle\} className="hn-tab__fill"/, 'no line at all while still');
  assert.match(frame, /role="tablist"/);
  assert.match(frame, /role="tabpanel"/);
});

// ------------------------------------------------------------------ the Mistake Lab's four beats (labStory.mjs only)
test('the Lab is four beats from labStory: 22 of 50, 18 of 28 in Partnership, 3 changes net minus 6, practise 10', () => {
  const [score, where, changes, next] = LAB_NEXT.beats;
  assert.deepEqual(LAB_NEXT.beats.map((b) => b.id), ['score', 'where', 'changes', 'next']);
  assert.equal(score.line, `You scored ${S.facts.marks} of ${S.facts.outOf}.`);
  assert.equal(where.line, `${S.chapters[0].lost} of your ${S.lostMarks} lost marks are in one chapter: ${S.chapters[0].chapter}.`);
  assert.equal(changes.line, `You changed ${S.changes.length} answers. It cost you ${-S.net} marks.`);
  assert.equal(next.line, `Next: ${S.swot.plan[0].label.charAt(0).toLowerCase()}${S.swot.plan[0].label.slice(1)}.`);
  // The figures Revision 2 names, as the sample stands today (a change to labStory must be seen here).
  assert.deepEqual([score.line, where.line, changes.line, next.line], [
    'You scored 22 of 50.', '18 of your 28 lost marks are in one chapter: Partnership.', 'You changed 3 answers. It cost you 6 marks.', 'Next: practise 10 on Partnership.',
  ]);
  assert.equal(LAB_EXAMPLE.changes.reduce((sum, c) => sum + c.net, 0), S.net);
  assert.equal(LAB_NEXT.example, 'Example');
  assert.match(read('src/components/home2/LabBeats.jsx'), /tag=\{LAB_NEXT\.example\}/, '"Example" stays on the frame');
});

// ------------------------------------------------------------------ coverage: computed, never typed
function fixture() {
  // Two subjects with chapter counts, one without (left out), one with none at all.
  const acc = syllabusUnits('accountancy');
  const eco = syllabusUnits('economics');
  const counts = (units, pick) => Object.fromEntries(units.flatMap((u) => u.sources).map((name, i) => [name, pick(i)]));
  return {
    state: 'available', checkedAt: '2026-11-20T10:00:00Z',
    subjectCounts: { accountancy: 700, economics: 90, english: 40, physics: 12, legal_studies: 999 },
    chapterCounts: { accountancy: counts(acc, (i) => (i % 3 === 0 ? 4 : 25)), economics: counts(eco, (i) => (i % 2 ? 0 : 11)) },
  };
}

test('coverage counts a chapter only at a set’s worth, and agrees with the subject pages’ own sums', () => {
  assert.equal(COVER_MIN, FIRST_SET_COUNT);
  assert.equal(MODEL_MIN, FIRST_SET_COUNT);
  const inv = fixture();
  const model = coverageModel(inv);
  assert.deepEqual(model.subjects.map((s) => s.id), ['accountancy', 'economics'], 'subjects without chapter counts are left out');
  for (const s of model.subjects) {
    const units = syllabusUnits(s.id);
    const bank = subjectBank(inv, s.id, units);
    assert.equal(s.withAny, bank.chaptersCovered, `${s.id}: chapters with any question = the subject page's count`);
    assert.equal(s.questions, bank.questions);
    assert.equal(s.covered, s.chapters.filter((c) => c.count >= COVER_MIN).length);
    assert.deepEqual(s.chapters, subjectChapters(inv.chapterCounts[s.id], units));
    assert.ok(s.chapters.every((c, i) => c.n === i + 1));
  }
  assert.equal(model.totals.questions, publicStatsView(inv).bankSize, 'the bank total is /api/stats’s own figure');
  assert.equal(model.totals.covered, model.subjects.reduce((n, s) => n + s.covered, 0));
  assert.equal(model.countedOn, '20 Nov');
  assert.equal(coverageModel({ state: 'unavailable' }), null);
  assert.equal(coverageModel({ ...inv, chapterCounts: undefined }), null);
  assert.equal(chapterLine({ count: 9 }), '9 questions so far, under a set of 10');
  assert.equal(chapterLine({ count: 0 }), 'No questions in the bank yet');
  assert.equal(chapterLine({ count: 1179 }), '1,179 questions in the bank');
});

test('the coverage lead is the sourced subject claim and the live count, worked out, never typed', () => {
  const lead = coverLead(4321);
  assert.equal(lead.text, `The ${PUBLIC_SUBJECT_COUNT} subjects behind ${PAPER_SHARE.covered} of every ${PAPER_SHARE.outOf} CUET papers, with 4,321 questions in the live bank.`);
  assert.equal(coverLead(null).count, null, 'no count: no number');
  // No bank figure, chapter count or past-paper percentage is written into the page or its parts.
  const typed = /\b5,?117\b|\b1,?179\b|\b19[34] of 199\b|\b174 of 199\b|%\s*of\s*CUET/;
  assert.doesNotMatch(PAGE, typed);
  for (const f of HOME2) assert.doesNotMatch(f.text, typed, f.rel);
  for (const rel of ['src/components/home2/Coverage.jsx', 'src/components/home2/coverageModel.mjs']) {
    const code = read(rel).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(code, /\b\d{3,}\b/, `${rel}: no typed figure`);
  }
  assert.match(PAGE, /const inventory = await publicInventory\(\)/);
  assert.match(PAGE, /coverageModel\(inventory\)/);
});

// ------------------------------------------------------------------ the page's place and its promises
test('/home-next is noindex, in no sitemap and linked from nowhere', () => {
  assert.match(PAGE, /robots: \{ index: false, follow: false, googleBot: \{ index: false, follow: false \} \}/);
  assert.doesNotMatch(read('src/app/sitemap.js'), /home-next/);
  assert.doesNotMatch(read('src/lib/seo.js'), /home-next/);
  const linkers = [];
  for (const p of sourceFiles(join(root, 'src'))) {
    const rel = relative(root, p).split(sep).join('/');
    if (rel.startsWith('src/app/home-next/') || rel.startsWith('src/components/home2/')) continue;
    if (/['"`]\/home-next/.test(readFileSync(p, 'utf8'))) linkers.push(rel);
  }
  assert.deepEqual(linkers, []);
});

test('the page draws the home sections with the home sheet, loaded after the marketing sheet, as "/" does', () => {
  const css = [...PAGE.matchAll(/^import '([^']+\.css)';/gm)].map((m) => m[1]);
  assert.deepEqual(css, ['@/app/marketing.css', '@/components/brand/mobi-figure.css', '../home-sheets.css', '@/components/home2/home-next.css']);
  assert.match(read('src/components/home2/landingParts.js'), /from '\.\.\/landing\/DemoDrill'/);
  // The live home is not touched by this page.
  assert.doesNotMatch(read('src/app/page.js'), /home2|home-next/);
});

test('nothing the code cannot source: no free first mock, no Students heading, prices from the offer', () => {
  assert.match(PAGE, /firstFullMock=\{null\}/);
  assert.doesNotMatch(PAGE, /FIRST_FULL_MOCK/);
  assert.doesNotMatch(SOCIAL_NEXT.h2, /Student/);
  assert.match(PAGE, /const OFFER = publicOffer\(\);/);
  assert.match(PAGE, /heroPriceHook\(OFFER/);
  const all = [PAGE, ...HOME2.map((f) => f.text)].join('\n');
  assert.doesNotMatch(all, /₹\s?\d/, 'no rupee figure typed anywhere');
  assert.doesNotMatch(all, /free (first )?(full )?mock\b/i);
  const faq = freeFaq({ freeCredits: 50, dailySize: 5 });
  assert.ok(faq.answer.split(/\s+/).length <= 45, 'the FAQ answer budget (homeCopy COPY_BUDGET.faq)');
  assert.match(read('src/services/credits/aiCreditWallet.js'), /export const AI_FREE_MONTHLY_CREDITS = 50;/, 'the free credits the FAQ reads');
  assert.match(PAGE, /freeFaq\(\{ freeCredits: AI_FREE_MONTHLY_CREDITS, dailySize: DAILY_FIVE_SIZE \}\)/);
});
