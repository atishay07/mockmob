// Round 3, packet R3-brand (5 Nov 2026, owner LK101, LK102, LK108, LK114; docs/brain/night-1105/SPEC-R3.md R3-D1, R3-D2, R3-D11).
//   R3-D1  Day palette: one Day text green (#526700, the app's accentText) for brand words, accents, numbers and the focus ring; volt
//          stays the action fill with a darker Day lip (#8BA000) and an olive hairline; a Day selected chip, segment, Compass group
//          or Lab rail item is raised paper with a #526700 rim and a small volt tick, never a volt slab on cream; warm shadows.
//   R3-D2  Brand back by role: brand words, hero numbers, progress and selected marks take --brand-word; the product screens that
//          are dark in both themes use the app's own volt; product-name stamps above the h2s; the creator cards branded again
//          with an answer-sheet (OMR) texture; the two-beat voice.
//   R3-D11 The Accountancy ask says what the 2025 paper asked; AFS stays the default.
//   node --test data/tests/brand_r3_1105.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATEMENT, RECOVERY_HEAD, TOUR_HEAD, BRAND_STAMPS, LAB_SCENES, buildTour } from '../../src/components/landing/homeCopy.mjs';
import { BRAND_ICONS } from '../brand_icons.mjs';
import { OPTION_ASKS } from '../../src/app/onboarding/optionChoices.mjs';

const root = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8').replace(/\r\n/g, '\n');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const css = (rel) => strip(read(rel));

function block(text, selector) {
  const start = text.indexOf(`${selector} {`);
  assert.ok(start >= 0, `block ${selector} exists`);
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') { depth -= 1; if (depth === 0) return text.slice(open + 1, i); }
  }
  throw new Error(`block ${selector} is not closed`);
}
const props = (text) => Object.fromEntries([...text.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().replace(/\s+/g, ' ')]));
const rule = (text, selector) => {
  const at = text.indexOf(`${selector} {`);
  assert.ok(at >= 0, `rule ${selector} exists`);
  return text.slice(at, text.indexOf('}', at) + 1);
};
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const THEME = css('src/app/marketing-theme.css');
const night = props(block(THEME, "html[data-theme='dark'] .mm"));
const day = props(block(THEME, "html[data-theme='light'] .mm"));

// ------------------------------------------------------------------------------------------------ R3-D1 the Day palette
test('R3-D1: Day has one text green, #526700, for brand words and the focus ring; it holds AA on paper and raised', () => {
  assert.equal(day['brand-word'], '#526700');
  assert.equal(day['accent-text'], '#526700');
  assert.equal(day['focus-ring'], '#526700');
  assert.ok(contrast('#526700', day.paper) >= 5.5, `on paper ${contrast('#526700', day.paper).toFixed(2)}`);
  assert.ok(contrast('#526700', day['paper-raised']) >= 6.2, `on raised ${contrast('#526700', day['paper-raised']).toFixed(2)}`);
  assert.ok(contrast('#526700', day['paper-raised-2']) >= 4.5, 'on raised-2');
  // Night is unchanged: the brand volt is the brand word, links and labels stay ink.
  assert.equal(night['brand-word'], '#d2f000');
  assert.equal(night['accent-text'], 'var(--ink)');
});

test('R3-D1: no greyer #3F5200 left on the home page (brand word, statement, hero line, motion-kit fallback)', () => {
  for (const file of ['src/app/marketing-theme.css', 'src/app/hero-depth.css', 'src/app/hero-scene.css', 'src/app/motion-kit.css', 'src/app/landing.css']) {
    assert.doesNotMatch(css(file), /#3f5200/i, `${file} still draws #3F5200`);
  }
  assert.match(css('src/app/hero-depth.css'), /html\[data-theme='light'\] \.mm\.lp \.lp-statement \{ --statement-accent: #526700; \}/);
  assert.match(css('src/app/hero-scene.css'), /html\[data-theme='light'\] \.mm\.lp \.lp-hero \.lp-title__brand \{ color: #526700; \}/);
  assert.match(css('src/app/motion-kit.css'), /var\(--a-accent-text, #526700\)/);
});

test('R3-D1: the key keeps its volt fill and dark ink; in Day its lip is #8BA000 with an inset olive hairline, Night keeps #9DB400', () => {
  const marketing = props(block(css('src/app/marketing.css'), '.mm'));
  assert.equal(marketing.volt, '#d2f000');
  assert.equal(marketing['volt-ink'], '#0b1000');
  assert.equal(marketing['volt-edge'], '#8ba000', 'the base .mm tokens are the Day palette');
  assert.equal(day['volt-edge'], '#8ba000');
  assert.equal(day['key-hairline'], 'inset 0 0 0 1px rgba(82, 103, 0, 0.28)');
  assert.equal(night['volt-edge'], '#9db400');
  assert.equal(night['key-hairline'], 'inset 0 0 0 0 transparent');
  assert.ok(contrast('#8ba000', day.paper) >= 2.5, `the Day lip against the cream ${contrast('#8ba000', day.paper).toFixed(2)}`);
  assert.ok(contrast('#0b1000', '#d2f000') >= 14, 'ink on the key');
  const key = rule(css('src/app/marketing.css'), '.mm-btn--primary');
  assert.match(key, /box-shadow: var\(--key-hairline, inset 0 0 0 0 transparent\), 0 var\(--btn-edge\) 0 var\(--volt-edge\), var\(--sh-2\);/);
  assert.match(rule(css('src/app/marketing.css'), '.mm-btn--primary:active'), /var\(--key-hairline/, 'the hairline stays while pressed');
  // The dark surfaces inside a Day page (the footer, product stills) take the Night lip and no hairline.
  assert.match(THEME, /:is\(\.mm-screen, \.mm-foot\) \{[^}]*--volt-edge: #9db400; --key-hairline: inset 0 0 0 0 transparent;/);
});

test('R3-D1: the Day state tokens: wash rgba(210,240,0,.22), rim #526700, tick rim rgba(82,103,0,.55)', () => {
  assert.equal(day['state-wash'], 'rgba(210, 240, 0, 0.22)');
  assert.equal(day['volt-soft'], 'rgba(210, 240, 0, 0.22)');
  assert.equal(day['sel-rim'], '#526700');
  assert.equal(day['tick-rim'], 'rgba(82, 103, 0, 0.55)');
  assert.ok(contrast('#526700', day['paper-raised']) >= 3, 'the rim meets the 3:1 non-text rule on the raised fill');
  // Ink on the wash, composited on the paper (#ECEFB3), stays AAA.
  assert.ok(contrast('#1b1914', '#eceFb3'.toLowerCase()) >= 7);
});

test('R3-D1: a Day selected chip, segment, Compass group or Lab rail item is raised paper, a #526700 rim and ink, with a small volt tick; never a volt slab', () => {
  const du = css('src/components/du/du.css');
  assert.match(du, /html\[data-theme='light'\] \.lp \.du-chip\[aria-pressed="true"\],\nhtml\[data-theme='light'\] \.lp \.du-seg__btn\[aria-checked="true"\] \{ border-color: var\(--sel-rim\); background: var\(--paper-raised\); box-shadow: inset 0 0 0 0\.5px var\(--sel-rim\); color: var\(--ink\); \}/);
  assert.match(du, /html\[data-theme='light'\] \.lp \.du-chip\[aria-pressed="true"\] \.du-chip__tick \{ border: 1px solid var\(--tick-rim\); background: var\(--volt\); color: var\(--volt-ink\); \}/);
  assert.match(du, /html\[data-theme='light'\] \.lp \.du-seg__btn\[aria-checked="true"\]::after \{[^}]*border: 1px solid var\(--tick-rim\); background: var\(--volt\) var\(--tick-check\)/);
  const cl = css('src/app/compass-ladder.css');
  assert.match(cl, /html\[data-theme='light'\] \.cl__group button\[aria-pressed='true'\] \{ background: var\(--paper-raised\); border-color: var\(--sel-rim\); box-shadow: inset 0 0 0 0\.5px var\(--sel-rim\); color: var\(--ink\); \}/);
  assert.match(cl, /html\[data-theme='light'\] \.cl__group button\[aria-pressed='true'\]::after \{[^}]*var\(--tick-rim\)[^}]*var\(--volt\) var\(--tick-check\)/);
  const lc = css('src/app/lab-cinema.css');
  assert.match(lc, /html\[data-theme='light'\] \.lc__rail button\[data-on='true'\] \.lc__rail-ico \{ background: var\(--paper-raised\); border-color: var\(--sel-rim\);[^}]*color: var\(--ink\); \}/);
  assert.match(lc, /html\[data-theme='light'\] \.lc__rail button\[data-on='true'\] \.lc__rail-ico::after \{[^}]*var\(--tick-rim\)/);
  // The tick pops in once (180 ms ease-out from 0.6) and rests under reduced motion; its check glyph is dark ink.
  const marketing = css('src/app/marketing.css');
  assert.match(marketing, /@keyframes mm-tick-in \{ from \{ opacity: 0; transform: scale\(0\.6\); \} to \{ opacity: 1; transform: none; \} \}/);
  assert.match(marketing, /@media \(prefers-reduced-motion: reduce\) \{ \.mm \{ --tick-anim: none; \} \}/);
  assert.match(marketing, /--tick-check: url\("data:image\/svg\+xml,[^"]*stroke='%230b1000'/);
  // Day hover on these controls is the state wash, not a grey.
  assert.match(du, /html\[data-theme='light'\] \.lp :is\(\.du-chip:not\(\[aria-pressed="true"\]\), \.du-seg__btn:not\(\[aria-checked="true"\]\)\):hover \{ background: var\(--state-wash\); \}/);
  assert.match(cl, /html\[data-theme='light'\] \.cl__group button:not\(\[aria-pressed='true'\]\):hover \{ background: var\(--state-wash\); \}/);
});

test('R3-D1: warm shadows: no green-black rgba(20,32,14) or rgba(23,32,22) on the nav, the dock, the tour screen or the public packs', () => {
  for (const file of ['src/app/hero-depth.css', 'src/app/feature-tour.css', 'src/app/tour-screens.css', 'src/app/public-polish.css', 'src/app/marketing-theme.css', 'src/app/social-proof.css']) {
    assert.doesNotMatch(css(file), /rgba\(\s*(20,\s*32,\s*14|23,\s*32,\s*22)/, `${file} still casts a green-black shadow`);
  }
  assert.match(css('src/app/hero-depth.css'), /box-shadow: 0 1px 0 rgba\(27, 25, 20, 0\.07\), 0 10px 24px -20px rgba\(27, 25, 20, 0\.35\);/);
});

test('R3-D1: the Day palette is recorded in DESIGN.md and shared/tokens.css', () => {
  const design = read('DESIGN.md');
  for (const value of ['#F3EFE6', '#FFFDF8', '#1B1914', '#D2F000', '#0B1000', '#8BA000', '#526700', '#3D6600', 'rgba(210, 240, 0, 0.22)']) {
    assert.ok(design.includes(value), `DESIGN.md records ${value}`);
  }
  assert.match(design, /never a raw volt slab on cream/i);
  const tokens = read('shared/tokens.css');
  for (const [name, value] of [['--mm-paper', '#f3efe6'], ['--mm-raised', '#fffdf8'], ['--mm-ink', '#1b1914'], ['--mm-volt', '#d2f000'], ['--mm-volt-ink', '#0b1000'], ['--mm-volt-edge-day', '#8ba000'], ['--mm-text-green-day', '#526700'], ['--mm-good-day', '#3d6600']]) {
    assert.match(tokens, new RegExp(`${name}:\\s*${value}`, 'i'), `shared/tokens.css ${name}`);
  }
});

// ------------------------------------------------------------------------------------------------ R3-D2 brand back, by role
test('R3-D2: "MockMob" in the statement is a green word (LK102), with where, tonight and shortlist', () => {
  assert.equal(STATEMENT, 'Your marks slipped somewhere. *MockMob shows you *where, picks the chapter for *tonight, and keeps your DU *shortlist in sight.');
});

test('R3-D2: the brand stamps are product names only, each with a desk object, sentence case, no caps and no dots', () => {
  assert.deepEqual(Object.values(BRAND_STAMPS).map((s) => s.name), ['Mistake Lab', 'Score Recovery Lab', 'DU Compass', 'MockMob on Instagram', 'Wall of love', 'Key cards']);
  for (const { icon, name } of Object.values(BRAND_STAMPS)) {
    assert.ok(BRAND_ICONS[icon], `${name} draws a real desk object (${icon})`);
    assert.doesNotMatch(name, /[·•.:]|^[A-Z ]+$/, `${name} is sentence case with no dots`);
  }
  const page = read('src/app/page.js');
  for (const [key, h2] of [['lab', 'LAB_HEAD'], ['recovery', 'RECOVERY_HEAD'], ['compass', 'COMPASS_HEAD'], ['instagram', 'INSTAGRAM_HEAD'], ['wall', 'WALL_HEAD']]) {
    assert.match(page, new RegExp(`<BrandStamp \\{\\.\\.\\.BRAND_STAMPS\\.${key}\\} />\\n\\s*<h2 className="lp-h2"[^>]*>\\{${h2}\\.h2\\}`), `${key}: the stamp sits right above its h2`);
  }
  assert.equal((page.match(/<BrandStamp /g) || []).length, 5, 'five stamps on the page (Key cards stamps its own section when it lands)');
  const stamp = css('src/app/brand-stamp.css');
  const body = rule(stamp, '.mm.lp .lp-stamp');
  assert.match(body, /color: var\(--brand-word\);/);
  assert.match(body, /letter-spacing: 0;/);
  assert.doesNotMatch(stamp, /text-transform|uppercase|border-radius|background|::before|::after|font-mono|monospace/, 'no caps, no pill, no dot, no mono');
  const jsx = read('src/components/landing/BrandStamp.jsx');
  assert.match(jsx, /brandIconSrc\(icon, size\)/);
  assert.match(jsx, /width=\{size\} height=\{size\}/, 'the box is sized before the file decodes');
  assert.match(jsx, /aria-hidden="true"/, 'the object is decorative: the name says it');
});

test('R3-D2: brand words, hero numbers, progress and selected marks on the page take --brand-word', () => {
  assert.match(rule(css('src/app/compass-ladder.css'), '.cl__big'), /color: var\(--brand-word\);/, 'the Compass score');
  assert.match(rule(css('src/app/compass-ladder.css'), '.lp-cpro__badge'), /color: var\(--brand-word\) !important;/, 'the product names Compass Pro and Combo Planner');
  assert.match(css('src/app/mistake-lab.css'), /\.ml__steps li\[data-active='true'\] \.ml__num \{ color: var\(--brand-word\); \}/, 'the Recovery active step');
  assert.match(css('src/app/mistake-lab.css'), /\.ml-story\[data-pinned='true'\] \.ml__bar b\.ss-fill \{[^}]*background: var\(--brand-word\);/, 'the Recovery story progress');
  const ft = css('src/app/feature-tour.css');
  assert.match(ft, /\.ft__row::after \{[^}]*background: var\(--brand-word\);[^}]*transform: scaleX\(0\);/, 'the tab underline');
  assert.match(ft, /\.ft__row\[data-on='true'\]::after \{ transform: scaleX\(1\); \}/);
  assert.match(ft, /\.ft__progress i \{[^}]*background: var\(--brand-word\);/, 'the tour progress');
  assert.match(ft, /\.ft-story\[data-pinned='true'\] \.ft__progress \.ss-fill \{[^}]*background: var\(--brand-word\);/);
  assert.match(css('src/app/lab-cinema.css'), /\.lc__rail-meter \.ss-fill \{[^}]*background: var\(--brand-word\);/, 'the Lab story progress');
  assert.match(css('src/app/social-proof.css'), /\.rl__summary dd \{[^}]*color: var\(--brand-word, var\(--ink\)\);/, 'the creator summary numbers');
});

test('R3-D2: the tour and Lab screens look like the app again: volt timer, picked answer, Saved, marks, your Ask Mobi bubble, the pace line', () => {
  const ts = css('src/app/tour-screens.css');
  assert.match(ts, /\.ts__timer \{[^}]*color: var\(--ts-volt\);/);
  assert.match(ts, /\.ts__opts li\[data-picked='true'\] \{ border-color: rgba\(210,240,0,\.6\); background: rgba\(210,240,0,\.1\); \}/);
  assert.match(ts, /\.ts__saved \{ color: var\(--ts-volt\);/);
  assert.match(ts, /\.ts__marks \{[^}]*color: var\(--ts-volt\);/);
  assert.match(ts, /\.ts__bubble--me \{[^}]*background: var\(--ts-volt\); color: #0b1000;/);
  assert.match(ts, /\.ts__progress i \{[^}]*background: var\(--ts-volt\);/);
  const lc = css('src/app/lab-cinema.css');
  assert.match(lc, /\.lct__pace \{[^}]*border-left: 2px dashed var\(--s-accent\);/);
  assert.match(lc, /\.lct__pace-label \{[^}]*color: var\(--s-accent\);/);
  assert.match(css('src/app/mistake-lab.css'), /\.ml__marks b \{[^}]*color: #d2f000; \}/, 'the Recovery marks');
  // Marks, never light: no volt glow or halo anywhere on these screens.
  for (const file of ['src/app/tour-screens.css', 'src/app/lab-cinema.css', 'src/app/mistake-lab.css', 'src/app/social-proof.css']) {
    assert.doesNotMatch(css(file), /0 0 \d+px[^;]*(210, ?240, ?0|d2f000)|drop-shadow\([^)]*(210, ?240, ?0|d2f000)/i, `${file}: no volt glow`);
  }
});

test('R3-D2: "Featured by CUET creators" is branded again: volt reach, the dashed-orbit monogram in Bricolage, the volt play key, heart and hover edge, volt avatars', () => {
  const sp = css('src/app/social-proof.css');
  assert.match(sp, /\.rl__reach b \{[^}]*color: #d2f000; \}/);
  assert.match(sp, /\.rl__cover-mark \{[^}]*border: 1px solid rgba\(210,240,0,\.45\);[^}]*color: #d2f000; font: 800 0\.9rem var\(--font-display\);/);
  assert.match(sp, /\.rl__cover-orbit \{[^}]*border: 1px dashed rgba\(210,240,0,\.4\);/);
  assert.match(sp, /\.rl__play \{[^}]*background: #d2f000; color: #0b1000; box-shadow: 0 4px 0 #9db400;/);
  assert.match(sp, /\.rl__card:active \.rl__play \{ transform: translateY\(2px\); box-shadow: 0 2px 0 #9db400; \}/);
  assert.match(sp, /\.rl__engage svg \{ color: #d2f000; \}/);
  assert.match(sp, /\.rl__card:hover \{ border-color: rgba\(210,240,0,\.56\); \}/);
  assert.match(sp, /\.wl__avatar \{[^}]*border: 1px solid var\(--tick-rim, transparent\); background: var\(--volt\); color: var\(--volt-ink\);/);
  assert.match(read('src/components/landing/CreatorReels.jsx'), /<span className="rl__cover-orbit" \/>/);
  // The summary is a raised strip, not glass over a glow.
  const summary = rule(sp, '.rl__summary');
  assert.match(summary, /background: var\(--paper-raised\);/);
  assert.doesNotMatch(sp, /backdrop-filter|radial-gradient\(closest-side, rgba\(210/);
});

test('R3-D2: the creator cards’ texture is the brand’s answer sheet (OMR bubbles, some marked volt), never a generic grid or a glow', () => {
  const card = rule(css('src/app/social-proof.css'), '.rl__card::before');
  assert.match(card, /data:image\/svg\+xml/);
  assert.ok((card.match(/%3Ccircle/g) || []).length >= 20, 'rows of answer bubbles');
  assert.match(card, /fill='%23d2f000'/, 'a marked bubble per row is volt');
  assert.doesNotMatch(card, /linear-gradient\(90deg|linear-gradient\(0deg/, 'no hairline grid');
  assert.match(card, /mask-image: radial-gradient/, 'it fades out before the words');
  assert.match(card, /pointer-events: none/);
});

test('R3-D2: the two-beat voice where it is true (LK114)', () => {
  assert.equal(RECOVERY_HEAD.h2, 'Fix it once. Check it holds.');
  assert.match(TOUR_HEAD.sub, /^Practise\. Replay\. Repair\. /);
  assert.equal(LAB_SCENES.find((s) => s.key === 'repair').title, 'Fix why you missed it.');
  assert.equal(buildTour().find((s) => s.id === 'repair').title, 'Fix why you missed it.');
});

// ------------------------------------------------------------------------------------------------ R3-D11 Accountancy Part B
test('R3-D11: the Accountancy ask says the 2025 paper asked AFS only, and AFS stays the default', () => {
  assert.equal(OPTION_ASKS.accountancy.default, 'AFS');
  assert.equal(OPTION_ASKS.accountancy.note, 'The 2025 CUET paper asked Analysis of Financial Statements only.');
  for (const id of ['mathematics', 'computer_science']) assert.equal(OPTION_ASKS[id].note, undefined, `${id} carries no note`);
  const picker = read('src/app/onboarding/OptionPicker.jsx');
  assert.match(picker, /\{ask\.note \? <p className="ob-opt__note">\{ask\.note\}<\/p> : null\}/);
  assert.ok(picker.indexOf('ob-opt__ask') < picker.indexOf('ob-opt__note'), 'the note sits under the ask, before the choices');
  assert.match(css('src/app/onboarding/onboarding.css'), /\.ob-opt__note \{[^}]*color: var\(--a-ink\);/, 'ink, set apart by weight, not colour');
});
