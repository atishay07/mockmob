// node --test src/components/landing/examScreen.test.mjs
// LK72 (4 Nov 2026): the home page's exam section is a picture of the real runner (ExamScreen.jsx). D6 (LK91, LK92, 5 Nov 2026,
// the owner's decision, which supersedes the 4 Nov rules marked "D6" below): the screen sits in a desktop monitor drawn in CSS
// (ExamDevice.jsx, exam-device.css) with a browser address bar, scales with it as a whole (a phone sees the same desktop screen,
// smaller), the switch moves out of the screen beside the monitor, and NTA style is NTA's CBT screen as its guidelines describe
// it. Source-level: vocabulary, theme, labelled counters, the switch that keeps the answers and the timer, the device, NTA's
// anatomy and the size budgets. The height itself is measured in a browser (tmp/night-1105/p3/shoot.mjs, and the opt-in test at
// the end of this file).
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
  // D6: the switch is the visitor's control, outside the screen and outside the monitor, at full size.
  assert.ok(JSX.indexOf('className="xs-switch"') < JSX.indexOf('<ExamDevice>'), 'the switch stands beside the monitor, not in the screen');
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
  // D6: the phone bar (xs-mobile) and the palette sheet (xs-sheet) retire: phones see the desktop screen, scaled.
  for (const piece of ['xs-saved', 'xs-header', 'xs-timer', 'xs-progress', 'xs-tags', 'xs-stem', 'xs-options', 'xs-note', 'xs-actions', 'xs-nav', 'xs-review', 'xs-counters', 'xs-grid', 'xs-legend', 'xs-submit']) {
    assert.match(JSX, new RegExp(`className="${piece}[" ]|className=\\{?[\`"']${piece}`), piece);
  }
  assert.doesNotMatch(JSX, /xs-mobile|xs-sheet/);
  assert.match(MAIN, /role="timer"/);
  assert.match(JSX, /LONG_PRESS_MS = 460/, 'the runner\'s own press-and-hold');
  assert.match(JSX, /event\.shiftKey && event\.key >= '1'/, 'Shift + 1 to 4 crosses an option out, as in the runner');
  assert.match(JSX, /<MascotSeat station="demo" pose="reading"/, 'Mobi reads the answer sheet beside the heading, never inside the paper');
  assert.doesNotMatch(JSX.slice(JSX.indexOf('className="xs-frame"')), /Mascot/, 'no Mobi inside the frame: no distractions in an exam');
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
  // D6: inside the screen the targets are the runner's own sizes in design pixels, scaled with the monitor (the 4 Nov 44 px rule
  // now holds for the switch, the visitor's control; a phone shows a miniature of the desktop screen).
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
  // D6: the monitor makes the section shorter than the 4 Nov budgets (930 at 390, 760 at 1440).
  assert.match(CSS, /at most: 700 px of section at 390, 720 px at 1440/);
  assert.doesNotMatch(JSX, /lp-exam/, 'the old NTA clone\'s classes are gone from the new component');
  assert.match(JSX, /id="exam-experience"/, 'the hero link and the dashboard\'s preview link still land here');
  assert.match(JSX, /<section className="lp-sec xs" id="exam-experience" aria-labelledby="exam-title">/);
});

// Opt-in browser measure: EXAM_HEIGHT_URL=http://localhost:3523/ node --test src/components/landing/examScreen.test.mjs
// Section height at most 700 px at 390 and at most 720 px at 1440, in both interfaces and both themes; switching never moves it.
test('section height budgets in a browser', { skip: !process.env.EXAM_HEIGHT_URL }, async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
  const browser = await chromium.launch(process.env.MM_CHROME ? { executablePath: process.env.MM_CHROME, headless: true } : { channel: 'chrome', headless: true });
  try {
    for (const [width, height, max] of [[390, 844, 700], [1440, 900, 720]]) {
      for (const theme of ['dark', 'light']) {
        const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
        await page.goto(process.env.EXAM_HEIGHT_URL, { waitUntil: 'networkidle' });
        await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
        const heights = [];
        for (const mode of [/^MockMob/, /NTA style/]) {
          await page.getByRole('button', { name: mode }).first().click();
          const h = await page.$eval('#exam-experience', (el) => Math.round(el.getBoundingClientRect().height));
          assert.ok(h <= max, `${width}px ${theme} ${mode}: section is ${h} px, budget ${max}`);
          heights.push(h);
        }
        assert.equal(heights[0], heights[1], `${width}px ${theme}: switching never changes the section's height`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
});
