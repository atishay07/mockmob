// /home-next, 21 Nov 2026 (owner LK363): the live home as it is, with ONE frame in place of the tour deck, the Key cards
// section, Bring a mistake and the exam screen section: "Your whole CUET prep, in one place." Three rows, one stage; each
// stage is the landing's own real component, worked by a demo cursor (OnePlace.jsx, onePlaceModel.mjs, demo/CursorDemo.jsx).
// What these hold: the page's place (noindex, in no sitemap, linked from nowhere; "/" untouched with its four sections), the
// order of the sections, the stages being the real components, every script aiming at a hook the component really carries,
// the autoplay rules, no frame loop or interval in the frame's files, and the words (seven-word heading, one sentence, no
// em dash, no "!", only live tools named).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREATORS_SUB, ONE_PLACE, alsoInside, freeFaq } from '../../src/components/landing/onePlaceCopy.mjs';
import {
  ROW_OF_HASH, SCRIPTS, TAKEOVER_HOLD_MS, autoplayRuns, keyStep, motionReduced, nextIndex, scriptHooks, scriptMs,
} from '../../src/components/landing/onePlaceModel.mjs';
import { BRING_MISTAKE } from '../../src/components/landing/bringMistakeCopy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const PAGE = read('src/app/home-next/page.js');
const LIVE = read('src/app/page.js');
const FRAME = read('src/components/landing/OnePlace.jsx');
const EXAM_SRC = read('src/components/landing/ExamScreen.jsx');
const CARDS_SRC = read('src/components/landing/KeyCardsDemo.jsx');
const BMK_SRC = read('src/components/landing/BringMistakeBlock.jsx');
const words = (text) => String(text).trim().split(/\s+/).filter(Boolean).length;
const sentences = (text) => (String(text).replace(/(\d)\.(\d)/g, '$1,$2').match(/[^.?]+[.?]/g) || []).length;

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(jsx?|mjs|css)$/.test(name)) out.push(p);
  }
  return out;
}

// ------------------------------------------------------------------ the page's place
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

test('"/" is untouched: it still draws the tour deck, Key cards, Bring a mistake and the exam screen, and none of this page', () => {
  assert.match(LIVE, /<TourDeck slides=\{TOUR\} samples=\{TOUR_SAMPLES\} \/>/);
  assert.match(LIVE, /id="your-prep"/);
  assert.match(LIVE, /id="key-cards"/);
  assert.match(LIVE, /<KeyCardsDemo cards=\{KEY_CARDS\.cards\} keys=\{KEY_CARDS\.keys\} bank=\{KEY_CARDS\.bank\} subjects=\{KEY_CARDS\.subjects\} \/>/);
  assert.match(LIVE, /<BringMistakeBlock photo=\{MISTAKE_PHOTO_ON\} credits=\{MISTAKE_CREDITS\} photoCredits=\{MISTAKE_PHOTO_CREDITS\} \/>/);
  assert.match(LIVE, /<Later><ExamScreen \/><\/Later>/);
  assert.match(LIVE, /<LabCinema \/>/);
  assert.doesNotMatch(LIVE, /home2|home-next|OnePlace|onePlace/);
});

test('the shared components keep the live markup by default (their new props are optional and off on "/")', () => {
  // ExamScreen is the section with its head, drawn through ExamStage; the gate card stays on by default.
  assert.match(EXAM_SRC, /export function ExamScreen\(\) \{\n  return \(\n    <section className="lp-sec xs" id="exam-experience" aria-labelledby="exam-title">\n      <div className="mm-wrap">\n        <ExamStage head=\{<>/);
  assert.match(EXAM_SRC, /export function ExamStage\(\{ head = null, gate = true \}\)/);
  assert.match(EXAM_SRC, /<div className="xs-layout">\n        \{head\}/);
  // Key cards draws its foot unless asked not to; Bring a mistake's block passes its own id to the card.
  assert.match(CARDS_SRC, /export default function KeyCardsDemo\(\{ cards = \[\], keys = \[\], bank = null, subjects = null, foot = true \}\)/);
  assert.match(CARDS_SRC, /\{foot \? <div className="kc-foot">/);
  assert.match(BMK_SRC, /<BringMistakeCard id=\{id\} photo=\{photo\} \/>/);
  assert.match(BMK_SRC, /export function BringMistakeCard\(\{ id: given, photo = false \}\)/);
  assert.match(BMK_SRC, /const id = given \|\| own;/);
});

test('/home-next draws the new section and none of the four it replaces, in the live order around it', () => {
  for (const gone of [/<TourDeck/, /id="key-cards"/, /<KeyCardsDemo/, /<BringMistakeBlock/, /<ExamScreen/, /TOUR_HEAD/]) assert.doesNotMatch(PAGE, gone);
  assert.match(PAGE, /<section className="lp-sec op" id="your-prep" aria-labelledby="op-title">/);
  assert.match(PAGE, /<OnePlace keyCards=\{KEY_CARDS\} photo=\{MISTAKE_PHOTO_ON\} \/>/);
  assert.match(PAGE, /<LandingActions mode="primary" \/>/);
  assert.match(PAGE, /<LabCinema look="next" \/>/);
  const order = ['className="lp-hero"', '<CollegeStrip', 'id="try"', 'id="your-prep"', '<Statement', 'id="inside-the-lab"', 'id="daily-and-sunday"', 'id="compass"', 'id="pricing"', 'id="on-instagram"', 'id="wall-of-love"', 'id="faq"', 'className="lp-close"'];
  const at = order.map((mark) => PAGE.indexOf(mark));
  assert.ok(at.every((i) => i > 0), `every section is drawn: ${order.filter((_, i) => at[i] < 0)}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'hero, colleges, Try five, the new section, Statement, Lab, then as on "/"');
  // The guide's waypoint for this part of the page is still the section's id; the Lab is the one held story in the band.
  assert.match(read('src/components/brand/PipGuide.jsx'), /section: 'your-prep'/);
  assert.match(PAGE, /const POSITION = \[\n  \{ id: 'inside-the-lab', name: 'Inside the Mistake Lab' \},\n\];/);
});

test('the page draws the home sections with the home sheet, loaded after the marketing sheet, as "/" does', () => {
  const css = [...PAGE.matchAll(/^import '([^']+\.css)';/gm)].map((m) => m[1]);
  assert.deepEqual(css, ['@/app/marketing.css', '@/components/brand/mobi-figure.css', '../home-sheets.css']);
  assert.match(read('src/components/home2/landingParts.js'), /from '\.\.\/landing\/LabCinema'/);
});

// ------------------------------------------------------------------ the stages are the real components
test('each stage is the landing\'s own component, not a drawn stand-in', () => {
  assert.match(FRAME, /import \{ ExamStage \} from '\.\/ExamScreen';/);
  assert.match(FRAME, /import KeyCardsDemo from '\.\/KeyCardsDemo';/);
  assert.match(FRAME, /import \{ BringMistakeCard \} from '\.\/BringMistakeBlock';/);
  assert.match(FRAME, /import CursorDemo from '\.\/demo\/CursorDemo';/);
  assert.match(FRAME, /if \(row\.id === 'practise'\) return <ExamStage \/>;/);
  assert.match(FRAME, /<KeyCardsDemo cards=\{keyCards\.cards\} keys=\{keyCards\.keys\} bank=\{keyCards\.bank\} subjects=\{keyCards\.subjects\} foot=\{false\} \/>/);
  assert.match(FRAME, /<BringMistakeCard photo=\{photo\} \/>/);
  // Key cards and Ask Mobi sit in the exam monitor's own browser bar, at the addresses they really live at in the app.
  assert.match(FRAME, /<div className="xs-browser op-win__bar" aria-hidden="true">/);
  assert.match(FRAME, /<AppWindow path=\{row\.path\}><div className="op-kc"><KeyCardsDemo/);
  assert.match(FRAME, /<AppWindow path=\{row\.path\}><div className="bmk op-bmk"><BringMistakeCard/);
  assert.deepEqual(ONE_PLACE.rows.map((r) => r.path), [undefined, '/cards', '/mentor']);
  assert.match(read('src/components/landing/bringMistakeCopy.mjs'), /export const BRING_MISTAKE_PATH = '\/mentor';/);
  assert.ok(sourceFiles(join(root, 'src/app/(app)/cards')).length > 0, 'Key cards live at /cards');
  // Every stage starts fresh: the shown one is keyed by the run, the others idle.
  assert.match(FRAME, /key=\{on \? `on-\$\{cycle\}` : 'idle'\}/);
});

test('every script aims at a data-demo hook its component really carries', () => {
  const sourceOf = { practise: EXAM_SRC, cards: CARDS_SRC, mobi: BMK_SRC };
  assert.deepEqual(Object.keys(SCRIPTS).sort(), ['cards', 'mobi', 'practise']);
  for (const [tool, steps] of Object.entries(SCRIPTS)) {
    const hooks = scriptHooks(steps);
    assert.ok(hooks.length >= 2, `${tool} has targets`);
    for (const hook of hooks) assert.ok(sourceOf[tool].includes(`data-demo="${hook}"`), `${tool}: data-demo="${hook}" is in the component`);
    for (const step of steps) if (step.target) assert.match(step.target, /^\[data-demo="[\w-]+"\](:nth-child\(\d\))?$/, `${tool}: ${step.target}`);
  }
  // Practise switches to NTA style in the middle and ends on NTA's own keys; Ask Mobi picks the fresh question's right option.
  const p = SCRIPTS.practise.map((s) => s.target);
  assert.ok(p.indexOf('[data-demo="xs-nta"]') > p.indexOf('[data-demo="xs-next"]'));
  assert.equal(p.at(-1), '[data-demo="xs-n-mark"]');
  assert.ok(p.includes('[data-demo="xs-n-save"]'));
  assert.ok(SCRIPTS.mobi.some((s) => s.target === `[data-demo="bmk-option"]:nth-child(${BRING_MISTAKE.check.correct + 1})`));
  assert.equal(SCRIPTS.cards.filter((s) => s.target === '[data-demo="kc-turn"]').length, 2, 'turn, rate, turn the next');
});

test('each row runs for its own script, about 8 seconds, and its line fills over exactly that', () => {
  for (const [tool, steps] of Object.entries(SCRIPTS)) {
    const ms = scriptMs(steps);
    assert.ok(ms >= 6000 && ms <= 11000, `${tool}: ${ms} ms`);
    for (const step of steps) if (step.target) assert.ok(Number.isFinite(step.move) && Number.isFinite(step.dwell), `${tool}: every step names its move and dwell`);
  }
  assert.equal(scriptMs([{ wait: 500 }, { target: 'x', move: 400, dwell: 600, click: true }]), 220 + 260 + 500 + 400 + 130 + 600);
  assert.match(FRAME, /'--op-ms': `\$\{scriptMs\(SCRIPTS\[row\.id\]\)\}ms`/);
});

test('the frame never plays under reduced motion, off screen, in a hidden tab, held, or before the page wakes', () => {
  assert.equal(autoplayRuns({ ready: true, reduced: false, onScreen: true, visible: true, held: false }), true);
  for (const off of [{ ready: false }, { reduced: true }, { onScreen: false }, { visible: false }, { held: true }]) {
    assert.equal(autoplayRuns({ ready: true, reduced: false, onScreen: true, visible: true, held: false, ...off }), false, JSON.stringify(off));
  }
  assert.equal(autoplayRuns(), false);
  assert.equal(motionReduced(undefined), true);
  assert.equal(motionReduced({ matchMedia: () => ({ matches: false }), document: { documentElement: { dataset: { motion: 'reduced' } } } }), true);
  assert.equal(motionReduced({ matchMedia: () => ({ matches: false }), document: { documentElement: { dataset: {} } } }), false);
  assert.equal(nextIndex(2, 3), 0);
  assert.equal(nextIndex(0, 3), 1);
  assert.equal(keyStep('ArrowDown', 2, 3), 0);
  assert.equal(keyStep('ArrowLeft', 0, 3), 2);
  assert.equal(keyStep('End', 0, 3), 2);
  assert.equal(keyStep('a', 0, 3), null);
  assert.equal(TAKEOVER_HOLD_MS, 8000);
  assert.deepEqual(ROW_OF_HASH, { '#exam-experience': 'practise', '#key-cards': 'cards', '#bring-a-mistake': 'mobi' });
});

test('no frame loop and no interval in the new section\'s files; transform and opacity only, no blur', () => {
  const files = ['src/components/landing/OnePlace.jsx', 'src/components/landing/onePlaceModel.mjs', 'src/components/landing/onePlaceCopy.mjs', 'src/components/landing/demo/CursorDemo.jsx'];
  for (const f of files) assert.doesNotMatch(read(f), /requestAnimationFrame|setInterval/, f);
  for (const f of ['src/components/landing/one-place.css', 'src/components/landing/demo/cursor-demo.css']) {
    const css = read(f);
    assert.doesNotMatch(css, /backdrop-filter|filter:\s*blur|:has\(/, f);
    for (const block of css.matchAll(/@keyframes [\w-]+ \{([^@]*?)\}\s*\}/g)) assert.doesNotMatch(block[1], /\b(width|height|top|left|margin|padding)\s*:/, `${f}: keyframes animate transform and opacity only`);
  }
});

// ------------------------------------------------------------------ words
test('the heading is at most seven words with one sentence under it; each row is a name and one short line', () => {
  assert.ok(words(ONE_PLACE.h2) <= 7, ONE_PLACE.h2);
  assert.equal(sentences(ONE_PLACE.sub), 1);
  assert.ok(ONE_PLACE.h2.endsWith(ONE_PLACE.mark));
  assert.deepEqual(ONE_PLACE.rows.map((r) => r.id), ['practise', 'cards', 'mobi']);
  for (const row of ONE_PLACE.rows) {
    assert.ok(words(row.name) <= 2, row.name);
    assert.equal(sentences(row.line), 1, row.line);
    assert.ok(words(row.line) <= 10, row.line);
  }
  const all = [ONE_PLACE.h2, ONE_PLACE.sub, ...ONE_PLACE.rows.flatMap((r) => [r.name, r.line]), CREATORS_SUB, alsoInside({ studyLive: true, mobLive: true }).text];
  for (const line of all) {
    assert.doesNotMatch(line, /[—!]/, line);
    assert.match(line, /^[A-Z0-9]/, line);
  }
});

test('"Also inside" names only the tools that are live, from the tour\'s own switches', () => {
  assert.equal(alsoInside({ studyLive: true, mobLive: true }).text, 'Also inside: Learn, Benchmarks and the Mob.');
  assert.equal(alsoInside({ studyLive: false, mobLive: true }).text, 'Also inside: Benchmarks and the Mob.');
  assert.equal(alsoInside({ studyLive: true, mobLive: false }).text, 'Also inside: Learn and Benchmarks.');
  assert.equal(alsoInside({}).text, 'Also inside: Benchmarks.');
  assert.match(PAGE, /const ALSO = alsoInside\(\{ studyLive: STUDY_LIVE, mobLive: MOB_LIVE \}\);/);
  assert.match(PAGE, /const MOB_LIVE = process\.env\.MOB_ENABLED === 'true' && process\.env\.MOB_V3_ENABLED === 'true';/);
  assert.match(PAGE, /const STUDY_LIVE = process\.env\.STUDY_CONTENT_ENABLED === 'true' && process\.env\.STUDY_RECALL_ENABLED === 'true';/);
  assert.ok(sourceFiles(join(root, 'src/app/features')).length > 0, 'the line links the features page');
  assert.equal(ONE_PLACE.alsoHref, '/features');
});

test('carried over from the first /home-next: the creators\' sign-up floor and "What do I get free?" from the constants', () => {
  assert.match(CREATORS_SUB, /^1,500\+ students have signed up/);
  assert.match(PAGE, /<p className="lp-sub">\{CREATORS_SUB\}<\/p>/);
  const faq = freeFaq({ freeCredits: 50, dailySize: 5 });
  assert.equal(faq.question, 'What do I get free?');
  assert.ok(faq.answer.split(/\s+/).length <= 45, 'the FAQ answer budget (homeCopy COPY_BUDGET.faq)');
  assert.match(read('src/services/credits/aiCreditWallet.js'), /export const AI_FREE_MONTHLY_CREDITS = 50;/, 'the free credits the FAQ reads');
  assert.match(PAGE, /freeFaq\(\{ freeCredits: AI_FREE_MONTHLY_CREDITS, dailySize: DAILY_FIVE_SIZE \}\)/);
  assert.match(PAGE, /<ReadLineHere \/>/);
  assert.match(PAGE, /<SampleHere \/>/);
});
