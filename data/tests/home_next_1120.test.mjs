// The home page, 21 Nov 2026 (owner: "Switch it live"; built as /home-next, LK363 and LK364): the home as it was, with ONE
// frame in place of the tour deck, the Key cards
// section, Bring a mistake and the exam screen section: "Your whole CUET prep, in one place." Three rows, one stage; each
// stage is the landing's own real component, worked by a demo cursor; rows 4 to 6 (owner LK364) are the tour deck's Learn,
// Benchmarks and Mob screens on the deck's card (OnePlace.jsx, onePlaceModel.mjs, demo/CursorDemo.jsx). Since 21 Nov 2026
// (owner LK365) rows 3 to 6 (Ask Mobi, Learn, Benchmarks, the Mob) are row stories: stories/<Id>Story.jsx, each worked by its
// own script (stories/<id>Story.mjs) and held by its own test (data/tests/story_<id>_1121.test.mjs).
// What these hold: the page's place ("/" itself, its home metadata; /home-next a permanent redirect to it, linked from
// nowhere; the replaced sections' components kept, off the page), the
// order of the sections, the stages being the real components, every script aiming at a hook the component really carries,
// the autoplay rules, no frame loop or interval in the frame's files, and the words (seven-word heading, one sentence, no
// em dash, no "!", only live tools named).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREATORS_SUB, ONE_PLACE, bankLine, freeFaq, mobiPrice, sayWhere, tourRows } from '../../src/components/landing/onePlaceCopy.mjs';
import { EXAM_HEAD, INSTAGRAM_HEAD, TOUR_ICON, buildTour } from '../../src/components/landing/homeCopy.mjs';
import {
  CARDS_FOCUS, DEAL_MS, PACE, PHONE_PANE, PHONE_ROWS, ROW_HOLD_MS, ROW_MAX_MS, ROW_MIN_MS, ROW_OF_HASH, SAY_MAX_CHARS, SCRIPTS, SCRIPTS_TYPED, TAKEOVER_HOLD_MS,
  TRIGGER_LINE, PHONE_LAYOUT, ROOM_FOOT_PX, triggerPassed, afterRow, autoplayRuns, desktopTriggerFoot, keyStep, leaveStartsHold, motionReduced, nextIndex, runStep, sayCount, sayPace, scriptHooks, scriptMs,
} from '../../src/components/landing/onePlaceModel.mjs';
import { BRING_MISTAKE } from '../../src/components/landing/bringMistakeCopy.mjs';
import { MOBI_STORY, MOBI_STORY_TYPED } from '../../src/components/landing/stories/mobiStory.mjs';
import { LEARN_STORY } from '../../src/components/landing/stories/learnStory.mjs';
import { LEVELS, RIVAL_STORY } from '../../src/components/landing/stories/rivalStory.mjs';
import { MOB_STORY } from '../../src/components/landing/stories/mobStory.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Line ends normalised: the release gate's checkout writes CRLF, and the patterns below are written with \n.
const read = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const PAGE = read('src/app/page.js');
const FRAME = read('src/components/landing/OnePlace.jsx');
const { stagesStart, stagesStep, STAGE_LEAD_MS } = await import('../../src/components/landing/onePlaceModel.mjs');
const { OPENING_FAST, openingGateScript } = await import('../../src/components/landing/openingGate.mjs');
const EXAM_SRC = read('src/components/landing/ExamScreen.jsx');
const CARDS_SRC = read('src/components/landing/KeyCardsDemo.jsx');
const BMK_SRC = read('src/components/landing/BringMistakeBlock.jsx');
const STORY_SRC = Object.freeze({
  mobi: read('src/components/landing/stories/MobiStory.jsx'),
  learn: read('src/components/landing/stories/LearnStory.jsx'),
  rival: read('src/components/landing/stories/RivalStory.jsx'),
  mob: read('src/components/landing/stories/MobStory.jsx'),
});
const STORY_IDS = Object.freeze(['mobi', 'learn', 'rival', 'mob']);
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
test('/home-next is a permanent redirect to "/", in no sitemap and linked from nowhere', () => {
  assert.match(read('next.config.mjs'), /\{\n\s*source: '\/home-next',\n\s*destination: '\/',\n\s*permanent: true,\n\s*\}/);
  assert.throws(() => statSync(join(root, 'src/app/home-next')), 'no page of its own: the redirect is the address');
  assert.throws(() => statSync(join(root, 'src/components/home2')), 'the preview-only helpers are gone');
  assert.doesNotMatch(read('src/app/sitemap.js'), /home-next/);
  assert.doesNotMatch(read('src/lib/seo.js'), /home-next/);
  const linkers = [];
  for (const f of sourceFiles(join(root, 'src'))) {
    const rel = relative(root, f).split(sep).join('/');
    if (/['"`]\/home-next|pathname === '\/home-next'|components\/home2\//.test(readFileSync(f, 'utf8'))) linkers.push(rel);
  }
  assert.deepEqual(linkers, []);
});

test('"/" is the home page: indexed, with the home JSON-LD from its own FAQ list; the replaced sections stay in the code', () => {
  // No metadata of its own: the root layout's is the home page's (title, description, canonical "/", indexed).
  assert.doesNotMatch(PAGE, /export const metadata/);
  assert.doesNotMatch(PAGE, /robots|noindex|preview/i);
  assert.match(read('src/app/layout.js'), /\.\.\.seoMetadata\(\{\n\s*title: "CUET Mock Tests & Practice Questions \| MockMob",\n\s*description: siteConfig\.description,\n\s*path: "\/",/);
  assert.match(PAGE, /<JsonLd id="home-breadcrumb-json-ld" data=\{breadcrumbJsonLd\(\[\{ name: 'Home', path: '\/' \}\]\)\} \/>/);
  assert.match(PAGE, /<JsonLd id="home-faq-json-ld" data=\{faqJsonLd\(faqs\)\} \/>/);
  assert.match(PAGE, /export default function LandingPage\(\)/);
  // The four sections it replaced are off the page, but their components stay (other pages and their own tests use them).
  for (const f of ['TourDeck.jsx', 'KeyCardsDemo.jsx', 'BringMistakeBlock.jsx', 'ExamScreen.jsx', 'LabCinema.jsx']) assert.ok(statSync(join(root, 'src/components/landing', f)).isFile(), f);
  assert.match(EXAM_SRC, /export function ExamScreen\(\)/);
  assert.match(read('src/components/landing/LabCinema.jsx'), /const next = look === 'next';/, 'LabCinema keeps its default look; the page asks for the next one');
});

test('the shared components keep the live markup by default (their new props are optional and off on "/")', () => {
  // ExamScreen is the section with its head, drawn through ExamStage; the gate card stays on by default.
  assert.match(EXAM_SRC, /export function ExamScreen\(\) \{\n  return \(\n    <section className="lp-sec xs" id="exam-experience" aria-labelledby="exam-title">\n      <div className="mm-wrap">\n        <ExamStage head=\{<>/);
  assert.match(EXAM_SRC, /export function ExamStage\(\{ head = null, gate = true, note = null, inline = false \}\)/);
  // `inline` (off on "/"): below 640 px the phone view in the monitor's place; without it the monitor is drawn as before.
  assert.match(EXAM_SRC, /if \(!inline\) return undefined;\n\s*const query = window\.matchMedia\('\(max-width: 639px\)'\);/);
  assert.match(EXAM_SRC, /\{inlineNow \? \(\n\s*<div className="xs-inline" ref=\{deviceRef\}>\n\s*\{full \? <div className="xs-frame xs-frame--away" aria-hidden="true" \/> : phone\}/);
  assert.doesNotMatch(PAGE, /<ExamStage|<ExamScreen/, 'the page draws the exam only through the frame (inline there)');
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

test('the home page draws the new section and none of the four it replaces, in the live order around it', () => {
  for (const gone of [/<TourDeck/, /className="lp-sec lp-kc"/, /id="key-cards-title"/, /<KeyCardsDemo/, /<BringMistakeBlock/, /<ExamScreen/, /TOUR_HEAD/]) assert.doesNotMatch(PAGE, gone);
  // Their addresses land on the frame (the hero strip, the app's "/#exam-experience"), which opens that row.
  for (const id of ['exam-experience', 'key-cards', 'bring-a-mistake']) assert.match(PAGE, new RegExp(`<span id="${id}" className="op-anchor" aria-hidden="true" />`), id);
  assert.match(FRAME, /const id = ROW_OF_HASH\[window\.location\.hash\];/);
  assert.match(FRAME, /window\.addEventListener\('hashchange', open\);/);
  // Arriving from elsewhere (the site bar's /#your-prep, the app's /#exam-experience): the page settles on them (a phone's own
  // jump was lost while the page grew), with the heading clear of the site bar.
  assert.match(PAGE, /const HASH_IDS = \['faq', 'your-prep', 'exam-experience', 'key-cards', 'bring-a-mistake'\];/);
  assert.match(PAGE, /<HashSettle ids=\{HASH_IDS\} \/>/);
  assert.match(CSS, /\.op-anchor \{ display: block; height: 0; overflow: hidden; scroll-margin-top: 76px; \}/);
  assert.match(CSS, /#your-prep\.op \{ scroll-margin-top: 48px; \}/);
  assert.match(PAGE, /<section className="lp-sec op" id="your-prep" aria-labelledby="op-title">/);
  assert.match(PAGE, /<OnePlaceGate keyCards=\{KEY_CARDS\} photo=\{MISTAKE_PHOTO_ON\} price=\{MOBI_PRICE\} tour=\{TOUR\} samples=\{TOUR_SAMPLES\} study=\{STUDY_COUNTS\}>\n\s*<LandingActions mode="primary" \/>\n\s*<\/OnePlaceGate>/);
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
  assert.deepEqual(css, ['@/app/marketing.css', '@/components/brand/mobi-figure.css', './home-sheets.css']);
});

// ------------------------------------------------------------------ the stages are the real components
test('each stage is the landing\'s own component, not a drawn stand-in', () => {
  assert.match(FRAME, /import \{ ExamStage \} from '\.\/ExamScreen';/);
  assert.match(FRAME, /import KeyCardsDemo from '\.\/KeyCardsDemo';/);
  assert.match(FRAME, /import CursorDemo from '\.\/demo\/CursorDemo';/);
  // The row stories, each imported WITH its extension: on Windows './stories/MobiStory' also matches mobiStory.mjs (no
  // default export), and the page fails on the server with "Element type is invalid".
  for (const name of ['MobiStory', 'LearnStory', 'RivalStory', 'MobStory']) assert.match(FRAME, new RegExp(`^import ${name} from '\\./stories/${name}\\.jsx';$`, 'm'), name);
  // The old stages are no longer drawn by the frame (their files stay: other pages and their own tests use them).
  assert.doesNotMatch(FRAME, /BringMistakeCard|BringMistakeValue|TourScreens|TOUR_SCREENS|DemoPlaybackContext/);
  assert.doesNotMatch(CSS, /\.op-bmk|bmk__/);
  assert.match(FRAME, /practise: \{ steps: SCRIPTS\.practise, stage: \(\) => <ExamStage gate="short" inline note=\{<p className="op-proof op-proof--switch">\{ONE_PLACE\.practiseProof\}<\/p>\} \/> \},/);
  // Key cards draws its own foot (shown on phones only, without its sign-up key: one-place.css).
  assert.match(FRAME, /<KeyCardsDemo cards=\{keyCards\.cards\} keys=\{keyCards\.keys\} bank=\{keyCards\.bank\} subjects=\{keyCards\.subjects\} \/>/);
  const css = read('src/components/landing/one-place.css');
  assert.match(css, /\.op-kc \.kc-foot > \.mm-btn \{ display: none; \}/);
  // Phones keep the frame's rows close in height: Key cards without its subject chips.
  assert.match(css, /  \.op-kc \.kc-open \{ display: none; \}/);
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
  // 21 Nov 2026 (LK365): the caption strip (op-say) is above the stage at every width; the old phone caption is gone.
  // Critic round, 21 Nov evening: the switch and the runner fill the stage's working room exactly (--op-room), so the key bar
  // is on screen whenever the room is.
  assert.match(css, /\.op-slot\[data-tool='practise'\] \.xs-layout > \.xs-inline \{ height: calc\(var\(--op-room\) - var\(--op-switch-h\) - 12px\); \}/);
  assert.match(css, /\.op-slot\[data-tool='practise'\] \.xs-layout \{ grid-template-areas: 'switch' 'device' 'note'; \}/);
  assert.doesNotMatch(css + FRAME, /op-caption/);
  assert.match(css, /\.op-slot\[data-tool='practise'\] \.xs-layout > \.xs-full-open \{ display: none; \}/);
  assert.match(css, /html\[data-theme='dark'\] \.op-slot\[data-tool='practise'\] \.xs-layout > \.xs-inline \{\n\s*border: 7px solid #1c1a16; border-radius: 22px;/);
  assert.match(read('src/app/exam-screen.css'), /\.xs-ph-paper \{[^}]*overflow-y: auto; overscroll-behavior: contain;/);
  // Key cards and Ask Mobi sit in the exam monitor's own browser bar, at the addresses they really live at in the app.
  assert.match(FRAME, /<div className="xs-browser op-win__bar" aria-hidden="true">/);
  assert.match(FRAME, /<AppWindow path=\{row\.path\}><div className="op-kc"><KeyCardsDemo/);
  // Ask Mobi is its story in that window; Learn, Benchmarks and the Mob are theirs on the deck's card (no title on it since
  // the critic round of 21 Nov evening: the caption strip says each beat).
  assert.match(FRAME, /  mobi: \{ steps: SCRIPTS\.mobi, stage: \(\{ row, photo \}\) => <AppWindow path=\{row\.path\}><MobiStory photo=\{photo\} \/><\/AppWindow> \},/);
  assert.match(FRAME, /<StoryCard row=\{row\}><LearnStory lessons=\{study\?\.lessons \?\? 0\} subjects=\{study\?\.subjects \?\? 0\} \/><\/StoryCard>/);
  assert.match(FRAME, /<StoryCard row=\{row\}><RivalStory \/><\/StoryCard>/);
  assert.match(FRAME, /<StoryCard row=\{row\}><MobStory sample=\{samples\?\.mob \?\? null\} \/><\/StoryCard>/);
  // A story is a size container: it is stretched to its well's full width, never centred (a centred one shrinks to nothing).
  assert.match(css, /\.op-win__body > \.st, \.op-td--story \.op-td__shot > \.st \{ width: 100%; justify-self: stretch; \}/);
  assert.match(css, /\.op-td--story \.op-td__shot \{ display: grid; grid-template-columns: minmax\(0, 1fr\);/);
  assert.deepEqual(ONE_PLACE.rows.map((r) => r.path), [undefined, '/cards', '/mentor']);
  assert.match(read('src/components/landing/bringMistakeCopy.mjs'), /export const BRING_MISTAKE_PATH = '\/mentor';/);
  assert.ok(sourceFiles(join(root, 'src/app/(app)/cards')).length > 0, 'Key cards live at /cards');
  // Every stage starts fresh: a live stage is keyed by its mount generation, which moves on before a stage that has played
  // plays again (onePlaceModel.mjs stagesStep; the behaviour is held in the load-weight test below).
  assert.match(FRAME, /<CursorDemo key=\{`run-\$\{stages\.gen\[i\]\}`\}/);
});

// Benchmarks draws one level key per level, its hook written from the level's id: rival-level-<id> for each of LEVELS.
const hasLevelHook = (tool, hook) => tool === 'rival' && STORY_SRC.rival.includes('data-demo={`rival-level-${l.id}`}') && LEVELS.some((l) => hook === `rival-level-${l.id}`);

test('every script aims at a data-demo hook its component really carries', () => {
  const sourceOf = { practise: EXAM_SRC, cards: CARDS_SRC, ...STORY_SRC };
  assert.deepEqual(Object.keys(SCRIPTS), ['practise', 'cards', 'mobi', 'learn', 'rival', 'mob']);
  // Rows 3 to 6 play their stories' own scripts (and Ask Mobi its typed one while Mobi does not read photos).
  assert.equal(SCRIPTS.mobi, MOBI_STORY.steps);
  assert.equal(SCRIPTS_TYPED.mobi, MOBI_STORY_TYPED.steps);
  assert.equal(SCRIPTS.learn, LEARN_STORY.steps);
  assert.equal(SCRIPTS.rival, RIVAL_STORY.steps);
  assert.equal(SCRIPTS.mob, MOB_STORY.steps);
  const all = [...Object.entries(SCRIPTS), ['mobi', SCRIPTS_TYPED.mobi]];
  for (const [tool, steps] of all) {
    const hooks = scriptHooks(steps);
    assert.ok(hooks.length >= 2, `${tool} has targets`);
    for (const hook of hooks) assert.ok(sourceOf[tool].includes(`data-demo="${hook}"`) || hasLevelHook(tool, hook), `${tool}: data-demo="${hook}" is in the component`);
    // Every target is a hook, at most narrowed by its place or a data-i the component writes.
    for (const step of steps) if (step.target) assert.match(step.target, /^\[data-demo="[\w-]+"\](:nth-child\(\d\)|\[data-i="\d"\])?$/, `${tool}: ${step.target}`);
    // A story's hook named with a story id: the row's own (mobi-*, learn-*, rival-*, mob-*).
    if (STORY_IDS.includes(tool)) for (const hook of hooks) assert.ok(hook.startsWith(`${tool}-`), `${tool}: ${hook}`);
    // Each focus names a part the stage really draws.
    if (STORY_IDS.includes(tool)) {
      for (const step of steps) if (typeof step.focus === 'string') {
        for (const cls of step.focus.match(/\.[\w-]+/g) || []) assert.match(sourceOf[tool], new RegExp(`className=[{"\`][^>]*\\b${cls.slice(1)}\\b`), `${tool}: ${cls}`);
        for (const hook of step.focus.match(/data-demo="([\w-]+)"/g) || []) assert.ok(sourceOf[tool].includes(hook), `${tool}: ${hook}`);
      }
    }
  }
  // Learn's pick names an option the component marks with data-i.
  assert.match(STORY_SRC.learn, /data-demo="learn-option" data-i=\{i\}/);
  // Practise switches to NTA style in the middle and ends on NTA's Save & Next (the key beside the palette); Ask Mobi picks
  // the fresh question's right option.
  const p = SCRIPTS.practise.filter((s) => s.target).map((s) => s.target);
  assert.ok(p.indexOf('[data-demo="xs-nta"]') > p.indexOf('[data-demo="xs-next"]'));
  // Owner LK367 (22 Nov 2026): it ends in NTA style on Mark for Review & Next, then the question palette (a phone-only
  // hook: the monitor's palette is always on show, so CursorDemo skips that step there).
  assert.equal(p.at(-1), '[data-demo="xs-n-palette"]');
  assert.equal(p.filter((t) => t === '[data-demo="xs-n-mark"]').length, 1);
  assert.match(EXAM_SRC, /className="xs-n-key xs-n-key--review" data-demo="xs-n-mark" onClick=\{markAndNext\}/);
  assert.match(EXAM_SRC, /data-demo="xs-n-palette" aria-haspopup="dialog"/);
  // In the inline phone runner the palette sheet is a plain open dialog inside the device, never a modal over the page.
  assert.match(EXAM_SRC, /if \(inlineHost\) el\.show\(\); else el\.showModal\(\);/);
  assert.ok(SCRIPTS.mobi.some((s) => s.target === `[data-demo="mobi-option"]:nth-child(${BRING_MISTAKE.check.correct + 1})`));
  // The cursor never clicks a link (the page would leave): Ask Mobi's practice key is a link, so the cursor only rests on it.
  for (const [tool, steps] of all) for (const step of steps) if (step.click) {
    const hook = step.target.match(/data-demo="([\w-]+)"/)[1];
    const at = sourceOf[tool].indexOf(`data-demo="${hook}"`);
    const tag = sourceOf[tool].slice(sourceOf[tool].lastIndexOf('<', at), at);
    assert.doesNotMatch(tag, /^<(a|Link)\b/, `${tool}: ${hook} is clicked, so it is not a link`);
  }
  // The practice key is a link: never clicked (critic round, 21 Nov evening: the script now ends on the practice card being
  // dealt, and the cursor does not go to the link at all).
  assert.ok(!SCRIPTS.mobi.some((s) => s.target === '[data-demo="mobi-practice"]' && s.click), 'the practice key is never clicked');
  // Key cards: turn, rest on the rating keys (each says when the card comes back), then Got it; the next card rises.
  assert.equal(SCRIPTS.cards.filter((s) => s.target === '[data-demo="kc-turn"]').length, 1, 'turn once');
  assert.deepEqual(SCRIPTS.cards.filter((s) => s.target).map((s) => [s.target, Boolean(s.click)]),
    [['[data-demo="kc-turn"]', true], ['[data-demo="kc-rate"]:nth-child(2)', false], ['[data-demo="kc-rate"]:nth-child(2)', true]]);
});

test('each row runs for its own script, 8.5 to 13 seconds with its say beats, and its line fills over exactly that', () => {
  // Owner LK365 (21 Nov 2026): "the screens are moving too fast". It was 8 s or less (LK363); every row now explains itself
  // (3 to 5 say beats) and runs 11 to 13 s, the row stories included. 13, not 16 (critic round, 21 Nov evening): on a slow
  // phone a 15.7 s script played 18.8 s and the pass took 1 min 42 s; with 13 s scripts and the cursor keeping to its own
  // clock (CursorDemo `hold`) a measured row stays under 16 s (tmp/1121-stories/fix-oneplace/film.mjs).
  assert.equal(ROW_MAX_MS, 13000);
  // Owner LK366 (22 Nov 2026): "both of these first two are quite slow": Practise and Key cards run three beats in about
  // 9 to 11 s; the four row stories, which he likes, keep 11 to 13 s.
  assert.equal(ROW_MIN_MS, 8500);
  assert.ok(scriptMs(SCRIPTS.cards) <= 11000, `Key cards is quick: ${scriptMs(SCRIPTS.cards)} ms`);
  // Practise (owner LK367, later on 22 Nov): one flow that ends on NTA's mark-for-review key and its palette, four beats.
  assert.ok(scriptMs(SCRIPTS.practise) <= 12500, `Practise: ${scriptMs(SCRIPTS.practise)} ms`);
  for (const tool of ['mobi', 'learn', 'rival', 'mob']) assert.ok(scriptMs(SCRIPTS[tool]) >= 11000, `${tool} keeps its pace: ${scriptMs(SCRIPTS[tool])} ms`);
  for (const [tool, steps] of [...Object.entries(SCRIPTS), ['mobi typed', SCRIPTS_TYPED.mobi]]) {
    const ms = scriptMs(steps);
    assert.ok(ms >= ROW_MIN_MS && ms <= ROW_MAX_MS, `${tool}: ${ms} ms, 8.5 to 13 s`);
    assert.ok(sayCount(steps) >= 3 && sayCount(steps) <= 5, `${tool} explains itself in 3 to 5 beats`);
    for (const step of steps) if (step.target) assert.ok(Number.isFinite(step.move) && Number.isFinite(step.dwell), `${tool}: every step names its move and dwell`);
  }
  assert.equal(scriptMs([{ wait: 500 }, { target: 'x', move: 400, dwell: 600, click: true }]), 220 + 260 + 500 + 400 + 130 + 600);
  // The progress line under the shown row fills over the script the stage really plays (the registry's steps).
  assert.match(FRAME, /'--op-ms': `\$\{scriptMs\(stepsOf\(row\.id, photo\)\)\}ms`/);
  assert.match(FRAME, /const runMs = scriptMs\(stepsOf\(rowIds\[index\], photo\)\);/);
});

test('the caption strip says each beat: one line at a time, read before the cursor moves, at a pace a student can read', () => {
  assert.deepEqual({ ...PACE }, { sayMinMs: 2200, readFirstMs: 500 });
  const scripts = { ...SCRIPTS, mobiTyped: SCRIPTS_TYPED.mobi };
  for (const tool of Object.keys(scripts)) {
    const beats = sayPace(scripts[tool]);
    assert.equal(beats.length, sayCount(scripts[tool]));
    for (const beat of beats) {
      assert.ok(beat.holds >= PACE.sayMinMs, `${tool} "${beat.say}" stays ${beat.holds} ms`);
      assert.ok(beat.firstMove >= PACE.readFirstMs, `${tool} "${beat.say}": the cursor waits ${beat.firstMove} ms`);
      assert.ok(beat.say.length <= SAY_MAX_CHARS, beat.say);
      assert.doesNotMatch(beat.say, /[\u2014!]|\p{Extended_Pictographic}/u, beat.say);
      assert.match(beat.say, /^[A-Z]/, beat.say);
      assert.equal(sentences(beat.say), 1, beat.say);
    }
    // Every line opens on a wait (the cursor is still while it is read) and names the part of the screen it is about.
    for (const step of scripts[tool].filter((st) => typeof st.say === 'string')) {
      assert.ok(step.wait >= PACE.readFirstMs && !step.target, step.say);
      // The row stories name the part each line is about. Practise and Key cards (the real screens) stress nothing but the
      // Got it key (owner LK366: "it's just introducing some boxes here and there, which are not looking as they should").
      if (tool === 'practise') assert.equal(step.focus, null, step.say);
      else if (tool === 'cards') assert.ok(step.focus === null || step.focus === CARDS_FOCUS.gotIt, step.say);
      else assert.ok(typeof step.focus === 'string' && step.focus.length > 0, step.say);
    }
  }
  assert.deepEqual(SCRIPTS.practise.filter((st) => st.say).map((st) => st.say), [
    'Answer a question, as you would in the exam.', 'Switch to NTA style, the real exam\u2019s screen.',
    'Mark a doubtful one for review, as in NTA.', 'The palette shows every question in NTA\u2019s colours.',
  ]);
  assert.deepEqual(SCRIPTS.cards.filter((st) => st.say).map((st) => st.say), [
    'Turn the card to see the answer.', 'Say how well you knew it.', 'It comes back before you are likely to forget it.',
  ]);
  // The lines' truth: NTA style holds a pick until Save & Next saves it; the scheduler asks for 90% recall.
  assert.match(EXAM_SRC, /const saveAndNext = \(\) => \{ touch\(\); saveHeld\(\);/);
  assert.match(EXAM_SRC, /choose=\{hold\}/);
  assert.match(read('data/keycards.js'), /retention: 0\.9,/);
  // Each focus names parts the stage really draws (ExamScreen.jsx, KeyCardsDemo.jsx).
  assert.deepEqual({ ...CARDS_FOCUS }, { gotIt: '[data-demo="kc-rate"]:nth-child(2)' });
  assert.match(CARDS_SRC, /className="kc-demo__rate" data-demo="kc-rate"/);
  // The third Key cards line is shown: the rated card is filed and a time line says when it returns, in the key's own words.
  assert.match(CARDS_SRC, /const FILE_MS = 1500;/);
  assert.match(CARDS_SRC, /export const filedLine = \(when\) => `This card is \$\{when\}\.`;/);
  assert.match(CARDS_SRC, /<p className="kc-demo__filed-line">\{filedLine\(keys\[filed\]\.when\)\}<\/p>/);
  assert.match(CARDS_SRC, /if \(isMotionReduced\(\)\) \{ next\(\); return; \}/);
  // sayPace counts as CursorDemo plays: the entry, then each wait, move, press and dwell; a line holds to the next one.
  assert.deepEqual(sayPace([{ say: 'One.', wait: 600 }, { target: 'x', move: 400, dwell: 1300, click: true }, { say: 'Two.', wait: 500 }]),
    [{ say: 'One.', at: 220, holds: 2430, firstMove: 600 }, { say: 'Two.', at: 2650, holds: 760, firstMove: Infinity }]);
  // The strip: the quiet line names the tool and the step; the beat's line in bold; the row's own line while nothing plays.
  assert.equal(sayWhere('Key cards', 1, 3), 'Key cards, step 2 of 3');
  assert.equal(sayWhere('Key cards'), 'Key cards');
  // The strip holds its own line (SayStrip): a new line re-renders the strip alone, never the stages; a line counts only for
  // the row and the run on show.
  assert.match(FRAME, /const live = playing && say && say\.at === index && say\.cycle === cycle \? say : null;/);
  assert.match(FRAME, /<p className="op-say__where">\{sayWhere\(name, live \? live\.beat : -1, live \? beats : 0\)\}<\/p>/);
  assert.match(FRAME, /<span key=\{live \? `\$\{cycle\}-\$\{live\.beat\}` : `row-\$\{index\}`\} className="op-say__text">/);
  assert.match(FRAME, /\{live && beats > 0 \? <span className="op-say__n">\{Math\.min\(live\.beat \+ 1, beats\)\} of \{beats\}<\/span> : null\}\{live \? live\.text : line\}/);
  assert.match(FRAME, /<SayStrip bindRef=\{sayTo\} index=\{index\} cycle=\{cycle\} playing=\{playing\} name=\{active\.name\} line=\{active\.line\} beats=\{sayCount\(steps\)\} \/>/);
  assert.match(FRAME, /const onSay = useCallback\(\(text, beat\) => sayTo\.current\?\.\(\{ at: indexRef\.current, cycle: cycleRef\.current, text, beat \}\), \[\]\);/);
  assert.doesNotMatch(FRAME, /setSay\(\{ at: indexRef/);
  assert.match(FRAME, /onSay=\{onSay\}/);
  // Two lines' room at every width (nothing under it moves); the new line rises and fades in, 200 ms, none when reduced.
  assert.match(CSS, /\.op-say__line \{\n\s*margin: 0; min-height: calc\(2em \* 1\.28\);/);
  assert.match(CSS, /\.op-say\[data-live\] \.op-say__text \{ animation: op-say-in 200ms var\(--op-ease\) both; \}/);
  assert.match(CSS, /@keyframes op-say-in \{ from \{ opacity: 0; transform: translate3d\(0, 6px, 0\); \} \}/);
  assert.match(CSS, /html\[data-motion='reduced'\] \.op-say\[data-live\] \.op-say__text \{ animation: none; \}/);
  // From 960 px it heads the stage's column.
  assert.match(CSS, /grid-template-areas: 'rows say' 'rows stage' '\. foot';/);
  // The stress is opacity and an outline only (nothing moves), and the finished screen rests whole.
  assert.doesNotMatch(CSS, /\.op-slot\[data-tool='practise'\][^{]*\[data-demo-focus/);
  assert.doesNotMatch(CSS, /data-demo-focusing\] \.op-kc/);
  assert.match(CSS, /\.op-kc \.kc-demo__rate\[data-demo-focus\] \{ outline: 2px solid var\(--brand-word\); outline-offset: 3px; \}/);
  const cd = read('src/components/landing/demo/CursorDemo.jsx');
  assert.match(cd, /\/\/ The finished screen rests whole: no part stressed, no cursor\.\n\s*focusOn\(null\);/);
});

test('between rows the finished screen holds 700 ms, then the next row is dealt; each row\'s stage and script come from one registry', () => {
  assert.equal(ROW_HOLD_MS, 700);
  assert.match(FRAME, /dealTimer\.current = window\.setTimeout\(\(\) => start\(next\), ROW_HOLD_MS\);/);
  // A tap, a takeover, the frame leaving the window or the tab hidden cancels a pending deal.
  assert.ok((FRAME.match(/window\.clearTimeout\(dealTimer\.current\)/g) || []).length >= 5);
  // The registry: by row id, the stage (a render function) and the script; a row story joins with one entry.
  const at = FRAME.indexOf('const ROW_STAGES = {');
  const reg = FRAME.slice(at, FRAME.indexOf('\n};', at));
  for (const id of ['practise', 'cards', 'mobi', 'learn', 'rival', 'mob']) assert.match(reg, new RegExp(`\\n  ${id}: \\{ steps: SCRIPTS\\.${id}, stage: `), id);
  // Ask Mobi's typed script while the photo switch is off; every other row its one script.
  assert.match(FRAME, /function stepsOf\(id, photo = true\) \{ return \(photo === false && SCRIPTS_TYPED\[id\]\) \|\| ROW_STAGES\[id\]\?\.steps \|\| \[\]; \}/);
  assert.match(FRAME, /const stage = \(row, i\) => ROW_STAGES\[row\.id\]\?\.stage\(\{ row, i, on: i === index, playing, stages, keyCards, photo, samples, study \}\) \?\? null;/);
  assert.match(FRAME, /<CursorDemo key=\{`run-\$\{stages\.gen\[i\]\}`\} steps=\{stepsOf\(row\.id, photo\)\}/);
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
  // On a phone the marker is the CSS room's foot. On desktop it crosses at the 15% heading line when the controls fit,
  // or when the working screens clear the viewport's bottom.
  assert.match(FRAME, /\{ rootMargin: `0px 0px -\$\{ROOM_FOOT_PX\}px 0px`, threshold: \[0, 1\] \}/);
  assert.match(FRAME, /const now = triggerPassed\(\{ roomBottom: entry\.boundingClientRect\.bottom, innerHeight: window\.innerHeight \}\);/);
  assert.match(FRAME, /if \(above === null\) \{ if \(now\) runEvent\('arrive'\); \} else if \(now && !above\) runEvent\('up'\); else if \(!now && above\) runEvent\('down'\);/);
  assert.match(FRAME, /if \(passed\(\)\) runEvent\('arrive'\);/);
  assert.match(FRAME, /<span className="op-room" ref=\{roomRef\} aria-hidden="true" \/>/);
  assert.equal(PHONE_LAYOUT, '(max-width: 639px)');
  assert.equal(ROOM_FOOT_PX, 8);
  assert.equal(triggerPassed({ roomBottom: 836, innerHeight: 844 }), true);
  assert.equal(triggerPassed({ roomBottom: 840, innerHeight: 844 }), false);
  assert.equal(desktopTriggerFoot({ headingOffset: -125, workingBottom: 590, innerHeight: 900 }), 632, 'start when the heading reaches 135px');
  assert.equal(desktopTriggerFoot({ headingOffset: -125, workingBottom: 590, innerHeight: 768 }), 590, 'wait only until the working screens fit');
  assert.equal(triggerPassed({ roomBottom: 761, innerHeight: 768 }), false);
  assert.equal(triggerPassed({ roomBottom: 760, innerHeight: 768 }), true);
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
  // Each plays its story on the deck's card; its paragraph went (LK365), and its short title went too (critic round, 21 Nov
  // evening: it repeated the caption strip right above it and, as one card was dealt over another, two titles printed over
  // each other). Under the card, the proof line the stories' reports asked for: Benchmarks says the slide's two points (its
  // chip is what the story now shows), Learn and the Mob their slide's chip.
  assert.match(FRAME, /<div className="op-td op-td--story" data-row=\{row\?\.id\}>\n\s*<div className="op-td__shot">\{children\}<\/div>/);
  assert.doesNotMatch(FRAME, /op-td__title/);
  assert.match(FRAME, /if \(row\.tour\) return row\.proof \? <p className="op-proof">\{row\.proof\}<\/p> : null;/);
  assert.deepEqual(rows.map((r) => r.proof), [
    'Made to sit beside your NCERT.',
    'The daily benchmark is free. Every mock earns points toward your standing.',
    'Playing every game your Mob starts is free on every plan.',
  ]);
  // A card dealt onto a card keeps that deal after the slide (`dealtFrom` outlives `leaving`): dropping it changed the card's
  // animation back to op-deal, which started again from nothing, so the new card blinked out and faded in a second time.
  assert.match(FRAME, /data-deal=\{dealtFrom === null \? undefined : rows\[dealtFrom\]\?\.tour && rows\[index\]\?\.tour \? 'card' : 'fade'\}/);
  assert.match(FRAME, /setDealtFrom\(from !== to \? from : null\);/);
  assert.doesNotMatch(FRAME + CSS, /op-td__lede/);
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
    ['[data-demo="xs-option"]', '[data-demo="xs-next"]', '[data-demo="xs-nta"]', '[data-demo="xs-n-option"]', '[data-demo="xs-n-mark"]', '[data-demo="xs-n-palette"]']);
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
    if (/xs-next|xs-n-save|xs-n-mark/.test(step.target)) assert.equal(step.settle, PHONE_PANE, step.target);
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
  // Phones: every row's screen starts right under the caption strip that explains it (LK365; Practise's key bar and Key
  // cards' keys stay on screen at 676 px); the spare space falls below.
  assert.match(sheet, /@media \(max-width: 639px\) \{\n(  \/\*[^]*?\*\/\n)?  \.op-slot \{ align-content: start; \}/);
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
  const stories = ['MobiStory.jsx', 'mobiStory.mjs', 'LearnStory.jsx', 'learnStory.mjs', 'RivalStory.jsx', 'rivalStory.mjs', 'MobStory.jsx', 'mobStory.mjs'].map((f) => `src/components/landing/stories/${f}`);
  const files = ['src/components/landing/OnePlace.jsx', 'src/components/landing/onePlaceModel.mjs', 'src/components/landing/onePlaceCopy.mjs', 'src/components/landing/demo/CursorDemo.jsx', ...stories];
  for (const f of files) assert.doesNotMatch(read(f), /requestAnimationFrame|setInterval/, f);
  // The stories' sheets: no blur, no :has() on a large ancestor, keyframes on transform and opacity only.
  for (const f of ['mobi-story.css', 'learn-story.css', 'rival-story.css', 'mob-story.css'].map((x) => `src/components/landing/stories/${x}`)) {
    const css = read(f);
    assert.doesNotMatch(css, /backdrop-filter|filter:\s*blur|(html|body|\.mm|\.lp|\.op-frame|\.op-slot):has\(/, f);
    for (const block of css.matchAll(/@keyframes [\w-]+ \{([^@]*?)\}\s*\}/g)) assert.doesNotMatch(block[1], /\b(width|height|top|left|margin|padding)\s*:/, `${f}: keyframes animate transform and opacity only`);
  }
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
  assert.match(PAGE, /<OnePlaceGate keyCards=\{KEY_CARDS\} photo=\{MISTAKE_PHOTO_ON\} price=\{MOBI_PRICE\} tour=\{TOUR\} samples=\{TOUR_SAMPLES\} study=\{STUDY_COUNTS\}>/);
  // The Learn story's foot line counts the study release, as the tour slide's first point does.
  assert.match(PAGE, /const STUDY_COUNTS = \{ lessons: STUDY_LESSONS, subjects: STUDY_SUBJECTS \};/);
});

test('the phone nav draws the Pricing pill here too, and the Lab\'s Skip finds the next section when the bar is read', () => {
  const nav = read('src/components/NavBar.jsx');
  assert.match(nav, /\{pathname === '\/' \? \(\n\s*<Link href="\/pricing" className="mm-nav__price"/);
  // The reading line along the bar is NavBar's own on "/" (the preview needed ReadLineHere for it).
  assert.match(nav, /\{pathname === '\/' \? <NavReadLine \/> : null\}/);
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
  // The free credits the FAQ and Ask Mobi's line read: the wallet's grant, through a module with no imports (the wallet is
  // server-only and loads the database client; the home page never imports it).
  const grant = Number(read('src/services/credits/freeGrant.mjs').match(/export const AI_FREE_MONTHLY_CREDITS = (\d+);/)[1]);
  assert.equal(grant, Number(read('src/services/credits/aiCreditWallet.js').match(/export const AI_FREE_MONTHLY_CREDITS = (\d+);/)[1]));
  assert.doesNotMatch(read('src/services/credits/freeGrant.mjs'), /^import /m);
  assert.match(PAGE, /^import \{ AI_FREE_MONTHLY_CREDITS \} from '@\/services\/credits\/freeGrant\.mjs';$/m);
  assert.doesNotMatch(PAGE, /aiCreditWallet/);
  assert.match(PAGE, /freeFaq\(\{ freeCredits: AI_FREE_MONTHLY_CREDITS, dailySize: DAILY_FIVE_SIZE \}\)/);
  // On "/" the shared ways in already link this page's sample ("/#try-practice"); the preview's helpers are gone.
  assert.match(PAGE, /<div className="lp-desk" id="try-practice">/);
  assert.doesNotMatch(PAGE, /ReadLineHere|SampleHere/);
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
  // Bring a mistake's card left the frame (its sheet with it); the four stories' sheets come before the frame's own.
  assert.deepEqual(sheets, ['cursor-demo.css', 'doodle.css', 'exam-device.css', 'exam-screen.css', 'loading-kit.css', 'key-cards.css', 'brand-stamp.css', 'mobi-story.css', 'learn-story.css', 'rival-story.css', 'mob-story.css', 'one-place.css']);
  // Each story imports its own sheet too (so its preview page and the lazily loaded frame bring it).
  for (const id of STORY_IDS) assert.match(STORY_SRC[id], new RegExp(`^import '\\./${id}-story\\.css';$`, 'm'), id);
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

test('the bar steps aside for the whole frame on the home page', () => {
  // The Android app nudge (lane android, 21 Nov 2026) is also a block the bar steps aside for.
  assert.match(PAGE, /<HeroDockGate aside="\.op-gate, \.lp-app, \.dwk-story__stage">/);
  assert.equal((PAGE.match(/<HeroDockGate/g) || []).length, 1);
  const gate = read('src/components/landing/HeroDockGate.jsx');
  assert.match(gate, /export function HeroDockGate\(\{ children, aside = null \}\)/);
  assert.match(gate, /\{ rootMargin: `-\$\{NAV\}px 0px 0px 0px`, threshold: 0 \}\);\n    blocks\.forEach/);
});

test('the opening hands over once the hero has painted on the home page; without `fast` it plays as before', () => {
  assert.match(PAGE, /<OpeningMo fast \/>/);
  assert.equal((PAGE.match(/<OpeningMo/g) || []).length, 1);
  assert.deepEqual({ ...OPENING_FAST }, { wait: 700, lite: 800 });
  const live = openingGateScript(); // without `fast`, as before
  const fast = openingGateScript({ fast: true });
  assert.doesNotMatch(live, /largest-contentful-paint|"fast"/, 'the script without `fast` carries none of it');
  assert.match(fast, /largest-contentful-paint/);
  assert.match(fast, /"fast":\{"wait":700,"lite":800\}/);
  assert.doesNotThrow(() => new Function(fast));
});

test('the frame keeps one height: phones reserve the Practise runner, short phones keep every story press on screen', () => {
  // The server draws the exam monitor (it cannot know the window); the phone runner it becomes is sized to the window. The
  // shared cell is never shorter than that runner's row, so the frame does not grow when the row goes live (measured at
  // 390x844 with tmp/1121-stories/integrate/measure.mjs: 640 px drawn, 649 live, before this rule).
  assert.match(CSS, /@media \(max-width: 639px\) \{ \.op-stages \{ min-height: calc\(var\(--op-room\) \+ 64px\); \} \}/);
  // Every phone (critic round, 21 Nov evening): the working room is min(520 px, the window less the site bar, the chips, the
  // caption and the gaps, 169 px); names-only chips (44 px), 8 px gaps, no sub under the heading, and the caption the beat's
  // line with "n of m" before it, so a phone's stack above the stage is 100 px, not 271.
  assert.match(CSS, /\.op-frame \{ --op-room: min\(568px, calc\(100svh - 169px\)\); --op-switch-h: 46px; gap: 8px; \}/);
  assert.match(CSS, /#your-prep\.op \.lp-head > \.lp-sub \{ display: none; \}/);
  assert.match(CSS, /\.op-row \{ min-height: 44px; padding: 4px 14px 10px; \}\n  \.op-row__obj, \.op-row \.brand-icon \{ display: none; \}/);
  assert.match(CSS, /\.op-say__where \{ display: none; \}/);
  assert.match(CSS, /\.op-room \{ position: absolute; left: 0; top: 0; width: 1px; height: var\(--op-room, 0px\);/);
  assert.doesNotMatch(CSS, /op-td__copy \{ display: none; \}/);
  // The section's reserve while undrawn wins over r19-home-b.css's `body .mm.lp main > #your-prep` (3500 px, the old deck's).
  assert.match(read('src/app/r19-home-b.css'), /body \.mm\.lp main > #your-prep \{ contain-intrinsic-size: auto 3500px; \}/);
  const reserves = [...CSS.matchAll(/([^{}\n]*#your-prep[^{}\n]*)\{ contain-intrinsic-size:/g)].map((m) => m[1].trim());
  assert.ok(reserves.length >= 1);
  for (const sel of reserves) assert.equal(sel, 'body .mm.lp main > #your-prep.op', sel);
  // Every story is a fixed-height screen, so nothing in the frame moves between its phases.
  assert.match(read('src/components/landing/stories/mobi-story.css'), /\.st-mobi__screen \{\n\s*height: 488px;/);
  assert.match(read('src/components/landing/stories/rival-story.css'), /height: 500px; overflow: hidden;/);
});
