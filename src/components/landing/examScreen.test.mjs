// node --test src/components/landing/examScreen.test.mjs
// LK72 (4 Nov 2026): the home page's exam section is a picture of the real runner (ExamScreen.jsx). D6 (LK91, LK92, 5 Nov 2026,
// the owner's decision, which supersedes the 4 Nov rules marked "D6" below): the screen sits in a desktop monitor drawn in CSS
// (ExamDevice.jsx, exam-device.css) with a browser address bar, scales with it as a whole (a phone sees the same desktop screen,
// smaller), the switch moves out of the screen beside the monitor, and NTA style is NTA's CBT screen as its guidelines describe
// it. R3-D6 (LK106, 5 Nov 2026, the owner's decision, which supersedes the D6 rule that a phone sees the desktop screen
// scaled): the monitor stays exactly as it is from 761 px, and below that a phone-native screen sits in a phone of the
// monitor's material (question 19 px, NTA style 18 px, options 16 px, nothing under 12 px, 44 px targets, the switch kept,
// the header's details and the palette in a drawer). R4-H6 (LK129, 6 Nov 2026, the owner's decision, which supersedes R3-D6:
// "Exam Day, you have degraded this a lot ... Revert back"): the phone sees the round-2 monitor, scaled, again, and a "Try it
// full screen" key under it opens the same screen in a full-screen dialog at a readable size, sideways like a monitor.
// R5 (owner, 6 Nov 2026, which supersedes R4-H6's sideways dialog: "Then, this full-screen mode on mobile: it should detect that
// it's mobile, and it should not make it horizontal"): the full-screen view draws the runner as it is on a phone, upright, in
// real pixels (TestPageClient.jsx and nta-classic.css below 1024 px), never turned and never locked; the inline monitor stays.
// Source-level: vocabulary, theme, labelled counters, the switch that keeps the answers and the timer, the monitor, NTA's
// anatomy, the full-screen view and the size budgets. The heights and the view's text sizes are measured in a browser
// (tmp/r5-feedback/exam/ in the web-polish worktree, and the opt-in test at the end of this file).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAM, EXAM_HEAD, wordCount } from './homeCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const JSX = read('ExamScreen.jsx');
const DEVICE_JSX = read('ExamDevice.jsx');
const CSS = read('../../app/exam-screen.css');
const DEVICE_CSS = read('../../app/exam-device.css');
const RUNNER = read('../../app/(app)/test/TestPageClient.jsx');
const NTA_WORDS = [/save & next/i, /mark for review & next/i, /clear response/i];
const strings = (value, out = []) => {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') out.push(String(value(3, 15)));
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
};
const MAIN = JSX.slice(0, JSX.indexOf('function NtaScreen('));
const NTA_SCREEN = JSX.slice(JSX.indexOf('function NtaScreen('));
// R4-H6: the screen is one const (`frame`) drawn in the monitor or in the full-screen dialog; the dialog and its CSS. R5: the
// monitor draws `frame`, the full-screen view draws `phone` (the runner on a phone; NTA style: PhoneNta), from the one state.
const FRAME = JSX.slice(JSX.indexOf('  const frame = ('), JSX.indexOf('  const switchKeys = ('));
const PHONE = JSX.slice(JSX.indexOf('  const phone = ('), JSX.indexOf('  const switchKeys = ('));
const PHONE_NTA = JSX.slice(JSX.indexOf('function PhoneNta('));
const DIALOG = JSX.slice(JSX.indexOf('{full ? createPortal('), JSX.indexOf('function NtaScreen('));
const FULL_CSS = CSS.slice(CSS.indexOf('full screen on phones (R4-H6'));

test('the MockMob interface never shows NTA vocabulary', () => {
  for (const text of strings(EXAM.mockmob)) for (const word of NTA_WORDS) assert.doesNotMatch(text, word, text);
  for (const text of [EXAM.attempt, EXAM.subject, EXAM.saved, EXAM.gate, EXAM.gateTitle, ...EXAM.questions.flatMap((q) => [q.text, ...q.options])]) {
    for (const word of NTA_WORDS) assert.doesNotMatch(text, word, text);
  }
  assert.doesNotMatch(strings(EXAM.mockmob.legend).join(' '), /for review/i, 'the five states carry the runner\'s own words in this interface');
  assert.doesNotMatch(EXAM.address.mockmob, /interface=nta/, 'the MockMob screen\'s address is a plain practice address');
});

test('the NTA words exist only in EXAM.nta, and only NtaScreen draws them (D6: NTA style is its own screen component)', () => {
  const nta = strings(EXAM.nta).join('\n');
  for (const word of NTA_WORDS) assert.match(nta, word);
  assert.match(nta, /Marked for Review/);
  // The component holds no literal NTA phrase: every NTA string is EXAM.nta.*.
  for (const word of NTA_WORDS) assert.doesNotMatch(JSX, word);
  // Outside NtaScreen, EXAM.nta is read only for the switch's label; NtaScreen renders only behind `nta ?`.
  const outside = MAIN.split('\n').filter((line) => /EXAM\.nta\.\w/.test(line));
  assert.deepEqual(outside.map((line) => (line.match(/EXAM\.nta\.\w+/g) || []).join(',')), ['EXAM.nta.interface'], 'only the switch label');
  assert.match(MAIN, /\{nta \? \(\s*<NtaScreen /, 'NtaScreen renders only in NTA style');
  assert.match(NTA_SCREEN, /const t = EXAM\.nta;/);
  for (const key of ['markNext', 'clearResponse', 'save', 'legend', 'paletteTitle', 'remaining', 'candidate', 'questionPaper', 'submit', 'hidePalette', 'showPalette']) {
    assert.match(NTA_SCREEN, new RegExp(`t\\.${key}\\b`), `NtaScreen draws EXAM.nta.${key}`);
  }
});

test('MockMob is the default interface, and the switch keeps the answers and the timer', () => {
  assert.match(JSX, /useState\('mockmob'\)/);
  assert.match(JSX, /aria-pressed=\{!nta\} onClick=\{\(\) => setMode\('mockmob'\)\}/);
  assert.match(JSX, /aria-pressed=\{nta\} onClick=\{\(\) => setMode\('nta'\)\}/);
  // Switching only sets `mode`: answers, marks, strikes, the position and the clock are separate state that setMode never touches.
  assert.doesNotMatch(JSX, /setMode\([^)]*\);[^\n]*(setAnswers|setClock|setMarked|setIndex)/);
  for (const state of ['answers', 'marked', 'visited', 'struck', 'index', 'clock']) assert.match(JSX, new RegExp(`\\[${state}, set\\w+\\] = useState`));
  assert.match(JSX, /aria-label=\{words\.switchLabel\}/, 'the group is named like the runner\'s own');
  // D6: the switch is the visitor's control, outside the screen and outside the monitor, at full size. R4-H6: the full-screen
  // dialog carries the same switch keys (switchKeys) over the same screen (frame): one state, so the answers and clock stay.
  const page = JSX.slice(JSX.indexOf('  return (\n    <section'));
  assert.ok(page.indexOf('className="xs-switch"') < page.indexOf('<ExamDevice ref={deviceRef}>'), 'the switch stands beside the device, not in the screen');
  assert.doesNotMatch(FRAME, /xs-switch|setMode|useState/, 'the screen draws the one state; it holds none of its own');
  assert.match(DIALOG, /<div className="xs-switch" role="group" aria-label=\{words\.switchLabel\}>\{switchKeys\}<\/div>/, 'the dialog has the same switch');
  assert.match(CSS, /\.xs-switch button \{[^}]*min-height: 44px/);
  assert.match(CSS, /\.xs-switch button\[aria-pressed='true'\] \{ background: var\(--ink\); color: var\(--paper\); \}/, 'the switch is in the page\'s own ink');
});

test('the MockMob skin follows the page theme; only the NTA skin has its own palette', () => {
  const marker = CSS.indexOf('NTA style: NTA');
  assert.ok(marker > 0);
  const mockmob = CSS.slice(0, marker).replace(/var\(--[\w-]+, ?[^)]*\)/g, 'var(--x)');
  assert.match(CSS, /--xs-bg: var\(--paper-raised\); --xs-surface: var\(--paper\);/);
  assert.match(CSS, /--xs-ink: var\(--ink\);/);
  assert.doesNotMatch(CSS, /prefers-color-scheme/, 'the theme is the site\'s own switch (data-theme), never the device');
  assert.doesNotMatch(DEVICE_CSS, /prefers-color-scheme/);
  const hex = [...new Set(mockmob.match(/#[0-9a-f]{3,8}\b/gi) || [])].map((h) => h.toLowerCase());
  // Volt (fill, ink on it, keycap edge) only; no dark or light hard-coded surface in the themed skin.
  for (const colour of hex) assert.ok(['#d2f000', '#0b1000', '#9db400'].includes(colour), `${colour} would not follow Night and Day`);
  assert.match(CSS, /\.xs-frame\[data-interface='nta'\] \{[\s\S]*?color-scheme: light;/, 'NTA\'s screen is light in both themes, like the runner\'s');
  // The browser bar belongs to the device: it follows the page theme in both skins (page tokens, never --xs-*).
  assert.match(CSS, /\.xs-browser \{[^}]*background: var\(--paper-raised-2/);
  assert.doesNotMatch(CSS.match(/\.xs-browser \{[^}]*\}/)[0], /--xs-/);
});

test('the counters and the legend name every state in words, and every chip is outlined, never colour alone', () => {
  assert.deepEqual(EXAM.mockmob.counters.map(([, label]) => label), ['Answered', 'Marked', 'Pending', 'Not visited']);
  assert.deepEqual(EXAM.mockmob.legend.map(([, label]) => label), ['Answered', 'Marked', 'Not answered', 'Not visited', 'Answered and marked']);
  assert.match(JSX, /<strong>\{counts\[key\]\}<\/strong><span>\{label\}<\/span>/);
  assert.match(JSX, /aria-label=\{`Question \$\{i \+ 1\}, \$\{names\.stateName\(state\)\}`\}/, 'a live chip is named by its state in words');
  assert.match(JSX, /stateName: \(state\) => state\.replace\('-', ' and '\)/, 'in MockMob, the runner\'s state words');
  assert.match(NTA_SCREEN, /stateName: \(state\) => name\[state\]/, 'in NTA style, NTA\'s legend words');
  assert.match(JSX, /<span className="xs-state" data-state=\{states\[index\]\}>\{chipWord\}<\/span>/);
  assert.match(CSS, /\.xs-chip \{[^}]*border: 1px solid var\(--xs-line-strong\)/, 'every chip has an outline');
  assert.match(CSS, /\.xs-chip\[data-state='visited'\][^{]*\{[^}]*border-style: dashed/, 'not answered is dashed, not only red');
  // The sample screen adds up: 6 + 2 + 7 = 15, and 6 are answered.
  const rest = EXAM.restStates;
  const liveAnswered = Object.keys(EXAM.start.answers).length;
  assert.equal(liveAnswered + rest.filter((s) => s === 'a').length, 6);
  const pending = 1 + rest.filter((s) => s === 'n').length; // question 3 (visited, unanswered) and the rest
  const notVisited = (EXAM.questions.length - EXAM.start.visited.length) + rest.filter((s) => s === 'x').length;
  assert.equal(6 + pending + notVisited, EXAM.total);
});

test('the MockMob anatomy is the runner\'s: saved note, header, chips, strike-out, Mark and Clear, Previous and Next, review, Submit', () => {
  // D6 retired the 4 Nov phone bar (xs-mobile) and palette sheet (xs-sheet); R4-H6 retired R3-D6's phone tree (xs-p-*).
  for (const piece of ['xs-saved', 'xs-header', 'xs-timer', 'xs-progress', 'xs-tags', 'xs-stem', 'xs-options', 'xs-note', 'xs-actions', 'xs-nav', 'xs-review', 'xs-counters', 'xs-grid', 'xs-legend', 'xs-submit']) {
    assert.match(JSX, new RegExp(`className="${piece}[" ]|className=\\{?[\`"']${piece}`), piece);
  }
  assert.doesNotMatch(JSX, /xs-mobile|xs-sheet/);
  assert.match(MAIN, /role="timer"/);
  assert.match(JSX, /LONG_PRESS_MS = 460/, 'the runner\'s own press-and-hold');
  assert.match(JSX, /event\.shiftKey && event\.key >= '1'/, 'Shift + 1 to 4 crosses an option out, as in the runner');
  assert.match(JSX, /<MascotSeat station="demo" pose="reading"/, 'Mobi reads the answer sheet beside the heading, never inside the paper');
  assert.doesNotMatch(FRAME + DIALOG, /Mascot/, 'no Mobi inside the frame or the full-screen dialog: no distractions in an exam');
  assert.equal(EXAM.questions.length, 5);
  for (const q of EXAM.questions) { assert.equal(q.options.length, 4); assert.ok(q.chapter && q.difficulty); }
});

test('NTA style is NTA\'s CBT screen as its guidelines describe it (D6, LK91)', () => {
  // Words, in NTA's own capitals (CUET (UG) 2025 Information Bulletin, Appendix V).
  assert.equal(EXAM.nta.save, 'Save & Next');
  assert.equal(EXAM.nta.markNext, 'Mark for Review & Next');
  assert.equal(EXAM.nta.clearResponse, 'Clear Response');
  assert.equal(EXAM.nta.paletteTitle, 'Question Palette');
  assert.deepEqual(EXAM.nta.legend.map(([, label]) => label), ['Not Visited', 'Not Answered', 'Answered', 'Marked for Review', 'Answered & Marked for Review (will be considered for evaluation)']);
  // Layout: the timer and the profile image top right with the Question Paper icon; the section on the top bar; the palette on
  // the right with the section summary (a count in each symbol) above it and the > arrow at its left that folds it.
  for (const piece of ['xs-n-head', 'xs-n-tools', 'xs-n-paper', 'xs-n-cand', 'xs-n-photo', 'xs-n-sections', 'xs-n-tab', 'xs-n-qhead', 'xs-n-down', 'xs-n-options', 'xs-n-radio', 'xs-n-keys', 'xs-n-fold', 'xs-n-palette', 'xs-n-legend', 'xs-n-sym', 'xs-n-section', 'xs-n-submit']) {
    assert.match(NTA_SCREEN, new RegExp(`className="${piece}[" ]`), piece);
  }
  assert.match(NTA_SCREEN, /role="timer"/);
  assert.ok(NTA_SCREEN.indexOf('xs-n-legend') < NTA_SCREEN.indexOf('{chipGrid('), 'the section summary sits above the palette');
  assert.match(NTA_SCREEN, /<span className="xs-n-sym" data-state=\{state\}>\{tally\[state\]\}<\/span>/, 'a count inside each symbol');
  assert.match(NTA_SCREEN, /aria-expanded=\{paletteOpen\}/, 'the fold is a real disclosure');
  assert.match(NTA_SCREEN, /answers\[index\] === option \? clearAnswer\(\) : choose\(option\)/, 'clicking the chosen option again clears it');
  assert.doesNotMatch(NTA_SCREEN, /startPress|toggleStrike|xs-letter/, 'NTA has no strike-out and no letter chips: numbered radio options');
  // The five symbols: NTA's section-summary shapes and its colours (sampled from its own legend), on a ::before so a clipped
  // shape never clips the focus ring.
  assert.match(CSS, /--nta-red: #e34501;[^}]*--nta-purple: #5a2ca4;/);
  assert.match(CSS, /\[data-state='visited'\]::before[^{]*\{[^}]*clip-path: polygon\(0 0, 100% 14%, 100% 86%, 0 100%\)/);
  assert.match(CSS, /\[data-state='answered'\]::before[^{]*\{[^}]*clip-path: polygon\(0 0, 100% 14%, 100% 86%, 0 100%\)/);
  assert.match(CSS, /\[data-state='marked-answered'\]\)::before[^{]*\{[^}]*border-radius: 50%/);
  assert.match(CSS, /\.xs-chip\[data-state='marked-answered'\]::after/, 'the green badge on answered and marked');
});

test('the monitor: drawn in CSS, scaled as a whole, with the address bar showing where the screen lives (D6, LK91, LK92)', () => {
  for (const part of ['xs-device', 'xs-monitor', 'xs-bezel', 'xs-glass', 'xs-neck', 'xs-foot']) assert.match(DEVICE_JSX, new RegExp(`className="${part}"`), part);
  assert.doesNotMatch(DEVICE_JSX + DEVICE_CSS, /<img|url\(|\.png|\.jpe?g|\.webp/i, 'no photo');
  assert.match(DEVICE_CSS, /\.xs-device \{[^}]*container: xs-device \/ inline-size;/);
  assert.match(DEVICE_CSS, /\.xs-glass \{[^}]*container: xs-glass \/ inline-size;[^}]*aspect-ratio: 16 \/ 10;/);
  assert.match(DEVICE_CSS, /html\[data-theme='light'\] \.xs-device \{/, 'Day by the site\'s switch; Night is the landing\'s default');
  // Every length of the screen is a design pixel of an 880-wide screen, so it scales with the glass.
  assert.match(CSS, /\.xs-frame \{\s*--u: calc\(100cqw \/ 880\);/);
  const sized = CSS.slice(CSS.indexOf('.xs-browser {'), CSS.indexOf('/* ---------------------------------------------------------------- the line under')) + CSS.slice(CSS.indexOf('NTA style: NTA'), CSS.indexOf('@keyframes xs-in'));
  assert.doesNotMatch(sized.replace(/\/\*[\s\S]*?\*\//g, ''), /(?:font-size|width|height|padding|gap|margin)[^;:]*:[^;]*\b(?:1[1-9]|[2-9]\d)px/, 'no fixed pixel sizes inside the screen');
  // The address: the runner's own route, with interface=nta in NTA style (the runner reads it).
  assert.match(JSX, /const address = nta \? EXAM\.address\.nta : EXAM\.address\.mockmob;/);
  assert.match(JSX, /<b>\{EXAM\.address\.host\}<\/b>\{address\}/);
  assert.equal(EXAM.address.host, 'mockmob.in');
  assert.match(EXAM.address.nta, /^\/test\?.*\binterface=nta\b/);
  assert.match(RUNNER, /searchParams\.get\('interface'\) === 'nta'/);
  assert.match(RUNNER, /searchParams\.get\('subject'\)/);
});

test('Literata 600 sets the MockMob stem, numbers are tabular Bricolage, no Geist Mono; NTA is Arial', () => {
  assert.match(CSS, /\.xs-stem \{[^}]*font: 600 calc\(18 \* var\(--u\)\)\/1\.32 var\(--font-stem/);
  assert.doesNotMatch(CSS, /geist|--font-mono|monospace/i);
  assert.match(CSS, /\.xs-timer \{[^}]*var\(--font-display\); font-variant-numeric: tabular-nums/);
  assert.match(CSS, /\.xs-nta \{[^}]*font-family: Arial, Helvetica, sans-serif;/);
  // D6: inside the monitor the targets are the runner's own sizes in design pixels, scaled with the monitor (the 44 px rule holds
  // for the switch, the visitor's control, and, from R3-D6, for every target on the phone below 761 px).
  assert.match(CSS, /\.xs-option \{[^}]*min-height: calc\(44 \* var\(--u\)\)/);
  assert.match(CSS, /\.xs-chip \{[^}]*min-height: calc\(36 \* var\(--u\)\)/);
});

test('motion is opacity and transform only, and Reduce motion keeps it still', () => {
  assert.doesNotMatch(CSS + DEVICE_CSS, /transition: (width|height|top|left|margin|all)/);
  assert.match(CSS, /@keyframes xs-in \{ from \{ opacity: 0; \} \}/, 'the switch cross-fades the screen');
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.xs-app, \.xs-nta \{ animation: none; \}/);
  assert.match(CSS, /:root\[data-motion='reduced'\] :is\(\.xs-app, \.xs-nta\) \{ animation: none; \}/);
  assert.match(JSX, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/, 'the demo clock stands still');
  assert.doesNotMatch(CSS + DEVICE_CSS, /infinite/, 'nothing loops');
});

test('the section is short: a head of at most 20 words, the size budgets are stated, and the old rules are not reused', () => {
  assert.ok(wordCount(EXAM_HEAD.sub) <= 20);
  // D6 made the section shorter than the 4 Nov budgets (930 at 390, 760 at 1440). R4-H6 brings D6's monitor back to phones
  // (R3-D6's phone was 1,031 px at 390) and adds the full-screen key under it.
  // R4-H1 widened the desktop column, so the monitor (unchanged in design) is larger at 1440: 799 px measured, under 839 px of
  // window below the site bar (801 px measured on 6 Nov).
  assert.match(CSS, /at most:\s+780 px of section at 360 and 390, 810 px at 1440/);
  assert.doesNotMatch(JSX, /lp-exam/, 'the old NTA clone\'s classes are gone from the new component');
  assert.match(JSX, /id="exam-experience"/, 'the hero link and the dashboard\'s preview link still land here');
  assert.match(JSX, /<section className="lp-sec xs" id="exam-experience" aria-labelledby="exam-title">/);
});

// Opt-in browser measure: EXAM_HEIGHT_URL=http://localhost:3592/ node --test src/components/landing/examScreen.test.mjs
// Section height at most 780 px at 360 and 390 and 810 px at 1440, in both interfaces and both themes; switching never moves it.
// On a phone (360, 390) the full-screen key is at least 44 px tall and opens the view (R5): upright (its stage is the window,
// never turned), the runner on a phone in real pixels (MockMob's stem 19 px and options 16 px, NTA style's 16 and 15.5 px),
// every key in it at least 44 px; the palette key raises the sheet and Escape lowers the sheet alone; Escape then closes the
// view and gives the focus back to the key; the answer stays in the monitor.
test('section height budgets and the full-screen view in a browser', { skip: !process.env.EXAM_HEIGHT_URL }, async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
  const browser = await chromium.launch(process.env.MM_CHROME ? { executablePath: process.env.MM_CHROME, headless: true } : { channel: 'chrome', headless: true });
  try {
    for (const [width, height, max] of [[360, 640, 780], [390, 844, 780], [1440, 900, 810]]) {
      for (const theme of ['dark', 'light']) {
        const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
        // 'load' and a short settle: a dev server's open socket can keep 'networkidle' from ever arriving.
        await page.goto(process.env.EXAM_HEIGHT_URL, { waitUntil: 'load', timeout: 120000 });
        await page.waitForTimeout(1500);
        await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
        const heights = [];
        for (const mode of [/^MockMob/, /NTA style/]) {
          await page.locator('#exam-experience .xs-switch').getByRole('button', { name: mode }).click();
          const h = await page.$eval('#exam-experience', (el) => Math.round(el.getBoundingClientRect().height));
          assert.ok(h <= max, `${width}px ${theme} ${mode}: section is ${h} px, budget ${max}`);
          heights.push(h);
        }
        assert.equal(heights[0], heights[1], `${width}px ${theme}: switching never changes the section's height`);
        if (width < 761) {
          const key = page.locator('#exam-experience .xs-full-open');
          const box = await key.boundingBox();
          assert.ok(box && box.height >= 44, `${width}px ${theme}: the full-screen key is ${box?.height} px tall`);
          await key.click();
          assert.equal(await page.locator('.xs-full:modal').count(), 1, 'the browser has opened a modal');
          const stage = await page.$eval('.xs-full__stage', (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: getComputedStyle(el).transform }; });
          assert.deepEqual(stage, { w: width, h: height, t: 'none' }, `${width}px ${theme}: the view is upright, the size of the window`);
          await page.locator('.xs-full .xs-switch').getByRole('button', { name: /^MockMob/ }).click();
          const answer = page.locator('.xs-full .xs-option').last();
          await answer.click();
          assert.equal(await answer.getAttribute('aria-pressed'), 'true');
          for (const mode of [/^MockMob/, /NTA style/]) {
            await page.locator('.xs-full .xs-switch').getByRole('button', { name: mode }).click();
            const seen = await page.$eval('.xs-full', (dialog) => {
              const size = (sel) => { const el = dialog.querySelector(sel); return el ? parseFloat(getComputedStyle(el).fontSize) : 0; };
              const keys = [...dialog.querySelectorAll('.xs-phone button')].map((b) => b.getBoundingClientRect()).filter((r) => r.width && r.height);
              return { stem: size('.xs-stem, .xs-n-stem'), option: size('.xs-option, .xs-n-option'), smallest: Math.round(Math.min(...keys.map((r) => Math.min(r.width, r.height)))) };
            });
            const [stemMin, optionMin] = /NTA/.test(mode.source) ? [16, 15.5] : [19, 16];
            assert.ok(seen.stem >= stemMin, `${width}px ${theme} ${mode}: the view's stem is ${seen.stem} px`);
            assert.ok(seen.option >= optionMin, `${width}px ${theme} ${mode}: the view's options are ${seen.option} px`);
            assert.ok(seen.smallest >= 44, `${width}px ${theme} ${mode}: a key in the view is ${seen.smallest} px`);
          }
          // NTA style is current: its Question Palette key raises the sheet; Escape lowers the sheet and leaves the view.
          await page.locator('.xs-full .xs-ph-keys .xs-n-key').nth(2).click();
          assert.equal(await page.locator('.xs-full .xs-ph-sheet:modal').count(), 1, 'the palette sheet is up');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.xs-full .xs-ph-sheet:modal').count(), 0, 'Escape lowers the sheet');
          assert.equal(await page.locator('.xs-full:modal').count(), 1, 'and leaves the view open');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.xs-full').count(), 0, 'Escape closes the view');
          assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('xs-full-open')), true, 'the focus is back on the key');
          await page.locator('.xs-layout > .xs-switch').getByRole('button', { name: /^MockMob/ }).click();
          assert.equal(await page.locator('.xs-device .xs-option').last().getAttribute('aria-pressed'), 'true', 'the answer survives switching skins and returning to the monitor');
        }
        await page.close();
      }
    }
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------- R4-H6 (LK129, 6 Nov 2026): the monitor on phones again
test('R4-H6: the monitor is the one device at every width; round 3\'s drawn phone and its phone-native screen are gone', () => {
  assert.match(DEVICE_JSX, /export function ExamDevice\(\{ children, ref \}\)/);
  assert.match(DEVICE_JSX, /<div className="xs-device" ref=\{ref\}>\s*<div className="xs-monitor">\s*<div className="xs-bezel">\s*<div className="xs-glass">\{children\}<\/div>/);
  assert.doesNotMatch(DEVICE_JSX + DEVICE_CSS, /xs-phone/, 'no phone device');
  assert.doesNotMatch(JSX + CSS, /xs-frame--phone|xs-p-|xs-pn|setDrawer/, 'no R3-D6 phone screen and no drawer');
  // R5: a phone-native screen is drawn again, but only inside the full-screen view, never in the section (no drawn phone).
  assert.equal((JSX.match(/\{phone\}/g) || []).length, 1, 'the phone screen is drawn in one place');
  assert.ok(JSX.indexOf('{phone}') > JSX.indexOf('{full ? createPortal('), 'and that place is the full-screen view');
  assert.doesNotMatch(DEVICE_CSS, /\.xs-device > \.xs-monitor \{ display: none; \}/, 'the monitor shows at every width');
  // The monitor's own rules are D6's numbers, unchanged.
  assert.match(DEVICE_CSS, /\.xs-bezel \{[^}]*padding: 1\.3cqw 1\.3cqw 3cqw;[^}]*border-radius: 2cqw;/);
  assert.match(CSS, /\.xs-frame \{\s*--u: calc\(100cqw \/ 880\);/);
  // Kept from R3-D6: a phone's long press also fires the context menu, and the strike it made is not undone.
  assert.match(JSX, /const strikeFromMenu = \(event, option\) => \{ event\.preventDefault\(\); if \(pressStruck\.current\) \{ pressStruck\.current = false; return; \}/);
  assert.equal((JSX.match(/\{optionButtons\}/g) || []).length, 1, 'one set of options, drawn in one screen at a time');
});

test('R4-H6: below 761 px a "Try it full screen" key under the monitor, a 48 px secondary key, hidden from 761 px', () => {
  assert.equal(EXAM.full.open, 'Try it full screen');
  assert.match(JSX, /<button ref=\{fullOpener\} type="button" className="mm-btn mm-btn--secondary xs-full-open" aria-haspopup="dialog" aria-expanded=\{full\} onClick=\{openFull\}>/);
  assert.match(FULL_CSS, /\.xs-full-open \{ display: none; \}\s*@media \(max-width: 760px\) \{/);
  assert.match(FULL_CSS, /\.xs-layout > \.xs-full-open \{ grid-area: full; display: inline-flex;[^}]*min-height: 48px;/);
  assert.match(FULL_CSS, /grid-template-areas: 'head seat' 'sub sub' 'switch switch' 'device device' 'full full' 'gate gate';/, 'the key sits right under the monitor');
});

test('R4-H6, R5: the view is the same state and switch in a named modal; the focus goes in and back; one screen at a time', () => {
  // React bubbles a nested dialog's cancel (the palette sheet's Escape) to this one's onCancel: only the view's own closes it.
  assert.match(DIALOG, /<dialog className="xs-full" aria-label=\{EXAM\.full\.title\} onCancel=\{\(event\) => \{ if \(event\.target !== event\.currentTarget\) return; event\.preventDefault\(\); closeFull\(\); \}\} ref=\{fullBox\}>/);
  assert.match(JSX, /dialog\.showModal\(\)/, 'the browser makes the background inert and contains keyboard focus');
  assert.match(DIALOG, /<div ref=\{fullStage\} className="xs-full__stage">/);
  assert.match(DIALOG, /\{phone\}/, 'the view draws the runner on a phone');
  assert.doesNotMatch(DIALOG, /\{frame\}|xs-full__glass/, 'not the monitor\'s screen');
  assert.match(JSX, /\{full \? <div className="xs-frame xs-frame--away" aria-hidden="true" \/> : frame\}/, 'drawn in one place at a time: one timer, one set of live regions');
  assert.match(DIALOG, /<button ref=\{fullClose\} type="button" className="xs-full__close" aria-label=\{EXAM\.full\.close\} onClick=\{closeFull\}>/);
  assert.match(DIALOG, /<div className="xs-switch" role="group" aria-label=\{words\.switchLabel\}>\{switchKeys\}<\/div>/);
  assert.match(JSX, /fullClose\.current\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(JSX, /fullOpener\.current\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(JSX, /root\.style\.overflow = 'hidden';/, 'the page under the view holds still');
  assert.match(DIALOG, /<\/dialog>, document\.querySelector\('\.mm\.lp'\) \|\| document\.body\) : null\}/, 'on the page root, outside the contained section');
  assert.match(JSX, /data-running=\{started && \(onScreen \|\| full\)\}/, 'the clock runs while the view is open');
  for (const key of ['open', 'title', 'close']) assert.ok(EXAM.full[key], `EXAM.full.${key}`);
});

// ---------------------------------------------------------------- R5 (owner, 6 Nov 2026): full screen on a phone stays upright
// "Then, this full-screen mode on mobile: it should detect that it's mobile, and it should not make it horizontal." It replaces
// R4-H6's monitor screen turned a quarter (and its landscape lock): the view draws the runner as it is on a phone, in real pixels.
test('R5: the view is never turned and never locked to landscape; where the browser allows, its stage goes full screen upright', () => {
  assert.doesNotMatch(JSX, /orientation\??\.lock|screen\??\.orientation/, 'no orientation lock');
  assert.doesNotMatch(CSS, /rotate\(90deg\)|orientation: portrait/, 'nothing is drawn sideways for an upright phone');
  assert.doesNotMatch(JSX + CSS, /xs-full__turn|xs-full__glass|xs-full__fit|EXAM\.full\.turn/, 'no "turn your phone" line and no monitor glass in the view');
  assert.equal(EXAM.full.turn, undefined);
  for (const text of strings(EXAM.full)) assert.doesNotMatch(text, /sideways|landscape|\bturn/i, text);
  // Full screen is asked for the view's stage, for a coarse pointer only: not the page (a page made full screen after the view
  // opened is drawn over it) and not the <dialog> (the Fullscreen API refuses one).
  assert.match(JSX, /stage\.requestFullscreen\(\{ navigationUI: 'hide' \}\)\.then/);
  assert.match(JSX, /window\.matchMedia\('\(pointer: coarse\)'\)\.matches/);
  assert.doesNotMatch(JSX, /(documentElement|root|dialog)\.requestFullscreen/);
  assert.match(FULL_CSS, /\.xs-full__stage \{[^}]*background: inherit; \}/, 'drawn in its own layer when full screen, the stage carries the view\'s ground');
});

test('R5: the view is the runner on a phone: MockMob\'s header, paper, phone bar and palette sheet; NTA style\'s own phone screen', () => {
  assert.match(PHONE, /<div className="xs-frame xs-phone" data-interface=\{mode\}>/);
  assert.match(PHONE, /\{nta \? \(\s*<PhoneNta /, 'NTA style draws its own phone screen');
  assert.doesNotMatch(PHONE, /xs-switch|setMode|useState|xs-exit/, 'the one state, no switch of its own; the view\'s close key is the way out');
  // MockMob, in the runner's order: the saved note, the header (the attempt and subject, where you are, the timer), the paper,
  // the phone bar, the palette sheet.
  let at = -1;
  for (const piece of ['xs-saved', 'xs-ph-head', '{progress}', '{timer}', 'xs-ph-paper', '{paper}', 'xs-ph-bar', 'xs-ph-sheet', '{review}']) {
    const i = PHONE.indexOf(piece, at + 1);
    assert.ok(i > at, `${piece} comes next`);
    at = i;
  }
  assert.match(PHONE, /\{words\.prev\}[\s\S]*\{words\.palette\}[\s\S]*\{words\.next\}/, 'Prev, Palette, Next');
  assert.match(PHONE, /aria-haspopup="dialog" aria-expanded=\{sheet\} aria-label=\{words\.paletteKey\(answered, EXAM\.total\)\}/);
  assert.match(PHONE, /<dialog ref=\{sheetBox\} className="xs-ph-sheet" aria-label=\{words\.paletteSheet\}/);
  assert.match(PHONE, /\{words\.answeredOf\(answered, EXAM\.total\)\}/);
  assert.match(PHONE, /aria-label=\{words\.closePalette\}/);
  // The paper and the review are the monitor's own parts: one state, one set of options, one set of chips.
  assert.equal((JSX.match(/\{paper\}/g) || []).length, 2, 'the paper, in the monitor or in the view');
  assert.equal((JSX.match(/\{review\}/g) || []).length, 2, 'the review, in the monitor\'s panel or in the view\'s sheet');
  // NTA style on a phone: the exam, the Question Paper icon and the Remaining Time; the section bar; the question with NTA's
  // arrows; the five keys in the runner's phone order; NTA's palette sheet. No candidate block, no photo, no strike-out.
  for (const piece of ['xs-n-head', 'xs-n-exam', 'xs-n-paper', 'xs-ph-time', 'xs-n-sections', 'xs-n-tab', 'xs-ph-pane', 'xs-n-qhead', 'xs-ph-arrow', 'xs-n-radio', 'xs-ph-keys', 'xs-ph-sheet', 'xs-n-legend', 'xs-n-section', 'xs-n-submit']) {
    assert.ok(PHONE_NTA.includes(`"${piece}`) || PHONE_NTA.includes(` ${piece}"`) || PHONE_NTA.includes(` ${piece} `), piece);
  }
  assert.match(PHONE_NTA, /\{EXAM\.mockmob\.previous\}[\s\S]*\{t\.clearResponse\}[\s\S]*\{t\.paletteTitle\}[\s\S]*\{t\.markNext\}[\s\S]*\{t\.save\}/, 'Previous, the clear key, the palette key, the mark key, the save key');
  assert.match(PHONE_NTA, /aria-label=\{t\.toEnd\}[\s\S]*aria-label=\{t\.toTop\}/, 'NTA\'s arrows take the question to its end and its top');
  assert.match(PHONE_NTA, /answers\[index\] === option \? clearAnswer\(\) : choose\(option\)/, 'clicking the chosen option again clears it');
  assert.doesNotMatch(PHONE_NTA, /startPress|toggleStrike|xs-letter|xs-n-cand|xs-n-photo/);
});

test('R5: phone sizes in real pixels: the question 19 px (NTA style 16 px), options 16 px (15.5 px), 44 px targets, nothing under 12 px', () => {
  assert.match(FULL_CSS, /\.xs-frame\.xs-phone \{ --u: 1px;/, 'one design pixel is one CSS pixel');
  assert.match(FULL_CSS, /\.xs-phone \.xs-stem \{[^}]*font-size: 19px;/);
  assert.match(FULL_CSS, /\.xs-phone \.xs-option \{[^}]*min-height: 52px;[^}]*font-size: 16px;/);
  assert.match(FULL_CSS, /\.xs-phone \.xs-n-stem \{[^}]*font-size: 16px;/);
  assert.match(FULL_CSS, /\.xs-phone \.xs-n-option \{[^}]*min-height: 48px;[^}]*font-size: 15\.5px;/);
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [selector, min] of [['.xs-phone .xs-text', 44], ['.xs-phone .xs-btn', 48], ['.xs-phone .xs-n-key', 44], ['.xs-ph-arrow', 44], ['.xs-ph-sheet .xs-chip', 44], ['.xs-ph-sheet__close', 44], ['.xs-full__close', 44]]) {
    const rule = FULL_CSS.match(new RegExp(`${escape(selector)} \\{[^}]*\\}`));
    assert.ok(rule, selector);
    const size = Number((rule[0].match(/(?:min-height|height): (\d+)px/) || [])[1]);
    assert.ok(size >= min, `${selector} is ${size} px`);
  }
  const sizes = [...FULL_CSS.matchAll(/font-size: (\d+(?:\.\d+)?)px|font: \d+ (\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1] || m[2]));
  assert.ok(sizes.length > 20 && Math.min(...sizes) >= 12, `the smallest text in the view is ${Math.min(...sizes)} px`);
  // The header and the keys stay put; the paper scrolls between them.
  assert.match(FULL_CSS, /\.xs-ph-paper \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/);
  assert.match(FULL_CSS, /\.xs-ph-pane \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/);
});

test('R5: Escape, the close key, the back gesture and leaving full screen close the view; the page keeps its place; the sheet lowers alone', () => {
  // One history entry of the view's own (with the router's state, so Next.js reads a step over it as the same page), taken
  // back on close unless the back gesture already took it.
  assert.match(JSX, /window\.history\.pushState\(\{ \.\.\.\(window\.history\.state \|\| \{\}\), xsFull: true \}, ''\)/);
  assert.match(JSX, /if \(window\.history\.state\?\.xsFull\) \{[\s\S]*?window\.history\.back\(\);/);
  assert.match(JSX, /window\.addEventListener\('popstate', back\)/, 'the back gesture closes the view');
  assert.match(JSX, /document\.addEventListener\('fullscreenchange', left\)/, 'leaving the browser\'s full screen closes the view');
  assert.match(JSX, /if \(document\.fullscreenElement\) document\.exitFullscreen\?\.\(\)/, 'closing gives the browser\'s full screen back');
  // The key goes back where it sat on screen (a phone turned while the view was open reflows the page under it).
  assert.match(JSX, /fullAnchor\.current = fullOpener\.current \? fullOpener\.current\.getBoundingClientRect\(\)\.top : null;/);
  assert.match(JSX, /keepPlace\(\); fullOpener\.current\?\.focus\(\{ preventScroll: true \}\);/);
  // The palette sheet is its own modal: Escape (or the phone's back as a close request) lowers it alone, the focus goes to its
  // close key and back to the palette key, and a chip goes to the question and lowers it, as the runner's sheet does.
  assert.match(JSX, /el\.addEventListener\('cancel', onCancel\);/);
  assert.match(JSX, /sheetClose\.current\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(JSX, /sheetOpener\.current\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(JSX, /onClick=\{\(\) => \{ go\(i\); setSheet\(false\); \}\}/);
});

test('R5: turned sideways while open, nothing is forced: a rail for the controls, one header row, the question beside its options', () => {
  const side = FULL_CSS.slice(FULL_CSS.indexOf('@media (orientation: landscape) and (max-height: 560px) {'));
  assert.ok(side.length < FULL_CSS.length, 'a rule for a short landscape window');
  assert.match(side, /\.xs-full__stage \{ flex-direction: row; \}/);
  assert.match(side, /\.xs-full__bar \{ flex-direction: column;/);
  assert.match(side, /\.xs-ph-head \{ grid-template-columns: auto minmax\(0, 1fr\) auto;/);
  assert.match(side, /\.xs-ph-paper > \.xs-options \{ grid-column: 2;/);
  assert.match(side, /\.xs-ph-keys \{ grid-template-columns: repeat\(5, minmax\(0, 1fr\)\); \}/);
});

test('R5: the view opens on opacity, the sheet rises on transform only, and Reduce motion stills both', () => {
  assert.match(FULL_CSS, /\.xs-full \{\s*position: fixed; inset: 0; z-index: 90;/);
  assert.match(FULL_CSS, /@keyframes xs-full-in \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/, 'it opens on opacity only');
  assert.match(FULL_CSS, /\.xs-ph-sheet\[open\] \{[^}]*animation: xs-ph-sheet-rise 280ms/);
  assert.match(FULL_CSS, /@keyframes xs-ph-sheet-rise \{ from \{ transform: translateY\(100%\); \} \}/);
  assert.match(FULL_CSS, /@media \(prefers-reduced-motion: reduce\) \{ \.xs-full \{ animation: none; \} \}/);
  assert.match(FULL_CSS, /@media \(prefers-reduced-motion: reduce\) \{ \.xs-ph-sheet\[open\], \.xs-ph-sheet::backdrop \{ animation: none; \}/);
  assert.match(FULL_CSS, /:root\[data-motion='reduced'\] \.xs-full \{ animation: none; \}/);
  assert.match(FULL_CSS, /:root\[data-motion='reduced'\] \.xs-ph-sheet\[open\], :root\[data-motion='reduced'\] \.xs-ph-sheet::backdrop \{ animation: none; \}/);
});
