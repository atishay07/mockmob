// /home-next, 21 Nov 2026 (owner LK363): the live home as it is, with ONE frame in place of the tour deck, the Key cards
// section, Bring a mistake and the exam screen section: "Your whole CUET prep, in one place." Three rows, one stage; each
// stage is the landing's own real component, worked by a demo cursor; rows 4 to 6 (owner LK364) are the tour deck's Learn,
// Benchmarks and Mob screens on the deck's card (OnePlace.jsx, onePlaceModel.mjs, demo/CursorDemo.jsx).
// What these hold: the page's place (noindex, in no sitemap, linked from nowhere; "/" untouched with its four sections), the
// order of the sections, the stages being the real components, every script aiming at a hook the component really carries,
// the autoplay rules, no frame loop or interval in the frame's files, and the words (seven-word heading, one sentence, no
// em dash, no "!", only live tools named).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREATORS_SUB, ONE_PLACE, bankLine, freeFaq, mobiPrice, tourRows } from '../../src/components/landing/onePlaceCopy.mjs';
import { EXAM_HEAD, INSTAGRAM_HEAD, TOUR_ICON, buildTour } from '../../src/components/landing/homeCopy.mjs';
import {
  DEAL_MS, PHONE_PANE, PHONE_ROWS, ROW_MAX_MS, ROW_OF_HASH, SCRIPTS, TAKEOVER_HOLD_MS, TRIGGER_LINE, afterRow, autoplayRuns, keyStep, leaveStartsHold,
  motionReduced, nextIndex, runStep, scriptHooks, scriptMs,
} from '../../src/components/landing/onePlaceModel.mjs';
import { BRING_MISTAKE } from '../../src/components/landing/bringMistakeCopy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Line ends normalised: the release gate's checkout writes CRLF, and the patterns below are written with \n.
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const PAGE = read('src/app/home-next/page.js');
const LIVE = read('src/app/page.js');
const FRAME = read('src/components/landing/OnePlace.jsx');
const { stagesStart, stagesStep, STAGE_LEAD_MS } = await import('../../src/components/landing/onePlaceModel.mjs');
const { OPENING_FAST, openingGateScript } = await import('../../src/components/landing/openingGate.mjs');
const EXAM_SRC = read('src/components/landing/ExamScreen.jsx');
const CARDS_SRC = read('src/components/landing/KeyCardsDemo.jsx');
const BMK_SRC = read('src/components/landing/BringMistakeBlock.jsx');
const TOUR_SRC = read('src/components/landing/TourScreens.jsx');
const CSS = read('src/components/landing/one-place.css');
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
    // NavBar names the path only to draw the home's Pricing pill there too (a pathname check, not a link).
    const text = readFileSync(p, 'utf8').replace(/pathname === '\/home-next'/g, '');
    if (/['"`]\/home-next/.test(text)) linkers.push(rel);
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
  assert.match(EXAM_SRC, /export function ExamStage\(\{ head = null, gate = true, note = null, inline = false \}\)/);
  // `inline` (off on "/"): below 640 px the phone view in the monitor's place; without it the monitor is drawn as before.
  assert.match(EXAM_SRC, /if \(!inline\) return undefined;\n\s*const query = window\.matchMedia\('\(max-width: 639px\)'\);/);
  assert.match(EXAM_SRC, /\{inlineNow \? \(\n\s*<div className="xs-inline" ref=\{deviceRef\}>\n\s*\{full \? <div className="xs-frame xs-frame--away" aria-hidden="true" \/> : phone\}/);
  assert.doesNotMatch(read('src/app/page.js'), /inline/);
  // The gate's short form drops only the warning rule; by default it is drawn as before.
  assert.match(EXAM_SRC, /<b>\{EXAM\.gateTitle\}\.<\/b> \{EXAM\.gate\}\{gate === 'short' \? null : <> \{EXAM\.warningRule\}<\/>\}/);
  assert.match(EXAM_SRC, /<div className="xs-layout">\n        \{head\}/);
  // Key cards draws its foot unless asked not to; Bring a mistake's block passes its own id to the card.
  assert.match(CARDS_SRC, /export default function KeyCardsDemo\(\{ cards = \[\], keys = \[\], bank = null, subjects = null, foot = true \}\)/);
  assert.match(CARDS_SRC, /\{foot \? <div className="kc-foot">/);
  assert.match(BMK_SRC, /<BringMistakeCard id=\{id\} photo=\{photo\} \/>/);
  // "What you leave with" is its own piece now; the block draws it with its own id, as before.
  assert.match(BMK_SRC, /<BringMistakeValue id=\{id\} \/>/);
  assert.match(BMK_SRC, /export function BringMistakeValue\(\{ id: given \}\)/);
  assert.match(BMK_SRC, /export function BringMistakeCard\(\{ id: given, photo = false \}\)/);
  assert.match(BMK_SRC, /const id = given \|\| own;/);
});

test('/home-next draws the new section and none of the four it replaces, in the live order around it', () => {
  for (const gone of [/<TourDeck/, /id="key-cards"/, /<KeyCardsDemo/, /<BringMistakeBlock/, /<ExamScreen/, /TOUR_HEAD/]) assert.doesNotMatch(PAGE, gone);
  assert.match(PAGE, /<section className="lp-sec op" id="your-prep" aria-labelledby="op-title">/);
  assert.match(PAGE, /<OnePlaceGate keyCards=\{KEY_CARDS\} photo=\{MISTAKE_PHOTO_ON\} price=\{MOBI_PRICE\} tour=\{TOUR\} samples=\{TOUR_SAMPLES\}>\n\s*<LandingActions mode="primary" \/>\n\s*<\/OnePlaceGate>/);
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
  assert.match(FRAME, /import \{ BringMistakeCard, BringMistakeValue \} from '\.\/BringMistakeBlock';/);
  assert.match(FRAME, /import CursorDemo from '\.\/demo\/CursorDemo';/);
  assert.match(FRAME, /if \(row\.id === 'practise'\) return <ExamStage gate="short" inline note=\{<p className="op-proof op-proof--switch">\{ONE_PLACE\.practiseProof\}<\/p>\} \/>;/);
  // Key cards draws its own foot (shown on phones only, without its sign-up key: one-place.css).
  assert.match(FRAME, /<KeyCardsDemo cards=\{keyCards\.cards\} keys=\{keyCards\.keys\} bank=\{keyCards\.bank\} subjects=\{keyCards\.subjects\} \/>/);
  const css = read('src/components/landing/one-place.css');
  assert.match(css, /\.op-kc \.kc-foot > \.mm-btn \{ display: none; \}/);
  // Phones keep the frame's rows close in height: Key cards without its subject chips, Ask Mobi's list as its four heads.
  assert.match(css, /  \.op-kc \.kc-open \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 639px\) \{ \.mm\.lp \.op-bmk \.bmk__get-line \{ display: none; \} \}/);
  assert.match(css, /@media \(min-width: 640px\) \{ \.op-kc \.kc-foot \{ display: none; \} \}/);
  // Phones: no gate card and no saved line in the frame; the inline runner starts with its strike-out note dismissed.
  assert.match(css, /@media \(max-width: 639px\) \{ \.op-slot\[data-tool='practise'\] \.xs-gate \{ display: none; \} \}/);
  assert.match(EXAM_SRC, /const sync = \(\) => \{ setInlineNow\(query\.matches\); if \(query\.matches\) setNoteOn\(false\); \};/);
  // The inline runner is never a scroller: a swipe on it moves the page (lane-hn-weight's runs got stuck on the stem). Its
  // panes are clipped with no scroll containment, and the view passes vertical pans to the page. The full-screen view and
  // "/" keep their own scrolling panes (exam-screen.css is not touched).
  assert.match(css, /\.op-slot\[data-tool='practise'\] \.xs-layout > \.xs-inline \{ overflow: clip; touch-action: pan-y; \}/);
  // Hidden, not clipped: the demo cursor sets the paper's scrollTop (`reveal`), and a hidden overflow is never a scroller a
  // finger can catch (tmp/1121-oneplace/swipe.mjs).
  assert.match(css, /\.op-slot\[data-tool='practise'\] \.xs-inline :is\(\.xs-ph-paper, \.xs-ph-pane\) \{ overflow: hidden; overscroll-behavior: auto; touch-action: pan-y; \}/);
  // Phones: the runner fits the window under the chips and the switch (key bar on screen at 676 px tall); nothing else above
  // it (no caption, the NTA line under it), no full-screen key in the frame; a charcoal device edge in Night.
  assert.match(css, /\.op-slot\[data-tool='practise'\] \.xs-layout > \.xs-inline \{ height: min\(560px, calc\(100svh - 216px\)\); \}/);
  assert.match(css, /\.op-slot\[data-tool='practise'\] \.xs-layout \{ grid-template-areas: 'switch' 'device' 'note'; \}/);
  assert.match(css, /@media \(max-width: 639px\) \{\n  \.op-caption \{ display: none; \}/);
  assert.match(css, /\.op-slot\[data-tool='practise'\] \.xs-layout > \.xs-full-open \{ display: none; \}/);
  assert.match(css, /html\[data-theme='dark'\] \.op-slot\[data-tool='practise'\] \.xs-layout > \.xs-inline \{\n\s*border: 7px solid #1c1a16; border-radius: 22px;/);
  // Desktop from 1280 px: "What you leave with" in the Ask Mobi window too.
  assert.match(css, /@media \(min-width: 1280px\) \{\n  \.mm\.lp \.op-win \.op-bmk \{ grid-template-columns: minmax\(0, 3fr\) minmax\(0, 2fr\); align-items: center; \}\n  \.mm\.lp \.op-win \.op-bmk \.bmk__value \{ display: grid;/);
  assert.match(read('src/app/exam-screen.css'), /\.xs-ph-paper \{[^}]*overflow-y: auto; overscroll-behavior: contain;/);
  assert.match(FRAME, /<BringMistakeCard photo=\{photo\} \/>/);
  // Phones: the live block's "What you leave with" under the card (hidden from 640 px).
  assert.match(FRAME, /<BringMistakeCard photo=\{photo\} \/><BringMistakeValue \/><\/div>/);
  assert.match(read('src/components/landing/one-place.css'), /@media \(min-width: 640px\) \{ \.mm\.lp \.op-bmk \.bmk__value \{ display: none; \} \}/);
  // Key cards and Ask Mobi sit in the exam monitor's own browser bar, at the addresses they really live at in the app.
  assert.match(FRAME, /<div className="xs-browser op-win__bar" aria-hidden="true">/);
  assert.match(FRAME, /<AppWindow path=\{row\.path\}><div className="op-kc"><KeyCardsDemo/);
  assert.match(FRAME, /<AppWindow path=\{row\.path\} fill><div className="bmk op-bmk"><BringMistakeCard/);
  assert.deepEqual(ONE_PLACE.rows.map((r) => r.path), [undefined, '/cards', '/mentor']);
  assert.match(read('src/components/landing/bringMistakeCopy.mjs'), /export const BRING_MISTAKE_PATH = '\/mentor';/);
  assert.ok(sourceFiles(join(root, 'src/app/(app)/cards')).length > 0, 'Key cards live at /cards');
  // Every stage starts fresh: a live stage is keyed by its mount generation, which moves on before a stage that has played
  // plays again (onePlaceModel.mjs stagesStep; the behaviour is held in the load-weight test below).
  assert.match(FRAME, /<CursorDemo key=\{`run-\$\{stages\.gen\[i\]\}`\}/);
});

test('every script aims at a data-demo hook its component really carries', () => {
  const sourceOf = { practise: EXAM_SRC, cards: CARDS_SRC, mobi: BMK_SRC };
  assert.deepEqual(Object.keys(SCRIPTS), ['practise', 'cards', 'mobi', 'learn', 'rival', 'mob']);
  // Rows 4 to 6 work the old tour deck's own screens: every class a script aims at is drawn by TourScreens.jsx.
  for (const tool of ONE_PLACE.tourIds) {
    const targets = SCRIPTS[tool].filter((s) => s.target).map((s) => s.target);
    assert.ok(targets.length >= 2, `${tool} has targets`);
    for (const target of targets) for (const cls of target.match(/\.ts__[\w-]+/g)) assert.match(TOUR_SRC, new RegExp(`className="[^"]*\\b${cls.slice(1)}\\b`), `${tool}: ${cls}`);
  }
  for (const [tool, steps] of Object.entries(SCRIPTS).filter(([id]) => !ONE_PLACE.tourIds.includes(id))) {
    const hooks = scriptHooks(steps);
    assert.ok(hooks.length >= 2, `${tool} has targets`);
    for (const hook of hooks) assert.ok(sourceOf[tool].includes(`data-demo="${hook}"`), `${tool}: data-demo="${hook}" is in the component`);
    for (const step of steps) if (step.target) assert.match(step.target, /^\[data-demo="[\w-]+"\](:nth-child\(\d\))?$/, `${tool}: ${step.target}`);
  }
  // Practise switches to NTA style in the middle and ends on NTA's Save & Next (the key beside the palette); Ask Mobi picks
  // the fresh question's right option.
  const p = SCRIPTS.practise.filter((s) => s.target).map((s) => s.target);
  assert.ok(p.indexOf('[data-demo="xs-nta"]') > p.indexOf('[data-demo="xs-next"]'));
  assert.equal(p.at(-1), '[data-demo="xs-n-save"]');
  assert.equal(p.filter((t) => t === '[data-demo="xs-n-save"]').length, 1);
  assert.ok(SCRIPTS.mobi.some((s) => s.target === `[data-demo="bmk-option"]:nth-child(${BRING_MISTAKE.check.correct + 1})`));
  assert.equal(SCRIPTS.cards.filter((s) => s.target === '[data-demo="kc-turn"]').length, 2, 'turn, rate, turn the next');
});

test('each row runs for its own script, 8 seconds or less, and its line fills over exactly that', () => {
  assert.equal(ROW_MAX_MS, 8000);
  for (const [tool, steps] of Object.entries(SCRIPTS)) {
    const ms = scriptMs(steps);
    assert.ok(ms >= 5000 && ms <= ROW_MAX_MS, `${tool}: ${ms} ms`);
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
  // One pass, then rest on the last finished screen (no wrap to the first).
  assert.equal(afterRow(0, 3), 1);
  assert.equal(afterRow(1, 3), 2);
  assert.equal(afterRow(2, 3), null);
  assert.match(FRAME, /const playing = phase === 'running' && autoplayRuns\(\{ ready, reduced, onScreen: inView, visible, held \}\);/);
  // A finger lifting ends the pointer too: only a mouse leaving starts the 8 s hold, and the stage is never remounted under
  // a reader who took over (the frame leaving the window, or another row, lets them go).
  assert.equal(leaveStartsHold('mouse'), true);
  assert.equal(leaveStartsHold('touch'), false);
  assert.equal(leaveStartsHold('pen'), false);
  assert.match(FRAME, /if \(event\?\.type === 'pointerleave' && !leaveStartsHold\(event\.pointerType\)\) return;/);
  assert.deepEqual(ROW_OF_HASH, { '#exam-experience': 'practise', '#key-cards': 'cards', '#bring-a-mistake': 'mobi' });
});

test('the run starts when the heading reaches the top of the window and plays every row to the end (owner LK364)', () => {
  assert.equal(TRIGGER_LINE, 0.15);
  // The heading crossing the line upwards, the code arriving with it already above, a frame back with it above: one start.
  assert.deepEqual(runStep({ phase: 'idle', armed: true }, 'up'), { phase: 'running', armed: false, start: true });
  assert.deepEqual(runStep({ phase: 'idle', armed: true }, 'arrive'), { phase: 'running', armed: false, start: true });
  assert.deepEqual(runStep({ phase: 'idle', armed: true }, 'down'), { phase: 'running', armed: false, start: true }, 'scrolling up into it starts it too');
  // Running: nothing the reader's scrolling does restarts or stops it.
  for (const event of ['up', 'down', 'arrive']) assert.deepEqual(runStep({ phase: 'running', armed: false }, event), { phase: 'running', armed: false, start: false }, event);
  // After the last row it rests; it plays again from row 1 only after the reader went back above the heading and returned.
  assert.deepEqual(runStep({ phase: 'running', armed: false }, 'end'), { phase: 'rested', armed: false, start: false });
  assert.deepEqual(runStep({ phase: 'rested', armed: false }, 'up'), { phase: 'rested', armed: false, start: false });
  assert.deepEqual(runStep({ phase: 'rested', armed: false }, 'arrive'), { phase: 'rested', armed: false, start: false });
  const above = runStep({ phase: 'rested', armed: false }, 'down');
  assert.deepEqual(above, { phase: 'rested', armed: true, start: false });
  assert.deepEqual(runStep(above, 'up'), { phase: 'running', armed: false, start: true });
  // The heading watch: one IntersectionObserver with the window's top 15% cut off; the frame watch only pauses and resumes.
  assert.match(FRAME, /\{ rootMargin: `-\$\{Math\.round\(TRIGGER_LINE \* 100\)\}% 0px 0px 0px`, threshold: \[0, 1\] \}/);
  assert.match(FRAME, /const now = entry\.boundingClientRect\.top < line;/, 'the top of the heading, not the whole heading');
  assert.match(FRAME, /if \(above === null\) \{ if \(now\) runEvent\('arrive'\); \} else if \(now && !above\) runEvent\('up'\); else if \(!now && above\) runEvent\('down'\);/);
  assert.match(FRAME, /if \(heading && heading\.getBoundingClientRect\(\)\.top < window\.innerHeight \* TRIGGER_LINE\) runEvent\('arrive'\);/);
  assert.match(FRAME, /if \(next === null\) \{ runEvent\('end'\); return; \}/);
  assert.doesNotMatch(FRAME, /-20% 0px -20% 0px/, 'no middle band: a tall frame on a short window never sat in it');
  // A finger swiping the page across a stage is not a takeover: only a real click or key is (it was pointerdown).
  const cd = read('src/components/landing/demo/CursorDemo.jsx');
  assert.match(cd, /stage\?\.addEventListener\('click', take\);\n\s*stage\?\.addEventListener\('keydown', take\);/);
  assert.doesNotMatch(cd, /stage\?\.addEventListener\('pointerdown', take\)/);
  // The frame says where the run is (the proof scripts read it): idle, running or rested.
  assert.match(FRAME, /data-run=\{phase\}/);
});

test('rows 4 to 6 are Learn, Benchmarks and the Mob on the old deck\'s card, only while live, dealt in like the deck\'s cards', () => {
  const ids = (o) => tourRows(buildTour(o)).map((r) => r.id);
  assert.deepEqual(ids({ studyLive: true, studyLessons: 10, studySubjects: 3, mobLive: true }), ['learn', 'rival', 'mob']);
  assert.deepEqual(ids({ studyLive: false, mobLive: true }), ['rival', 'mob']);
  assert.deepEqual(ids({ studyLive: true, studyLessons: 10, studySubjects: 3, mobLive: false }), ['learn', 'rival']);
  assert.deepEqual(ids({}), ['rival']);
  const rows = tourRows(buildTour({ studyLive: true, studyLessons: 10, studySubjects: 3, mobLive: true }));
  assert.deepEqual(rows.map((r) => r.icon), [TOUR_ICON.learn, TOUR_ICON.rival, TOUR_ICON.mob]);
  for (const row of rows) {
    assert.ok(words(row.name) <= 2, row.name);
    assert.equal(sentences(row.line), 1, row.line);
    assert.ok(row.title && row.lede && row.chip, row.id);
    for (const line of [row.name, row.line, row.title, row.lede, row.chip]) assert.doesNotMatch(line, /[—!]/, line);
  }
  // The page builds them as "/" builds its tour, from the same switches, and the Mob's screen opens a sample question.
  assert.match(PAGE, /const TOUR = buildTour\(\{ studyLive: STUDY_LIVE, studyLessons: STUDY_LESSONS, studySubjects: STUDY_SUBJECTS, mobLive: MOB_LIVE \}\);/);
  assert.match(PAGE, /const TOUR_SAMPLES = MOB_LIVE \? \{ mob: publicSample\('Economics'\) \} : null;/);
  assert.match(PAGE, /const MOB_LIVE = process\.env\.MOB_ENABLED === 'true' && process\.env\.MOB_V3_ENABLED === 'true';/);
  assert.match(PAGE, /const STUDY_LIVE = process\.env\.STUDY_CONTENT_ENABLED === 'true' && process\.env\.STUDY_RECALL_ENABLED === 'true';/);
  // "Also inside" is gone: the tools are rows now.
  assert.doesNotMatch(PAGE, /op-also|alsoInside|op-chip/);
  assert.doesNotMatch(CSS, /op-also|\.op-chip/);
  // The deck's own screens, unchanged, told they are on stage through the deck's own context.
  assert.match(FRAME, /import \{ DemoPlaybackContext, TOUR_SCREENS \} from '\.\/TourScreens';/);
  assert.match(FRAME, /<DemoPlaybackContext\.Provider value=\{value\}><Screen play=\{play\} sample=\{sample\} \/><\/DemoPlaybackContext\.Provider>/);
  assert.match(FRAME, /<div className="op-td">\n\s*<div className="op-td__copy"><h3 className="op-td__title">\{row\.title\}<\/h3><p className="op-td__lede">\{row\.lede\}<\/p><\/div>/);
  // The deal: transform and opacity, 460 ms; card on card while one deck card replaces another; nothing under reduced motion.
  assert.equal(DEAL_MS, 460);
  assert.match(CSS, /\.op-slot\[data-on\] \{ position: relative; z-index: 1; animation: op-deal 460ms cubic-bezier\(0\.22, 1, 0\.36, 1\) both; \}/);
  assert.match(CSS, /\.op-frame\[data-deal='card'\] \.op-slot\[data-on\] \{ animation-name: op-deal-card; \}/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{ \.op-slot\[data-on\], \.op-slot\[data-leaving\] \{ animation: none; \}/);
  assert.match(FRAME, /'data-leaving': i === leaving && !on \? '' : undefined/);
  // Phones: the frame 10 px from the window's edges, six chips in one sideways row with the shown one kept in view.
  assert.match(CSS, /  \.op-frame \{ margin-inline: -10px; \}/);
  assert.match(CSS, /display: flex; gap: 6px; overflow-x: auto;/);
  assert.match(FRAME, /list\.scrollTo\(\{ left, behavior: motionReduced\(window\) \? 'auto' : 'smooth' \}\)/);
});

test('below 640 px the Practise row plays the exam as a phone shows it: one script, no camera', () => {
  const steps = SCRIPTS.practise;
  // One script for the monitor and the phone view: the same hooks are on both (the phone runner's Next, PhoneNta's options
  // and Save & Next), so it reads MockMob pick, Next, the switch, NTA pick, Save & Next on either.
  assert.deepEqual(steps.filter((st) => st.target).map((st) => st.target.replace(/:nth-child\(\d\)/, '')),
    ['[data-demo="xs-option"]', '[data-demo="xs-next"]', '[data-demo="xs-nta"]', '[data-demo="xs-n-option"]', '[data-demo="xs-n-save"]']);
  const phoneRunner = EXAM_SRC.slice(EXAM_SRC.indexOf('const phone = ('));
  assert.match(phoneRunner, /className="xs-btn xs-btn--next" data-demo="xs-next"/);
  const phoneNta = EXAM_SRC.slice(EXAM_SRC.indexOf('function PhoneNta('));
  assert.match(phoneNta, /className="xs-n-option" data-demo="xs-n-option"/);
  assert.match(phoneNta, /className="xs-n-key xs-n-key--save" data-demo="xs-n-save"/);
  // No camera anywhere: no zoom prop, no camera steps, none of its code left in CursorDemo.
  for (const step of steps) for (const k of ['zoom', 'camera', 'frame', 'look', 'fit']) assert.equal(step[k], undefined, `${k} in ${step.target}`);
  // The runner's paper may hold more than it shows: picks bring their option into it (the pane's scrollTop, never the
  // page's) and the keys that bring a new question put it back at its top.
  for (const step of steps) {
    if (/option/.test(step.target)) assert.equal(step.reveal, PHONE_PANE, step.target);
    if (/xs-next|xs-n-save/.test(step.target)) assert.equal(step.settle, PHONE_PANE, step.target);
  }
  assert.equal(PHONE_PANE, '.xs-ph-paper, .xs-ph-pane');
  // The pane never stops with a row half cut at its top: it stops at its own top or at a whole row (head, stem, option).
  for (const step of steps) if (step.reveal) assert.equal(step.snap, PHONE_ROWS, step.target);
  assert.equal(PHONE_ROWS, '.xs-qhead, .xs-stem, .xs-option, .xs-n-qhead, .xs-n-stem, .xs-n-option');
  const cd = read('src/components/landing/demo/CursorDemo.jsx');
  assert.match(cd, /let top = stops\.find\(\(t\) => t >= need && t <= at\(r\) - 4\);/);
  assert.match(cd, /if \(top > 0\) pane\.dataset\.scrolled = 'true'; else delete pane\.dataset\.scrolled;/);
  const sheet = read('src/components/landing/one-place.css');
  assert.match(sheet, /:is\(\.xs-ph-paper, \.xs-ph-pane\)\[data-scrolled\] \{\n\s*-webkit-mask-image: linear-gradient\(to bottom, transparent 0, #000 12px\);/);
  // Phones: the shorter rows centre in the shared stage height; Practise keeps the top (its key bar stays on screen).
  assert.match(sheet, /  \.op-slot \{ align-content: center; \}/);
  assert.match(sheet, /  \.op-slot\[data-tool='practise'\] \{ align-content: start; \}/);
  const cursor = read('src/components/landing/demo/CursorDemo.jsx');
  assert.doesNotMatch(cursor, /zoom = |zoom\?\.|const compose|textFloor|cam\.style/);
  assert.doesNotMatch(FRAME, /zoom=|EXAM_CAMERA/);
  // The phone view has a fixed height, so the frame never changes height between rows.
  assert.match(read('src/components/landing/one-place.css'), /\.op-slot\[data-tool='practise'\] \.xs-layout > \.xs-inline \{\n\s*grid-area: device; display: flex; flex-direction: column; height: 648px;/);
  assert.match(cursor, /const revealBy = \(el, r, selector, snap\) => \{/);
  assert.match(cursor, /try \{ pane\.scrollTo\(\{ top, behavior \}\); \} catch \{ pane\.scrollTop = top; \}/, 'the pane scrolls, never the page');
  assert.match(cursor, /if \(step\.settle\) \{ const pane = stage\.querySelector\(step\.settle\); if \(pane && pane\.scrollTop\) scrollPane\(pane, 0\); \}/);
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
  // "Unlimited" is the hero strip's word, on Pro: the Practise row says what the screen is.
  assert.doesNotMatch(ONE_PLACE.rows[0].line, /unlimited/i);
  const all = [ONE_PLACE.h2, ONE_PLACE.sub, ...ONE_PLACE.rows.flatMap((r) => [r.name, r.line]), CREATORS_SUB, ONE_PLACE.practiseProof];
  for (const line of all) {
    assert.doesNotMatch(line, /[—!]/, line);
    assert.match(line, /^[A-Z0-9]/, line);
  }
});

test('each row carries its live section\'s proof line, in that section\'s words and from its constants', () => {
  assert.equal(ONE_PLACE.practiseProof, 'NTA style is an exact copy of the real NTA exam screen.');
  assert.ok(EXAM_HEAD.sub.startsWith(ONE_PLACE.practiseProof));
  assert.equal(bankLine({ cards: 1234, subjects: 14 }), '1,234 Key cards across 14 subjects.');
  assert.equal(bankLine(null), null);
  assert.equal(ONE_PLACE.decksHref, '/key-cards');
  assert.match(read('src/components/landing/KeyCardsDemo.jsx'), /const PUBLIC_DECKS_HREF = '\/key-cards';/);
  assert.equal(mobiPrice({ photo: true, credits: 1, photoCredits: 2, free: 50 }), 'A typed question uses 1 credit, a photo 2 credits. Free gives you 50 credits a month.');
  assert.doesNotMatch(mobiPrice({ photo: false, credits: 1, photoCredits: 2, free: 50 }), /photo/, 'a photo only while Mobi reads photos');
  assert.match(PAGE, /mobiPrice\(\{ photo: MISTAKE_PHOTO_ON, credits: MISTAKE_CREDITS, photoCredits: MISTAKE_PHOTO_CREDITS, free: AI_FREE_MONTHLY_CREDITS \}\)/);
  assert.match(PAGE, /<OnePlaceGate keyCards=\{KEY_CARDS\} photo=\{MISTAKE_PHOTO_ON\} price=\{MOBI_PRICE\} tour=\{TOUR\} samples=\{TOUR_SAMPLES\}>/);
});

test('the phone nav draws the Pricing pill here too, and the Lab\'s Skip finds the next section when the bar is read', () => {
  assert.match(read('src/components/NavBar.jsx'), /\{pathname === '\/' \|\| pathname === '\/home-next' \? \(\n\s*<Link href="\/pricing" className="mm-nav__price"/);
  const pos = read('src/components/landing/SectionPosition.jsx');
  assert.match(pos, /const next = nextSection\(hosts\[index\]\);/);
  assert.doesNotMatch(pos, /const nexts = hosts\.map\(nextSection\)/);
});

test('carried over from the first /home-next: the creators\' sign-up floor and "What do I get free?" from the constants', () => {
  assert.match(CREATORS_SUB, /^1,500\+ students have signed up, and CUET creators show MockMob to their followers\. Tap a reel to watch it here\.$/);
  assert.ok(INSTAGRAM_HEAD.sub.endsWith('Tap a reel to watch it here.'));
  assert.match(PAGE, /<p className="lp-sub">\{CREATORS_SUB\}<\/p>/);
  const faq = freeFaq({ freeCredits: 50, dailySize: 5 });
  assert.equal(faq.question, 'What do I get free?');
  assert.ok(faq.answer.split(/\s+/).length <= 45, 'the FAQ answer budget (homeCopy COPY_BUDGET.faq)');
  assert.doesNotMatch(faq.answer, /Full mock on credits/i, 'the plan card\'s item read like a slip mid-sentence');
  assert.match(read('src/services/credits/aiCreditWallet.js'), /export const AI_FREE_MONTHLY_CREDITS = 50;/, 'the free credits the FAQ reads');
  assert.match(PAGE, /freeFaq\(\{ freeCredits: AI_FREE_MONTHLY_CREDITS, dailySize: DAILY_FIVE_SIZE \}\)/);
  assert.match(PAGE, /<ReadLineHere \/>/);
  assert.match(PAGE, /<SampleHere \/>/);
});

// ------------------------------------------------------------------ load weight, the bar, the opening (21 Nov 2026)
test('the frame loads late: the server draws it whole, the browser asks for its code only near the window', () => {
  const GATE = read('src/components/landing/OnePlaceGate.jsx');
  assert.match(PAGE, /^import OnePlaceGate from '@\/components\/landing\/OnePlaceGate';$/m);
  assert.doesNotMatch(PAGE, /^import OnePlace from/m, 'the page never imports the frame itself');
  assert.doesNotMatch(GATE, /^import .*from '\.\/OnePlace';/m, 'never a static import of the frame');
  assert.match(GATE, /export const SERVER_READY = typeof window === 'undefined' \? import\('\.\/OnePlace'\)/);
  assert.match(GATE, /const ServerFrame = lazy\(\(\) => \(serverModule \? \{ then: \(done\) => done\(serverModule\) \} : SERVER_READY\)\);/);
  assert.match(GATE, /export const ONE_PLACE_NEAR = '150% 0px 150% 0px';/);
  assert.match(GATE, /dangerouslySetInnerHTML=\{\{ __html: readDrawn\(\) \}\} suppressHydrationWarning/);
  // The frame's sheets come with the gate, in the order the frame's own imports bring them (so the drawn frame is styled).
  const sheets = [...GATE.matchAll(/^import '([^']+\.css)';/gm)].map((m) => m[1].split('/').pop());
  assert.deepEqual(sheets, ['cursor-demo.css', 'doodle.css', 'exam-device.css', 'exam-screen.css', 'loading-kit.css', 'key-cards.css', 'brand-stamp.css', 'bring-mistake.css', 'one-place.css']);
  for (const f of ['src/components/landing/OnePlaceGate.jsx', 'src/components/landing/LabNextGate.jsx']) assert.doesNotMatch(read(f), /requestAnimationFrame|setInterval|getBoundingClientRect|offsetHeight/, f);
  // Critic round 5 (21 Nov 2026): both gates ask for their code in quiet time after the opening, one step per idle period
  // (idleQueue.mjs), not only on approach; a Lab scene already on stage goes live at once.
  for (const f of ['src/components/landing/OnePlaceGate.jsx', 'src/components/landing/LabNextGate.jsx']) assert.match(read(f), /afterOpening\(\)\.then\(\(\) => inIdle\(/, f);
  assert.match(read('src/components/landing/LabNextGate.jsx'), /const Live = Screen \|\| \(props\.live && loaded \? loaded : null\);/);
  const queue = read('src/components/landing/idleQueue.mjs');
  assert.match(queue, /requestIdleCallback\(fn, \{ timeout: IDLE_TIMEOUT_MS \}\)/);
  assert.match(queue, /st\.phase === 'done'/);
});

test('only the shown stage is live; the next is made live unplayed before its turn, and a played one is mounted fresh', () => {
  let s = stagesStart(3, { drawn: true });
  assert.deepEqual(s.live, [true, false, false]);
  assert.deepEqual(stagesStart(3).live, [true, true, true], 'no drawing to keep (a client visit): every stage live, as before');
  s = stagesStep(s, { type: 'ready', index: 1 });
  assert.deepEqual([s.live[1], s.gen[1], s.used[1]], [true, 0, false]);
  s = stagesStep(s, { type: 'start', index: 1 });
  assert.equal(s.gen[1], 0, 'made live ahead of its turn: not mounted a second time when it starts');
  s = stagesStep(s, { type: 'start', index: 1 });
  assert.equal(s.gen[1], 1, 'a restart after it has played: mounted fresh');
  s = stagesStep(s, { type: 'start', index: 0 });
  assert.equal(s.gen[0], 1, 'the first stage played at once, so it too is fresh when it starts again');
  s = stagesStep(s, { type: 'ready', index: 1 });
  assert.deepEqual([s.gen[1], s.used[1]], [2, false], 'a played stage made ready again is remounted in idle time, not on its turn');
  assert.equal(stagesStep(s, { type: 'start', index: 7 }), s);
  assert.ok(STAGE_LEAD_MS >= 1000 && STAGE_LEAD_MS <= 4000);
  assert.match(FRAME, /if \(!stages\.live\[i\]\) return <div key=\{row\.id\} \{\.\.\.slot\} data-drawn="" dangerouslySetInnerHTML=\{\{ __html: drawn\[row\.id\] \}\} \/>;/);
  assert.match(FRAME, /window\.requestIdleCallback\(make, \{ timeout: 1200 \}\)/);
});

test('the bar steps aside for the whole frame on /home-next only; the live home passes nothing', () => {
  assert.match(PAGE, /<HeroDockGate aside="\.op-gate">/);
  assert.match(LIVE, /<HeroDockGate>/);
  const gate = read('src/components/landing/HeroDockGate.jsx');
  assert.match(gate, /export function HeroDockGate\(\{ children, aside = null \}\)/);
  assert.match(gate, /\{ rootMargin: `-\$\{NAV\}px 0px 0px 0px`, threshold: 0 \}\);\n    blocks\.forEach/);
});

test('the opening hands over once the hero has painted on /home-next; the live home keeps its opening', () => {
  assert.match(PAGE, /<OpeningMo fast \/>/);
  assert.match(LIVE, /<OpeningMo \/>/);
  assert.deepEqual({ ...OPENING_FAST }, { wait: 700, lite: 800 });
  const live = openingGateScript();
  const fast = openingGateScript({ fast: true });
  assert.doesNotMatch(live, /largest-contentful-paint|"fast"/, 'the live home\'s script carries none of it');
  assert.match(fast, /largest-contentful-paint/);
  assert.match(fast, /"fast":\{"wait":700,"lite":800\}/);
  assert.doesNotThrow(() => new Function(fast));
});
