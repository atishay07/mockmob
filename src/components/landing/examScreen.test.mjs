// node --test src/components/landing/examScreen.test.mjs
// LK72 (4 Nov 2026): the home page's exam section is a picture of the real runner (ExamScreen.jsx). D6 (LK91, LK92, 5 Nov 2026,
// the owner's decision, which supersedes the 4 Nov rules marked "D6" below): the screen sits in a desktop monitor drawn in CSS
// (ExamDevice.jsx, exam-device.css) with a browser address bar, scales with it as a whole (a phone sees the same desktop screen,
// smaller), the switch moves out of the screen beside the monitor, and NTA style is NTA's CBT screen as its guidelines describe
// it. R3-D6 (LK106, 5 Nov 2026, the owner's decision, which supersedes the D6 rule that a phone sees the desktop screen
// scaled): the monitor stays exactly as it is from 761 px, and below that a phone-native screen sits in a phone of the
// monitor's material (question 19 px, NTA style 18 px, options 16 px, nothing under 12 px, 44 px targets, the switch kept,
// the header's details and the palette in a drawer). Source-level: vocabulary, theme, labelled counters, the switch that
// keeps the answers and the timer, the devices, NTA's anatomy, the phone and the size budgets. The heights, the text sizes
// and the targets are measured in a browser (tmp/r3/exam/shoot.mjs and walk.mjs, and the opt-in test at the end of this file).
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
// R3-D6: the phone's MockMob tree (in ExamScreen) and its NTA tree (PhoneNta, after NtaScreen), and the phone's CSS.
const PHONE = JSX.slice(JSX.indexOf('  const phone = ('), JSX.indexOf('  return (', JSX.indexOf('  const phone = (')));
const PHONE_NTA = JSX.slice(JSX.indexOf('function PhoneNta('));
const PHONE_CSS = CSS.slice(CSS.indexOf('the phone (R3-D6, LK106'));
const PHONE_DEVICE_CSS = DEVICE_CSS.slice(DEVICE_CSS.indexOf('the phone (R3-D6, LK106'));

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
  // D6: the switch is the visitor's control, outside the screen and outside the monitor, at full size. R3-D6: and outside the
  // phone; the monitor and the phone are two drawings of one state, so the switch, the answers and the clock are shared.
  assert.ok(JSX.indexOf('className="xs-switch"') < JSX.indexOf('<ExamDevice ref={deviceRef} phone={phone}>'), 'the switch stands beside the device, not in the screen');
  assert.doesNotMatch(PHONE + PHONE_NTA, /xs-switch|setMode|useState/, 'the phone draws the one state; it holds none of its own');
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
  // D6 retired the 4 Nov phone bar (xs-mobile) and palette sheet (xs-sheet); R3-D6 brings a phone screen back as its own tree
  // (xs-p-*, below), so the old names stay gone.
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
  // D6 made the section shorter than the 4 Nov budgets (930 at 390, 760 at 1440). R3-D6 trades the 4 px miniature for a
  // phone-native screen, which is taller at 390 (1,031 px measured 5 Nov); 1440 keeps D6's monitor and budget.
  assert.match(CSS, /at most: 1,060 px of section at 390 and 1,100 px\s+at 360 \(the phone, R3-D6\), 720 px at 1440/);
  assert.doesNotMatch(JSX, /lp-exam/, 'the old NTA clone\'s classes are gone from the new component');
  assert.match(JSX, /id="exam-experience"/, 'the hero link and the dashboard\'s preview link still land here');
  assert.match(JSX, /<section className="lp-sec xs" id="exam-experience" aria-labelledby="exam-title">/);
});

// Opt-in browser measure: EXAM_HEIGHT_URL=http://localhost:3523/ node --test src/components/landing/examScreen.test.mjs
// Section height at most 1,100 px at 360, 1,060 px at 390 and 720 px at 1440, in both interfaces and both themes; switching
// never moves it. On the phone (360, 390): no visible text under 12 px and no target under 44 px, in both interfaces.
test('section height budgets in a browser', { skip: !process.env.EXAM_HEIGHT_URL }, async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
  const browser = await chromium.launch(process.env.MM_CHROME ? { executablePath: process.env.MM_CHROME, headless: true } : { channel: 'chrome', headless: true });
  try {
    for (const [width, height, max] of [[360, 640, 1100], [390, 844, 1060], [1440, 900, 720]]) {
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
          if (width < 761) {
            const phone = await page.$eval('.xs-frame--phone', (scope) => {
              const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[inert], .lp-sr'); };
              const sizes = [];
              const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
              for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim() && shown(n.parentElement)) sizes.push(parseFloat(getComputedStyle(n.parentElement).fontSize));
              const small = [...scope.querySelectorAll('button')].filter((b) => shown(b) && b.tabIndex >= 0).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length;
              return { min: Math.min(...sizes), small };
            });
            assert.ok(phone.min >= 12, `${width}px ${theme} ${mode}: phone text at ${phone.min} px`);
            assert.equal(phone.small, 0, `${width}px ${theme} ${mode}: ${phone.small} phone targets under 44 px`);
          }
        }
        assert.equal(heights[0], heights[1], `${width}px ${theme}: switching never changes the section's height`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------- R3-D6 (LK106, 5 Nov 2026): the exam screen on phones
const px = (text, prop) => [...text.matchAll(new RegExp(`(?:^|[\\s{;])${prop}:\\s*([\\d.]+)px`, 'g'))].map((m) => Number(m[1]));
const rule = (text, selector) => { const at = text.indexOf(`${selector} {`); assert.ok(at >= 0, `${selector} has a rule`); return text.slice(at, text.indexOf('}', at) + 1); };

test('R3-D6: below 761 px a phone of the monitor\'s material holds the screen; from 761 px the monitor is exactly D6\'s', () => {
  // One device root; the monitor's markup is D6's, the phone is beside it, and CSS shows one of them.
  assert.match(DEVICE_JSX, /<div className="xs-device" ref=\{ref\}>\s*<div className="xs-monitor">\s*<div className="xs-bezel">\s*<div className="xs-glass">\{children\}<\/div>/);
  for (const part of ['xs-phone', 'xs-phone__body', 'xs-phone__keys', 'xs-phone__glass']) assert.match(DEVICE_JSX, new RegExp(`className="${part}"`), part);
  assert.match(PHONE_DEVICE_CSS, /\.xs-phone \{ display: none; \}\s*@media \(max-width: 760px\) \{\s*\.xs-device > \.xs-monitor \{ display: none; \}\s*\.xs-phone \{ display: grid;/, 'the phone below 761 px, the monitor from 761 px');
  // The monitor's own rules are untouched (D6's numbers), so desktop and tablet look exactly as approved.
  assert.match(DEVICE_CSS, /\.xs-bezel \{[^}]*padding: 1\.3cqw 1\.3cqw 3cqw;[^}]*border-radius: 2cqw;/);
  assert.match(DEVICE_CSS, /\.xs-glass \{[^}]*aspect-ratio: 16 \/ 10;/);
  assert.match(CSS, /\.xs-frame \{\s*--u: calc\(100cqw \/ 880\);/);
  // The monitor's material: its bezel colour and edge, its camera, its stand's aluminium as the rim and keys, its one shadow.
  const body = rule(PHONE_DEVICE_CSS, '.xs-phone__body');
  for (const token of ['--xs-bezel)', '--xs-bezel-edge)', '--xs-stand)', '--xs-shadow)']) assert.ok(body.includes(`var(${token}`), `the phone body uses ${token}`);
  assert.match(PHONE_DEVICE_CSS, /\.xs-phone__body::before \{[^}]*background: var\(--xs-camera\);/, 'the camera, centred in the top bezel like the monitor\'s');
  assert.match(PHONE_DEVICE_CSS, /\.xs-phone__keys \{[^}]*background: var\(--xs-stand\);/);
  assert.doesNotMatch(PHONE_DEVICE_CSS.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,8}\b|gradient|backdrop-filter/i, 'no new colour, no gradient, no glass: the monitor\'s tokens only');
  // One fixed glass height per width band: switching MockMob and NTA style never moves the page.
  assert.match(rule(PHONE_DEVICE_CSS, '.xs-phone__glass'), /height: \d+px;/);
  assert.match(PHONE_DEVICE_CSS, /@media \(max-width: 374px\) \{ \.xs-phone__glass \{ height: \d+px; \} \}/);
});

test('R3-D6: the phone screen is phone-native: question 19 px (NTA style 18 px), options 16 px, nothing under 12 px', () => {
  assert.match(PHONE_CSS, /\.xs-frame--phone \{ --u: 1px;/, 'one CSS pixel per design pixel: never a miniature');
  assert.match(rule(PHONE_CSS, '.xs-frame--phone .xs-stem'), /font-size: 19px;/);
  assert.match(rule(PHONE_CSS, '.xs-frame--phone .xs-n-stem'), /font-size: 18px;/);
  assert.match(rule(PHONE_CSS, '.xs-frame--phone .xs-option'), /font-size: 16px;/);
  assert.match(rule(PHONE_CSS, '.xs-frame--phone .xs-n-option'), /font-size: 16px;/);
  const sizes = [...px(PHONE_CSS, 'font-size'), ...[...PHONE_CSS.matchAll(/font: \d+ ([\d.]+)px/g)].map((m) => Number(m[1]))];
  assert.ok(sizes.length > 30);
  for (const size of sizes) assert.ok(size >= 12, `a ${size} px text on the phone`);
  // Every desktop size under 12 design px that a phone shows is set again on the phone (the legend, the counters, the state
  // chip, the read-back, NTA's legend, symbols and candidate block): the browser test measures the rest.
  for (const selector of ['.xs-frame--phone .xs-legend li', '.xs-frame--phone .xs-counters span', '.xs-frame--phone .xs-state', '.xs-frame--phone .xs-readback', '.xs-frame--phone .xs-n-legend li', '.xs-frame--phone .xs-n-sym', '.xs-frame--phone .xs-n-paper', '.xs-frame--phone .xs-saved', '.xs-frame--phone .xs-tags span']) {
    assert.match(rule(PHONE_CSS, selector), /font-size: 1[2-9]px;/, selector);
  }
});

test('R3-D6: every phone target is at least 44 px, as in the runner on a phone', () => {
  for (const [selector, prop] of [['.xs-frame--phone .xs-option', 'min-height'], ['.xs-frame--phone .xs-text', 'min-height'], ['.xs-frame--phone .xs-btn', 'min-height'], ['.xs-frame--phone .xs-chip', 'min-height'], ['.xs-frame--phone .xs-submit', 'min-height'], ['.xs-frame--phone .xs-exit', 'height'], ['.xs-frame--phone .xs-n-option', 'min-height'], ['.xs-frame--phone .xs-n-key', 'min-height'], ['.xs-frame--phone .xs-n-submit', 'min-height'], ['.xs-pn-close', 'height'], ['.xs-frame--phone[data-interface=\'nta\'] .xs-chip', 'min-height']]) {
    const [value] = px(rule(PHONE_CSS, selector), prop);
    assert.ok(value >= 44, `${selector} ${prop} ${value}`);
  }
  assert.match(rule(PHONE_CSS, '.xs-frame--phone .xs-exit'), /width: 44px;/);
  assert.match(rule(PHONE_CSS, '.xs-frame--phone .xs-chip:is([data-state=\'marked\'], [data-state=\'marked-answered\'])'), /width: 44px;/, 'the round marked chips are 44 px wide too');
});

test('R3-D6: the header\'s details and the palette collapse into a drawer; the runner\'s phone bar opens it', () => {
  // MockMob: the slim header keeps the exit, Question n of m and the clock; the drawer holds the attempt, the subject, the
  // answered count, the counters, the palette, the legend, Submit and its read-back.
  const top = PHONE.slice(PHONE.indexOf('className="xs-p-top"'), PHONE.indexOf('</header>'));
  for (const piece of ['xs-exit', 'words.questionOf(', 'role="timer"']) assert.ok(top.includes(piece), `the header keeps ${piece}`);
  assert.doesNotMatch(top, /EXAM\.attempt|EXAM\.subject|chipGrid/, 'the header\'s details are in the drawer');
  const sheet = PHONE.slice(PHONE.indexOf('className="xs-p-sheet"'));
  for (const piece of ['{EXAM.attempt}', '{EXAM.subject}', 'words.answered(answered)', 'className="xs-counters"', 'chipGrid(mockmobNames)', 'className="xs-legend"', 'className="xs-submit"', 'className="xs-readback" role="status"']) assert.ok(sheet.includes(piece), `the drawer holds ${piece}`);
  assert.match(PHONE, /<div className="xs-p-bar">\s*<button type="button" className="xs-btn" disabled=\{index === 0\} onClick=\{prev\}>\{words\.previous\}<\/button>\s*<button ref=\{drawerOpener\}[\s\S]*?aria-expanded=\{drawer\}[\s\S]*?>\{words\.review\}<\/button>\s*<button type="button" className="xs-btn xs-p-next"/, 'Previous, Review and Next, the runner\'s phone bar');
  // NTA style: NTA's header keeps the exam, the Question Paper and the Remaining Time; its candidate block, section summary,
  // section, palette and Submit are in NTA's palette sheet; its five keys sit one tap away.
  const ntaTop = PHONE_NTA.slice(PHONE_NTA.indexOf('xs-pn-head'), PHONE_NTA.indexOf('</header>'));
  for (const piece of ['t.exam', 't.questionPaper', 't.remaining', 'role="timer"']) assert.ok(ntaTop.includes(piece), `NTA's header keeps ${piece}`);
  assert.doesNotMatch(ntaTop, /t\.candidate|xs-n-photo/);
  const ntaSheet = PHONE_NTA.slice(PHONE_NTA.indexOf('xs-pn-sheet'));
  for (const piece of ['t.candidate', 'xs-n-photo', 'className="xs-n-legend"', '{tally[state]}', 'className="xs-n-section"', 'chipGrid(', 'className="xs-n-submit"']) assert.ok(ntaSheet.includes(piece), `NTA's sheet holds ${piece}`);
  const keys = PHONE_NTA.slice(PHONE_NTA.indexOf('className="xs-pn-keys"'), PHONE_NTA.indexOf('className="xs-p-drawer"'));
  assert.deepEqual([...keys.matchAll(/>\{([\w.]+)\}<\/button>/g)].map((m) => m[1]), ['EXAM.mockmob.previous', 't.clearResponse', 't.paletteTitle', 't.markNext', 't.save']);
  assert.doesNotMatch(PHONE_NTA, /startPress|toggleStrike|xs-letter/, 'NTA has no strike-out on the phone either');
  assert.match(PHONE_NTA, /answers\[index\] === option \? clearAnswer\(\) : choose\(option\)/, 'clicking the chosen option again clears it');
  // Both drawers: a named dialog, inert while shut, Escape closes it, the opener says whether it is open, a chip closes it
  // (as the runner's sheet does), and the focus moves in and back.
  for (const tree of [PHONE, PHONE_NTA]) {
    assert.match(tree, /className="xs-p-drawer" data-open=\{drawer\}/);
    assert.match(tree, /role="dialog" aria-label=\{[\w.]+\} inert=\{!drawer\} onKeyDown=\{drawerKey\}/);
    assert.match(tree, /<button type="button" className="xs-p-scrim" tabIndex=\{-1\} aria-hidden="true"/);
    assert.match(tree, /ref=\{drawerClose\}/);
  }
  assert.match(JSX, /const drawerKey = \(event\) => \{ if \(event\.key === 'Escape'\)/);
  assert.match(JSX, /onClick=\{\(\) => \{ go\(i\); setDrawer\(false\); \}\}/);
  assert.match(JSX, /if \(drawer\) drawerClose\.current\?\.focus\(\{ preventScroll: true \}\);\s*else if \(drawerWas\.current\) drawerOpener\.current\?\.focus\(\{ preventScroll: true \}\);/);
  // The drawer rises on transform only, and never animates while Reduce motion is on.
  assert.match(PHONE_CSS, /\.xs-p-sheet \{[^}]*transform: translateY\(104%\); visibility: hidden;/);
  assert.match(PHONE_CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.xs-p-sheet, \.xs-p-drawer\[data-open='true'\] \.xs-p-sheet \{ transition: visibility 0s; \}/);
});

test('R3-D6: one state, two drawings: the phone reuses the monitor\'s options, chips and handlers; the clock watches the device', () => {
  assert.equal((JSX.match(/\{optionButtons\}/g) || []).length, 2, 'the same option buttons on the monitor and the phone');
  assert.match(PHONE_NTA, /chipGrid\(\{ paletteTitle: t\.paletteTitle, stateName: \(state\) => name\[state\] \}\)/);
  assert.match(JSX, /<ExamDevice ref=\{deviceRef\} phone=\{phone\}>/);
  assert.match(JSX, /const node = deviceRef\.current;/, 'the clock runs while the device that shows is on screen');
  // A phone's long press also fires the context menu: the strike it made is not undone (the runner guards it too).
  assert.match(JSX, /const strikeFromMenu = \(event, option\) => \{ event\.preventDefault\(\); if \(pressStruck\.current\) \{ pressStruck\.current = false; return; \}/);
  assert.match(PHONE_CSS, /\.xs-frame--phone \.xs-option \{[^}]*-webkit-touch-callout: none;/);
  // The MockMob skin on the phone follows the page theme like the monitor's: only volt is a fixed colour.
  const mockmob = PHONE_CSS.slice(0, PHONE_CSS.indexOf('NTA style on the phone')).replace(/var\(--[\w-]+, ?[^)]*\)/g, 'var(--x)');
  for (const colour of new Set((mockmob.match(/#[0-9a-f]{3,8}\b/gi) || []).map((h) => h.toLowerCase()))) assert.ok(['#d2f000', '#0b1000', '#9db400'].includes(colour), `${colour} would not follow Night and Day`);
  assert.match(PHONE_CSS, /html\[data-theme='light'\] \.xs-p-scrim \{/, 'the dimmed paper is warm in Day');
});
