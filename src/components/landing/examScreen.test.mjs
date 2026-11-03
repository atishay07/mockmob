// node --test src/components/landing/examScreen.test.mjs
// LK72 (4 Nov 2026): the home page's exam section is a picture of the real runner (ExamScreen.jsx), not an NTA clone. Source-level:
// vocabulary, theme, labelled counters, the switch that keeps the answers and the timer, and the size budgets. The height itself is
// measured in a browser (tmp/home-1104/build-p5/shoot-exam.mjs, and the opt-in test at the end of this file).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAM, EXAM_HEAD, wordCount } from './homeCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const JSX = read('ExamScreen.jsx');
const CSS = read('../../app/exam-screen.css');
const NTA_WORDS = [/save & next/i, /mark for review & next/i, /clear response/i];
const strings = (value, out = []) => {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') out.push(String(value(3, 15)));
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
};

test('the MockMob interface never shows NTA vocabulary', () => {
  for (const text of strings(EXAM.mockmob)) for (const word of NTA_WORDS) assert.doesNotMatch(text, word, text);
  for (const text of [EXAM.attempt, EXAM.subject, EXAM.saved, EXAM.gate, EXAM.gateTitle, ...EXAM.questions.flatMap((q) => [q.text, ...q.options])]) {
    for (const word of NTA_WORDS) assert.doesNotMatch(text, word, text);
  }
  assert.doesNotMatch(strings(EXAM.mockmob.legend).join(' '), /for review/i, 'the five states carry the runner\'s own words in this interface');
});

test('the NTA words exist only in the NTA-style branch', () => {
  const nta = strings(EXAM.nta).join('\n');
  for (const word of NTA_WORDS) assert.match(nta, word);
  assert.match(nta, /Marked for review/);
  // The component holds no literal NTA phrase: every NTA string is EXAM.nta.*, and each use sits behind `nta ?` (the switch label is the one exception).
  for (const word of NTA_WORDS) assert.doesNotMatch(JSX, word);
  const uses = JSX.split('\n').filter((line) => /EXAM\.nta\./.test(line) && !/EXAM\.nta\.interface/.test(line));
  assert.ok(uses.length >= 6, 'the NTA branch draws the three action words, the back and palette labels and the legend');
  for (const line of uses) assert.match(line, /nta \?/, line.trim());
});

test('MockMob is the default interface, and the switch keeps the answers and the timer', () => {
  assert.match(JSX, /useState\('mockmob'\)/);
  assert.match(JSX, /aria-pressed=\{!nta\} onClick=\{\(\) => setMode\('mockmob'\)\}/);
  assert.match(JSX, /aria-pressed=\{nta\} onClick=\{\(\) => setMode\('nta'\)\}/);
  // Switching only sets `mode`: answers, marks, strikes, the position and the clock are separate state that setMode never touches.
  assert.doesNotMatch(JSX, /setMode\([^)]*\);[^\n]*(setAnswers|setClock|setMarked|setIndex)/);
  for (const state of ['answers', 'marked', 'visited', 'struck', 'index', 'clock']) assert.match(JSX, new RegExp(`\\[${state}, set\\w+\\] = useState`));
  assert.match(JSX, /aria-label=\{words\.switchLabel\}/, 'the group is named like the runner\'s own');
});

test('the MockMob skin follows the page theme; only the NTA skin has its own palette', () => {
  const marker = CSS.indexOf('NTA style: NTA');
  assert.ok(marker > 0);
  const mockmob = CSS.slice(0, marker).replace(/var\(--[\w-]+, ?[^)]*\)/g, 'var(--x)');
  assert.match(CSS, /--xs-bg: var\(--paper-raised\); --xs-surface: var\(--paper\);/);
  assert.match(CSS, /--xs-ink: var\(--ink\);/);
  assert.doesNotMatch(CSS, /prefers-color-scheme/, 'the theme is the site\'s own switch (data-theme), never the device');
  const hex = [...new Set(mockmob.match(/#[0-9a-f]{3,8}\b/gi) || [])].map((h) => h.toLowerCase());
  // Volt (fill, ink on it, keycap edge) only; no dark or light hard-coded surface in the themed skin.
  for (const colour of hex) assert.ok(['#d2f000', '#0b1000', '#9db400'].includes(colour), `${colour} would not follow Night and Day`);
  assert.match(CSS, /\.xs-frame\[data-interface='nta'\] \{[\s\S]*?color-scheme: light;/, 'NTA\'s screen is light in both themes, like the runner\'s');
});

test('the counters and the legend name every state in words, and every chip is outlined, never colour alone', () => {
  assert.deepEqual(EXAM.mockmob.counters.map(([, label]) => label), ['Answered', 'Marked', 'Pending', 'Not visited']);
  assert.deepEqual(EXAM.mockmob.legend.map(([, label]) => label), ['Answered', 'Marked', 'Not answered', 'Not visited', 'Answered and marked']);
  assert.match(JSX, /<strong>\{counts\[key\]\}<\/strong><span>\{label\}<\/span>/);
  assert.match(JSX, /aria-label=\{`Question \$\{i \+ 1\}, \$\{state\.replace\('-', ' and '\)\}`\}/, 'a live chip is named by its state in words');
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

test('the anatomy is the runner\'s: saved note, header, chips, strike-out, Mark and Clear, Previous, Palette, Next, review, Submit', () => {
  for (const piece of ['xs-toolbar', 'xs-header', 'xs-timer', 'xs-progress', 'xs-tags', 'xs-stem', 'xs-options', 'xs-note', 'xs-actions', 'xs-review', 'xs-counters', 'xs-grid', 'xs-legend', 'xs-submit', 'xs-mobile', 'xs-sheet']) {
    assert.match(JSX, new RegExp(`className="${piece}[" ]|className=\\{?[\`"']${piece}`), piece);
  }
  assert.match(JSX, /role="timer"/);
  assert.match(JSX, /LONG_PRESS_MS = 460/, 'the runner\'s own press-and-hold');
  assert.match(JSX, /event\.shiftKey && event\.key >= '1'/, 'Shift + 1 to 4 crosses an option out, as in the runner');
  assert.match(JSX, /<MascotSeat station="demo" pose="reading"/, 'Mobi reads the answer sheet beside the heading, never inside the paper');
  assert.doesNotMatch(JSX.slice(JSX.indexOf('className="xs-frame"')), /Mascot/, 'no Mobi inside the frame: no distractions in an exam');
  assert.equal(EXAM.questions.length, 5);
  for (const q of EXAM.questions) { assert.equal(q.options.length, 4); assert.ok(q.chapter && q.difficulty); }
});

test('Literata 600 sets the stem, numbers are tabular Bricolage, no Geist Mono, and every target is at least 44 px', () => {
  assert.match(CSS, /\.xs-stem \{[^}]*font: 600 1\.125rem\/1\.32 var\(--font-stem/);
  assert.doesNotMatch(CSS, /geist|--font-mono|monospace/i);
  assert.match(CSS, /\.xs-timer \{[^}]*var\(--font-display\); font-variant-numeric: tabular-nums/);
  for (const selector of ['.xs-exit', '.xs-text', '.xs-switch button']) {
    const rule = CSS.match(new RegExp(`${selector.replace(/[.[\]]/g, '\\$&')} \\{[^}]*\\}`))?.[0] || '';
    assert.match(rule, /min-height: 44px|width: 44px; height: 44px/, `${selector} is a 44 px target`);
  }
  assert.match(CSS, /\.xs-chip \{[^}]*min-height: 44px/);
  assert.match(CSS, /\.xs-mobile button \{[^}]*min-height: 48px/);
});

test('motion is opacity and transform only, and Reduce motion keeps it still', () => {
  assert.doesNotMatch(CSS, /transition: (width|height|top|left|margin)/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.xs-sheet \{ animation: none; \}/);
  assert.match(CSS, /:root\[data-motion='reduced'\] \.xs-sheet \{ animation: none; \}/);
  assert.match(JSX, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/, 'the demo clock stands still');
  assert.doesNotMatch(CSS, /animation:[^;]*infinite;[^}]*\n[^@]*\.xs-(?!timer)/, 'only the running timer icon pulses');
});

test('the section is short: a head of at most 20 words, the size budgets are stated, and the old rules are not reused', () => {
  assert.ok(wordCount(EXAM_HEAD.sub) <= 20);
  assert.match(CSS, /at most 930 px of section at 390,\n?\s*760 px at 1440|930 px of section at 390/);
  assert.doesNotMatch(JSX, /lp-exam/, 'the old NTA clone\'s classes are gone from the new component');
  assert.match(JSX, /id="exam-experience"/, 'the hero link and the dashboard\'s preview link still land here');
  assert.match(JSX, /<section className="lp-sec xs" id="exam-experience" aria-labelledby="exam-title">/);
});

// Opt-in browser measure: EXAM_HEIGHT_URL=http://localhost:3467/ node --test src/components/landing/examScreen.test.mjs
// Section height at most 930 px at 390 and at most 760 px at 1440, in both interfaces and both themes.
test('section height budgets in a browser', { skip: !process.env.EXAM_HEIGHT_URL }, async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [width, height, max] of [[390, 844, 930], [1440, 900, 760]]) {
      for (const theme of ['dark', 'light']) {
        const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
        await page.goto(process.env.EXAM_HEIGHT_URL, { waitUntil: 'networkidle' });
        await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
        for (const mode of [/^MockMob/, /NTA style/]) {
          await page.getByRole('button', { name: mode }).first().click();
          const h = await page.$eval('#exam-experience', (el) => Math.round(el.getBoundingClientRect().height));
          assert.ok(h <= max, `${width}px ${theme} ${mode}: section is ${h} px, budget ${max}`);
        }
        await page.close();
      }
    }
  } finally { await browser.close(); }
});
