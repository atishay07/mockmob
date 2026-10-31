// The MockMob mark on every printed sheet (src/components/print): the footer line, the watermark's numbers, print-only CSS, and
// that all three sheets carry it. The PDFs themselves are proven by scripts/design-audit/keycards-1031-lk6-print.mjs.
//   node --test data/tests/print_mark.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MARK, printDate, printedLine } from '../../src/components/print/printLine.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('the date is "31 Oct 2026": day, three-letter month, year, never "Sept"', () => {
  assert.equal(printDate(new Date(2026, 9, 31)), '31 Oct 2026');
  assert.equal(printDate(new Date(2026, 8, 5)), '5 Sep 2026');
  assert.equal(printDate(new Date(2027, 0, 1)), '1 Jan 2027');
});

test('the footer names the student by first name, or says nothing of a name', () => {
  const date = new Date(2026, 9, 31);
  assert.equal(printedLine({ name: 'Riya Sharma', email: 'riya@example.com', date }), 'Printed for Riya from mockmob.in on 31 Oct 2026.');
  assert.equal(printedLine({ name: 'Anne-Marie', date }), 'Printed for Anne-Marie from mockmob.in on 31 Oct 2026.');
  // No name, a handle, or the email's own prefix is never printed as a name.
  assert.equal(printedLine({ name: '', date }), 'Printed from mockmob.in on 31 Oct 2026.');
  assert.equal(printedLine({ name: undefined, date }), 'Printed from mockmob.in on 31 Oct 2026.');
  assert.equal(printedLine({ name: 'asha_v07', date }), 'Printed from mockmob.in on 31 Oct 2026.');
  assert.equal(printedLine({ name: 'asha', email: 'asha@example.com', date }), 'Printed from mockmob.in on 31 Oct 2026.');
  assert.equal(printedLine({ date }), 'Printed from mockmob.in on 31 Oct 2026.');
});

test('the footer line has no middle dot, no dash and no markup, whatever the name holds', () => {
  const date = new Date(2026, 9, 31);
  for (const name of ['Riya', '<b>Riya</b> Sharma', 'Riya·Sharma', 'Ríya', 'आशा शर्मा', 'A'.repeat(80)]) {
    const line = printedLine({ name, date });
    assert.doesNotMatch(line, /[·—–<>]/, line);
    assert.match(line, /^Printed (for \S+ )?from mockmob\.in on 31 Oct 2026\.$/);
    assert.ok(line.length < 90);
  }
});

test('the watermark is the owner\'s: -28 degrees, 150 mm by 70 mm, 7 % black', () => {
  assert.equal(MARK.angle, -28);
  assert.equal(MARK.stepX, 150);
  assert.equal(MARK.stepY, 70);
  assert.equal(MARK.opacity, 0.07);
  assert.ok(MARK.width * 2 < MARK.stepX && MARK.width > 30, 'a mark big enough to read, small enough to leave the grid open');
});

test('the print CSS is print only: nothing shows on screen, the layer is fixed, exact colour, and takes no click', () => {
  const css = read('src/components/print/printSheet.css');
  const screen = css.slice(0, css.indexOf('@media print'));
  assert.match(screen, /\.pm, \.pm-head \{ display: none; \}/);
  assert.doesNotMatch(screen.replace(/\/\*[\s\S]*?\*\//g, ''), /position|opacity|background/, 'no on-screen styling beyond display none');
  const print = css.slice(css.indexOf('@media print'));
  assert.match(print, /\.pm__tiles \{[^}]*position: fixed;[^}]*inset: 0;[^}]*pointer-events: none;/);
  assert.match(print, /print-color-adjust: exact/);
  assert.match(print, /-webkit-print-color-adjust: exact/);
  assert.match(print, /\.pm__foot \{[^}]*position: fixed;[^}]*font: 400 8\.5pt/);
  assert.match(print, /\.pm-head svg \{[^}]*height: 14pt/);
  assert.match(print, /\.pm-sheet \{[^}]*box-decoration-break: clone/);
});

test('the three sheets carry the mark: Key cards chapter sheet, a lesson\'s Print a summary, the chapter summary', () => {
  const deck = read('src/components/keycards/ChapterDeck.jsx');
  assert.match(deck, /<section className=\{`kc-print pm-sheet [^`]*`\} aria-hidden="true">\s*<PrintMark \/>\s*<PrintHead \/>/);
  const lesson = read('src/components/study/LessonOverview.jsx');
  assert.match(lesson, /<section className="sx-print-only pm-sheet"><PrintMark \/><PrintHead \/>/);
  const summary = read('src/components/study/StudyChapterSummary.jsx');
  assert.match(summary, /<div className="sx sx-summary pm-sheet"><PrintMark \/><PrintHead \/>/);
  for (const src of [deck, lesson, summary]) assert.match(src, /from '@\/components\/print\/PrintMark'/);
});

test('the mark uses the real wordmark outlines and the signed-in first name, drawn without animation', () => {
  const src = read('src/components/print/PrintMark.jsx');
  assert.match(src, /LOGO_B_LETTERS/);
  assert.match(src, /useAuth\(\)/);
  assert.match(src, /beforeprint/);
  assert.doesNotMatch(src, /<LogoMark/, 'the animated site logo is not used on paper');
});
