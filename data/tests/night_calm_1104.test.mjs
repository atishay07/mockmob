// Home spec 4 Nov 2026, packet P1 ("Night calm", LK68; slop C1-C9, C11): the CSS of the home page may use volt for exactly three roles:
//   1. the brand (logo dot, Mobi);  2. the one primary key as a fill (with its owned keycap edge);  3. a selected or current state as a fill
//   that carries dark ink.  Plus the focus ring (functional) and the two owner brand words, which read --brand-word.
// Volt is never a text colour, never an edge on a container, never a glow, never a radial or gradient wash. No glass on content.
//
// Round 3 (R3-D1/D2, owner LK101/LK108, 5 Nov 2026) changes two of these rules, by role and never as decoration:
//   - Brand words, hero numbers, progress and selected marks on the page read --brand-word (volt in Night, #526700 in Day);
//     that token is not a volt literal, so these rules do not see it, and brand_r3_1105.test.mjs pins which roles use it.
//   - The product screens that are dark in both themes (the tour's .ts, the Lab's screen, the Recovery stage, the creator cards,
//     the Compass ladder) look like the app again: their own volt may colour text, marks, progress and edges there. Still no glow,
//     no wash and no glass. Elsewhere C1 and C2 hold as they were.
//   - Day never lays a volt slab on cream (C12 now pins the Day selected-state rule: raised paper, #526700 rim, a small volt tick).
// This grep test is the static half of the gate; the capture half is tmp/home-1104/slop/capture.mjs (volt text runs, edges, glows,
// washes, glass, tint pixels, loops per viewport) against a running build.
//   node --test data/tests/night_calm_1104.test.mjs                    packet P1's own files
//   NIGHT_CALM_ALL=1 node --test data/tests/night_calm_1104.test.mjs   also the other home packets' stylesheets (the integration gate)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const MINE = [
  'src/app/marketing-theme.css', 'src/app/marketing.css', 'src/app/landing.css', 'src/app/home.css', 'src/app/feature-tour.css',
  'src/app/tour-screens.css', 'src/app/compass-ladder.css', 'src/app/social-proof.css', 'src/app/lab-cinema.css', 'src/app/mistake-lab.css',
  'src/components/du/du.css',
  // R3-D8 (5 Nov 2026): the home page's one plan, its value calculator and the dated comparison (HomePricing.jsx).
  'src/app/home-pricing.css',
  // Round 3 (5 Nov 2026), packet R3-cards: the Key cards section and the loading kit are held to the same calm by default.
  'src/components/landing/key-cards.css', 'src/components/landing/loading-kit.css',
];
// Owner decisions of round 3 (SPEC-R3 R3-D8, owner LK109 and LK112, 5 Nov 2026) that supersede C7 and C9 for one element each:
//   GLASS_OK   the home plan card is glass ("the pricing card ... glassmorphism effect"), a blur over the word "Pro" only;
//   STRIP_ART  the plan card carries the /pricing page's own art (the answer sheet's volt rule, its marked answers and the
//              "MockMob Pro" label's volt mark), which the owner asked to bring with the plan: brand art, not a wash or an edge.
const GLASS_OK = /\.lp-plan\.pro-plan__card/;
const STRIP_ART = /\.pro-strip__rule|\.pro-strip__dots i\[data-on\]|\.pro-chip__dot/;
const OTHERS = [
  'src/app/hero-scene.css', 'src/app/home-refinements.css', 'src/app/hero-depth.css', 'src/app/scroll-story.css', 'src/app/section-position.css',
  'src/app/landing-close.css', 'src/app/exam-screen.css', 'src/app/opening.css',
];
const FILES = process.env.NIGHT_CALM_ALL ? [...MINE, ...OTHERS] : MINE;

// A volt literal: the key colour, its keycap edge, a volt rgba, or a token that resolves to one.
const VOLT_LITERAL = /#d2f000|#9db400|rgba?\(\s*210,\s*240,\s*0|var\(--(?:volt|volt-edge|ts-volt|s-accent)(?![\w-])/i;
const INK_ON_FILL = /(^|;)\s*color\s*:\s*(var\(--volt-ink[^)]*\)|#0b1000|var\(--s-accent-ink\)|var\(--ts-ink\)|#12110e)/i;

function rulesOf(file) {
  let css;
  try { css = strip(read(file)); } catch { return []; } // a sibling packet's file that does not exist yet
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    const decls = m[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(':');
      return { prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim().replace(/\s+/g, ' ') };
    });
    out.push({ file, selector, decls, text: m[2] });
  }
  return out;
}
const RAW_RULES = FILES.flatMap(rulesOf);
// du.css is shared with the app's Colleges and Compass screens, which keep their lit surfaces (G28, du-flat.css). A base rule there may carry
// volt only while a ".lp <same selector>" override calms it on the home and public pages; the override is what this test then judges.
const lpSelectors = new Set(RAW_RULES.filter((r) => /du\.css$/.test(r.file)).flatMap((r) => r.selector.split(',').map((s) => s.trim())).filter((s) => s.startsWith('.lp ')));
const coveredBase = (r) => /du\.css$/.test(r.file) && !r.selector.includes('.lp ') && !/:focus/.test(r.selector) && r.selector.split(',').every((s) => lpSelectors.has(`.lp ${s.trim()}`));
const ALL_RULES = RAW_RULES.filter((r) => !coveredBase(r));
const voltIn = (value) => VOLT_LITERAL.test(value.replace(/var\(--accent-text, var\(--volt\)\)/g, 'var(--accent-text)'));
const describe = (r, d) => `${r.file.split('/').pop()}: ${r.selector} { ${d.prop}: ${d.value} }`;

// The product screens that are dark in both themes (R3-D2): every selector inside one of them.
const DARK_SCREEN = /(^|[\s,>+~])\.(ts\b|ts__|lct__|lcp-|lcc__|lcd\b|lcd__|ml__(marks|counts|tiles?|tn|leaks|move|strip|checkicon|headline|panel|stage|bar-top|tag)\b|rl__(card|cover-mark|cover-orbit|reach|engage|load-label|play|who|kind|about|identity|partner)\b|cl__(stage|list|track|cut|gap|name|top|tag)\b)/;
const inDarkScreen = (selector) => selector.split(',').every((part) => DARK_SCREEN.test(` ${part.trim()}`));
// Selectors where a volt fill or glyph is the brand itself or the current state.
const BRAND_OR_STATE = /\.logo|mobi|__you\b|__you-key|__tab-ink|__pip\[data-state="now"\]|\.mm-hero__decode|readout__fill|fill-volt/i;

test('volt is never a text colour on the page (C1): only the logo dot, a tick on dark ink, and the app’s own marks inside a dark product screen (R3-D2)', () => {
  const offenders = [];
  for (const r of ALL_RULES) {
    for (const d of r.decls) {
      if (!/^(color|-webkit-text-fill-color|text-decoration-color|caret-color|stroke|fill)$/.test(d.prop)) continue;
      if (!voltIn(d.value)) continue;
      // .lp-room__dot: the painted answer sheet fills one bubble per sample answer (decision 13): a state fill, not text.
      if (/\.logo \.dot|\.lp-room__dot|\.du-chip\[aria-pressed="true"\] \.du-chip__tick/.test(r.selector)) continue;
      // D2 (owner LK82, 5 Nov 2026, supersedes C1 for this one line): the hero's "CUET 2027." is the brand volt as text in
      // Night (#D2F000; olive #3F5200 in Day). docs/design-decisions/web-1105-hero.md.
      if (/\.lp-hero \.lp-title__brand/.test(r.selector) && d.prop === 'color') continue;
      // R3-D2 (LK108): inside a screen that is dark in both themes the app's own volt marks the timer, the marks, Saved, the reach.
      if (inDarkScreen(r.selector)) continue;
      offenders.push(describe(r, d));
    }
  }
  assert.deepEqual(offenders, []);
});

test('no container on the page carries a volt edge or ring (C2): neutral hairlines; only focus rings, and marks inside a dark product screen (R3-D2)', () => {
  const offenders = [];
  for (const r of ALL_RULES) {
    for (const d of r.decls) {
      if (!/^(border|border-(top|right|bottom|left|inline|block)(-\w+)?|border-color|outline|outline-color)$/.test(d.prop)) continue;
      if (!voltIn(d.value)) continue;
      if (/^outline/.test(d.prop) && /:focus/.test(r.selector)) continue;
      if (inDarkScreen(r.selector)) continue; // R3-D2: the pace line, the clock sweep, the monogram's orbit, a picked answer
      offenders.push(describe(r, d));
    }
  }
  assert.deepEqual(offenders, []);
});

test('no coloured glows or halos (C3): box-shadow, text-shadow and drop-shadow never carry volt, except the owned keycap edge', () => {
  const KEYCAP = /^0\s+(?:var\(--btn-edge\)|\d+(?:px)?)\s+0\s+(?:var\(--volt-edge\)|#9db400)$/i;
  const offenders = [];
  for (const r of ALL_RULES) {
    for (const d of r.decls) {
      if (!/^(box-shadow|text-shadow|filter|-webkit-filter)$/.test(d.prop)) continue;
      const parts = []; let depth = 0; let cur = '';
      for (const ch of d.value) { if (ch === '(') depth += 1; if (ch === ')') depth -= 1; if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch; }
      parts.push(cur.trim());
      for (const part of parts) {
        if (!VOLT_LITERAL.test(part) && !/rgba?\(\s*(?:1[5-9][0-9]|2[0-4][0-9])\s*,\s*(?:2[0-4][0-9])\s*,\s*[0-9]{1,2}\s*,/i.test(part)) continue;
        if (d.prop === 'box-shadow' && KEYCAP.test(part)) continue;
        offenders.push(`${describe(r, d)} <- ${part}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('no volt radial, conic or linear washes (C4, C5): a gradient never carries volt; the only light is the painted lamp', () => {
  const offenders = [];
  for (const r of ALL_RULES) {
    for (const d of r.decls) {
      if (!/gradient\(/.test(d.value)) continue;
      if (voltIn(d.value) || /rgba?\(\s*(?:1[0-9]{2}|2[0-4][0-9])\s*,\s*(?:2[0-4][0-9])\s*,\s*[0-9]{1,2}\s*,/.test(d.value) || /var\(--accent-(?:wash|line)/.test(d.value)) offenders.push(describe(r, d));
    }
  }
  assert.deepEqual(offenders, []);
  // The warm pool of lamp light under the statement shelf is painted amber, not volt, and stays (home.css).
  assert.match(strip(read('src/app/home.css')), /\.lp-shelf::before \{[^}]*rgba\(255, 196, 120/);
});

test('a volt fill is the key, the brand, a selected state carrying dark ink, or progress inside a dark product screen (C9, R3-D2)', () => {
  const offenders = [];
  for (const r of ALL_RULES) {
    for (const d of r.decls) {
      if (!/^background(-color)?$/.test(d.prop) || !voltIn(d.value)) continue;
      if (BRAND_OR_STATE.test(r.selector)) continue;
      if (INK_ON_FILL.test(r.text)) continue;
      if (STRIP_ART.test(r.selector) && /home-pricing\.css$/.test(r.file)) continue;
      if (/\.mm-btn|\.btn-volt|\.pill\.volt/.test(r.selector)) continue;
      // R3-D2: inside a dark product screen the app's own marks are volt (progress, a picked answer's tint, a cleared bar, a
      // legend dot), never the screen or card itself.
      if (inDarkScreen(r.selector) && !/(^|,)\s*\.(ts|lcd|ml__stage|rl__card|cl__stage)\s*(,|$)/.test(r.selector)) continue;
      // Day's small selection tick and the Wall of love avatar: a volt bubble that carries the #526700@55% rim (R3-D1, R3-D2).
      if (/::after/.test(r.selector) && /var\(--tick-rim\)/.test(r.text)) continue;
      offenders.push(describe(r, d));
    }
  }
  assert.deepEqual(offenders, []);
});

// R3-D10 (owner LK112, 5 Nov 2026: "the same way the pricing card and other things have a glassmorphism effect"): the owner asked
// for glass on the Key cards card, so its front panel (.kc-demo__glass, over the card's own subject object) is the one named
// exception on content; his words supersede C7 for that panel only. docs/design-decisions/web-r3-cards.md.
test('no glass on content (C7): backdrop-filter appears only on the site bar, its fade, the dock, the summary bar, the home plan card (R3-D8) and the Key cards front', () => {
  const offenders = [];
  for (const r of ALL_RULES) {
    for (const d of r.decls) {
      if (!/backdrop-filter$/.test(d.prop) || /^none$/.test(d.value)) continue;
      if (/\.mm-nav|\.mm-dock|\.lp-pos|\.du-sum|\.du-toast/.test(r.selector)) continue;
      if (GLASS_OK.test(r.selector) && /home-pricing\.css$/.test(r.file)) continue;
      if (/^\.kc-demo__glass$/.test(r.selector) && /key-cards\.css$/.test(r.file)) continue;
      offenders.push(describe(r, d));
    }
  }
  assert.deepEqual(offenders, []);
});

test('the hero draws no grid, dot matrix or pointer spotlight (C6, M7): the layers, their pointer variables and their volt dots are gone', () => {
  const landing = strip(read('src/app/landing.css'));
  assert.doesNotMatch(landing, /lp-bg__spot|--mx|--my|data-live/);
  const backdrop = strip(read('src/components/landing/HeroBackdrop.jsx'));
  assert.doesNotMatch(backdrop, /pointermove|--mx|requestAnimationFrame|lp-bg/);
  assert.doesNotMatch(strip(read('src/app/marketing-theme.css')), /lp-bg__spot/);
});

test('the dead glow rules are gone, so they cannot come back (C8): no pinging pill dot, no lit step edge, no stepvis volt bars', () => {
  const landing = strip(read('src/app/landing.css'));
  assert.doesNotMatch(landing, /lp-ping|lp-pill__dot|\.lp-step::before|\.lp-stepvis|lp-sat__dot--volt/);
  assert.doesNotMatch(strip(read('src/app/lab-cinema.css')), /box-shadow: 0 0 0 4px var\(--accent-wash\)/);
});

test('Night has no coloured token for the edges, the wash or the text of links and labels (C1, C2, C11)', () => {
  const theme = strip(read('src/app/marketing-theme.css'));
  const dark = theme.slice(theme.indexOf("html[data-theme='dark'] .mm {"), theme.indexOf("html[data-theme='light'] .mm {"));
  const light = theme.slice(theme.indexOf("html[data-theme='light'] .mm {"), theme.indexOf("html[data-theme='light']:has"));
  for (const block of [dark, light]) {
    assert.match(block, /--accent-line: var\(--line-strong\)/);
    assert.match(block, /--accent-wash: transparent/);
  }
  assert.match(dark, /--accent-text: var\(--ink\)/);
  // Two named exceptions: the focus ring, and the brand words ("CUET 2027.", the tour's "MockMob"), which the owner asked to be
  // the brand green on 5 Nov (LK82, LK86). Edges, washes, links and labels stay ink.
  assert.doesNotMatch(dark.replace('--focus-ring: #d2f000', '').replace('--brand-word: #d2f000', ''), /d2f000|210, ?240, ?0/i);
  // the green-black is gone from every home stylesheet: no #0b100e, #070908 or the old Night greens as a ground
  for (const file of MINE) {
    assert.doesNotMatch(strip(read(file)), /#0b100e|#070908|#0c100b|#131a16|#18211b/i, `${file} still carries the old green-black`);
  }
});

test('shelf objects: only the lit one floats forever; the others float twice and rest (M2, decision 19)', () => {
  const home = strip(read('src/app/home.css'));
  assert.match(home, /subj-obj-float 7\.2s 2 both, lp-shelf-in backwards, lp-shelf-out forwards/);
  assert.match(home, /\.subj-obj--alive\.subj-obj--lit \.subj-obj__float \{ animation-iteration-count: infinite, 1, 1; \}/);
  assert.doesNotMatch(home, /subj-obj-float 7\.2s infinite/);
  // The phone story (hero-depth.css) obeys the same rule, and the lit object is the one Statement passes `lit`.
  const depth = strip(read('src/app/hero-depth.css'));
  assert.doesNotMatch(depth, /subj-obj-float 7\.2s infinite/);
  assert.match(depth, /\.subj-obj--alive\.subj-obj--lit \.subj-obj__float \{ animation-iteration-count: infinite; \}/);
  assert.match(read('src/components/landing/Statement.jsx'), /lit=\{i === 1\}/);
});

test('nothing else loops on the home page: the exam clock icon has no pulse, the guide reads twice and rests', () => {
  assert.doesNotMatch(strip(read('src/app/exam-screen.css')), /infinite/);
  assert.doesNotMatch(strip(read('src/app/brand-pip.css')), /pip-read [^;]*infinite/);
});

test('no overshoot easing on chrome (M3): the du unlock chip uses the app ease-out on the home and public pages', () => {
  const du = strip(read('src/components/du/du.css'));
  assert.match(du, /\.lp \.du-unlocks button \{ transition: border-color 0\.15s ease, transform 180ms cubic-bezier\(0\.23, 1, 0\.32, 1\); \}/);
});

test('the Night toggle has no glow and its stars animate opacity only (the sun-to-moon motion itself stays: D10)', () => {
  const theme = strip(read('src/app/marketing-theme.css'));
  const thumb = theme.slice(theme.indexOf('.mm-theme-toggle__thumb {'), theme.indexOf('.mm-theme-toggle:hover'));
  assert.doesNotMatch(thumb, /0 0 12px|0 0 0 3px/);
  assert.match(thumb, /transition: transform \.6s cubic-bezier\(\.34, 1\.4, \.5, 1\)/, 'the sun-to-moon travel keeps its spring');
  const star = theme.slice(theme.indexOf('.mm-theme-toggle__star {'), theme.indexOf('.mm-theme-toggle__star:nth-child(1) {'));
  assert.doesNotMatch(star, /transform|cubic-bezier/);
  assert.doesNotMatch(theme, /0 0 10px 1px rgb\(222 236 196/);
  assert.match(theme, /\.mm-theme-hint b \{ color: inherit;/);
});

test('the hero links are not hidden on phones by the landing sheets (decision 3: both stay on every width)', () => {
  assert.doesNotMatch(strip(read('src/app/landing.css')), /\.lp-hero__tool \{[^}]*display: none/);
  assert.doesNotMatch(strip(read('src/app/feature-tour.css')), /\.lp-hero__tool, \.lp-hero__exam-link \{ display: none; \}/);
});

test('Day never lays a volt slab on cream (C12, rewritten for R3-D1, LK101): a Day-only rule carries volt only as the small tick bubble with its olive rim', () => {
  for (const file of MINE) {
    const css = strip(read(file));
    for (const m of css.matchAll(/(html\[data-theme='light'\][^{]*)\{([^}]*)\}/g)) {
      const [, selector, rawBody] = m;
      const body = rawBody.replace(/--[\w-]+\s*:[^;]*;?/g, ''); // tokens are pinned by brand_r3_1105.test.mjs; declarations here
      if (!/d2f000|210, ?240, ?0|var\(--volt(?![\w-])/i.test(body)) continue;
      // The only Day volt: the tick (a ::after bubble, or the chip's own .du-chip__tick) carrying var(--tick-rim) and dark ink.
      assert.match(selector, /::after|\.du-chip__tick/, `${file}: ${selector.trim()} puts volt in a Day-only rule that is not the tick`);
      assert.match(body, /var\(--tick-rim\)/, `${file}: ${selector.trim()} the Day tick carries the olive rim`);
    }
  }
});

test('du.css keeps its app-shared rules untouched and calms the home and public pages through .lp overrides', () => {
  const du = strip(read('src/components/du/du.css'));
  assert.match(du, /\.du-cta \{[^}]*linear-gradient\(180deg, rgba\(210, 240, 0, 0\.08\), transparent 60%\)/, 'the app keeps its volt closing card (web_fixb_1019 G28)');
  for (const s of ['.lp .du-chip[aria-pressed="true"]', '.lp .du-cta', '.lp .du-preset', '.lp .du-unlocks button', '.lp .du-teaser__out', '.lp .du-verdict[data-tone="good"]']) {
    assert.ok(du.includes(s), `${s} override exists`);
  }
  assert.match(du, /\.lp \.du-chip\[aria-pressed="true"\] \{ border-color: transparent; background: var\(--volt\); color: var\(--volt-ink\); \}/, 'a selected chip is a volt fill carrying dark ink');
});
