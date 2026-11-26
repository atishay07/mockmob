// Owner, 25 Nov 2026 (LK434): on desktop "whenever clicking any rectangle button, the button jumps ... and then comes back".
// Two causes, measured on the live page on 26 Nov: a picked story step nudged the whole stage 10 px under the pointer, and
// a CUET-check stream tab moved 26 px when the paper's place shrank or the subject chips wrapped. These lock the fixes in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('a picked step (rail key, arrow) never nudges the stage', () => {
  const s = read('src/components/landing/storyController.mjs');
  assert.match(s, /if \(source !== 'touch' && source !== 'pick'\) nudge\(/);
  assert.doesNotMatch(s, /if \(source !== 'touch'\) nudge\(/);
});

test('the coverage place keeps one floor per window width, not per paper', () => {
  const s = read('src/components/landing/CoverageExplorer.jsx');
  assert.match(s, /const key = String\(window\.innerWidth\);/);
  assert.doesNotMatch(s, /\$\{subjectId\}\|\$\{window\.innerWidth\}/);
});

test('from 700 px the subject chips stay on one line and the paper name has its own line', () => {
  const css = read('src/components/landing/coverage-proof.css');
  assert.match(css, /\.lp-cq__subjects \{ flex-wrap: nowrap;/);
  assert.doesNotMatch(css, /\.lp-cq__subjects \{ flex-wrap: wrap;/);
  assert.match(css, /\.lp-cv__all b \{ display: block;[^}]*white-space: nowrap;/);
});
