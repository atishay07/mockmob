// The signed-in web's left-overs, 10 Nov 2026 (the app refine pass; notes in tmp/1110-app/notes-leftovers.md): seven small faults
// an earlier walk at 390 px found, each held here as the rule that fixed it, so a later edit cannot quietly bring it back.
// Source-level and pure: no server is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const block = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} has a rule`);
  return css.slice(at, css.indexOf('}', at) + 1);
};

test('Rival: under 900 px the Start key also stands under the heading, on the first screen', () => {
  const page = read('src/components/ai/AIRivalArena.jsx');
  const top = page.indexOf('<div className="rvl-go rvl-go--top">');
  assert.ok(top > 0 && top < page.indexOf('<section className="rvl-pick"'), 'the start row comes before the list of rivals');
  const row = page.slice(top, page.indexOf('<section className="rvl-pick"'));
  assert.match(row, /startKey\(\{ 'data-phone-primary': '' \}\)/, 'a phone-only key never quiets the sidebar');
  assert.match(row, /<span>\{questionCount\} questions<\/span>/, 'it says what it will start with');
  assert.doesNotMatch(row, /·/, 'two facts set apart by space, no middle dot to dangle');
  // Nothing was removed: the key that closes the set-up is still there, and is still the page's own.
  assert.match(page.slice(page.indexOf('<section className="rvl-setup"')), /startKey\(\{ 'data-page-primary': '' \}\)/);
  const css = strip(read('src/components/ai/rival-reveal.css'));
  assert.match(css, /@media \(min-width: 900px\) \{ \.rvl-go--top \{ display: none; \} \}/, 'from 900 px the rows are one line each and the one key is enough');
});

test('Chapter summary: no leading full stop when there is no subject', () => {
  const page = read('src/components/study/StudyChapterSummary.jsx');
  assert.match(page, /\{name \? `\$\{name\}\. ` : ''\}Published lessons in one place\./);
  assert.doesNotMatch(page, /\{subjectName\(subject\)\}\. Published/);
  assert.match(page, /href=\{subject \? `\/learn\?subject=\$\{subject\}` : '\/learn'\}/, 'and no back link to an empty subject');
});

test('The Pro line (D79): one quiet line with a text link, no box, no rule down its side, no outlined key', () => {
  const css = strip(read('src/components/pro/pro-nudge.css'));
  assert.doesNotMatch(block(css, '.pn-inline'), /border|background/);
  const go = block(css, '.pn-inline-box .pn-inline .pn-inline__go');
  assert.match(go, /border: 0;/);
  assert.match(go, /background: transparent;/);
  assert.match(go, /text-decoration: underline;/);
  assert.match(go, /color: var\(--a-ink\);/, 'ink, never lime: the page keeps one lime key');
  assert.match(go, /min-height: 44px;/, '44 px to the finger');
  assert.match(go, /margin: -12px 0;/, 'and the line it sits in is no taller for it');
  assert.doesNotMatch(css, /@container pn-inline/, 'the action no longer drops to a row of its own');
  // The action is the end of the sentence itself.
  assert.match(read('src/components/pro/InlineNudge.jsx'), /<p className="pn-inline__text">\{copy\.text\}\{' '\}<button type="button" className="pn-inline__go" [^\n]*>\{copy\.action\}<\/button><\/p>/);
});

test('The first-visit note: no accent bar down its side, on every page that shows it, and still closable', () => {
  const css = strip(read('src/components/arena/first-time.css'));
  assert.doesNotMatch(block(css, '.app-shell .ft'), /border/);
  assert.match(block(css, '.app-shell .ft__x'), /width: 44px; height: 44px;/);
  assert.match(read('src/components/arena/FirstTime.jsx'), /aria-label="Close this note"/);
});

test('Contribute: the credits note has no volt bar, and Send for checking is the page\'s own key', () => {
  const css = strip(read('src/app/(app)/arena-support.css'));
  const note = block(css, '.app-shell .con-note');
  assert.doesNotMatch(note, /border-inline-start|border-left|--a-accent-text|--a-volt/);
  assert.match(note, /background: var\(--a-raised\);/);
  // The mark quiets the dock's and the sidebar's Start key while this lime key is in view (one lime per screen).
  assert.match(read('src/components/feed/UploadForm.jsx'), /<button type="submit" className="btn-volt lg" data-page-primary=""/);
});

test('Radar: one hairline above the row to Your papers, and one below it, never two with an empty band', () => {
  const css = strip(read('src/app/(app)/analytics/analytics.css'));
  assert.match(css, /\.app-shell \.rd \.pp-record > section\.pp-inreview \{ padding-top: 0; border-top: 0; \}/);
  assert.match(css, /\.app-shell \.rd \.pp-record > \.pp-inreview \+ \.pp-ledger \{ margin-top: -36px; border-top: 0; \}/);
  assert.match(css, /\.app-shell \.rd \.pp-record \{ gap: 36px; \}/, 'the ledger is pulled up by exactly the record\'s gap');
});

test('My uploads: the three counts are one even row at every width', () => {
  const css = strip(read('src/app/(app)/arena-support.css'));
  assert.match(css, /\.app-shell \.con-page \.pr-stats \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.app-shell \.con-page \.pr-stats > div \+ div \{ padding-left: 14px; border-left: 1px solid var\(--a-line\); \}/);
  assert.match(read('src/app/(app)/my-uploads/MyUploadsPageClient.jsx'), /<ArenaStats items=\{Object\.entries\(STATES\)/, 'three states, three counts');
});
