// The CUET 2026 coverage figures on the home page (owner, 22 Nov 2026), held to the data they come from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COVERAGE_2026, COVERAGE_COPY, coveragePct, coverageTotal } from './coverage2026.mjs';

const read = (rel) => readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');

test('each subject\'s figure is the README\'s own final line', () => {
  const readme = read('data/coverage/cuet2026/README.md').replace(/\s+/g, ' ');
  const by = Object.fromEntries(COVERAGE_2026.subjects.map((s) => [s.id, s]));
  assert.match(readme, new RegExp(`Accountancy ${by.accountancy.covered} of ${by.accountancy.of} \\(69\\.1%\\)`));
  assert.match(readme, new RegExp(`Economics ${by.economics.covered} of ${by.economics.of} \\(71\\.1%`));
  assert.match(readme, new RegExp(`Business Studies ${by['business-studies'].covered} of ${by['business-studies'].of} \\(61\\.2%`));
  const total = coverageTotal();
  assert.match(readme, new RegExp(`All three: ${total.covered} of ${total.of} \\(67\\.1%\\)`));
  assert.deepEqual(total, { covered: 100, of: 149, pct: 67 });
  assert.deepEqual(COVERAGE_2026.subjects.map((s) => coveragePct(s.covered, s.of)), [69, 71, 61]);
});

test('the words say what was checked and never that MockMob predicted the paper', () => {
  const all = [COVERAGE_COPY.kicker, COVERAGE_COPY.h2, COVERAGE_COPY.sub, COVERAGE_COPY.totalLabel, COVERAGE_COPY.note, COVERAGE_COPY.row(1, 2)];
  for (const text of all) {
    assert.doesNotMatch(text, /[—!]|\p{Extended_Pictographic}/u, text);
    assert.doesNotMatch(text, /predict|guarantee|came from MockMob|leaked|same questions/i, text);
  }
  assert.match(COVERAGE_COPY.sub, /100 of 149/);
  assert.match(COVERAGE_COPY.note, /One 2026 shift for each subject/);
  assert.match(COVERAGE_COPY.note, /two separate checks/);
  assert.ok(COVERAGE_COPY.h2.includes(COVERAGE_COPY.mark));
});

test('the section is a still server component drawn from the data module', () => {
  const src = read('src/components/landing/CoverageProof.jsx');
  assert.doesNotMatch(src, /'use client'/);
  assert.match(src, /COVERAGE_2026\.subjects\.map/);
  assert.match(src, /<section className="lp-sec lp-cov" id="cuet-2026"/);
  const css = read('src/components/landing/coverage-proof.css');
  assert.doesNotMatch(css, /animation|transition|position:\s*(fixed|sticky)/);
  assert.match(read('src/app/page.js'), /<Later><CoverageProof \/><\/Later>/);
});
