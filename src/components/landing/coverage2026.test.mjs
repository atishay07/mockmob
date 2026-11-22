// The CUET 2026 coverage teaser on the home page (owner, 22 Nov 2026; LK368), held to the data it comes from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COVERAGE_COPY, COVERAGE_PATH, COVERAGE_SUMMARY, TEASER_ROWS, coveragePct, coverageTeaser } from './coverage2026.mjs';

const read = (rel) => readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');
const exists = (rel) => existsSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)));

test('the teaser is the built summary, never a number typed here', () => {
  const summary = JSON.parse(read('data/coverage/cuet2026/public/summary.json'));
  assert.deepEqual(COVERAGE_SUMMARY.total, summary.total);
  const teaser = coverageTeaser();
  assert.deepEqual(teaser.total, { covered: summary.total.covered, of: summary.total.counted, pct: summary.total.pct });
  assert.equal(teaser.total.pct, coveragePct(summary.total.covered, summary.total.counted));
  assert.equal(teaser.subjects.length, Math.min(TEASER_ROWS, summary.subjects.length));
  assert.ok(TEASER_ROWS <= 6);
  for (const s of teaser.subjects) {
    const src = summary.subjects.find((x) => x.id === s.id);
    assert.deepEqual([s.covered, s.of, s.pct], [src.covered, src.counted, src.pct], s.id);
    assert.equal(s.href, `${COVERAGE_PATH}/${s.id}`);
  }
});

test("while no final file exists, the three subjects are still the README's own line", () => {
  const readme = read('data/coverage/cuet2026/README.md').replace(/\s+/g, ' ');
  const by = Object.fromEntries(COVERAGE_SUMMARY.subjects.map((s) => [s.id, s]));
  const rows = [['accountancy', 'Accountancy', '69\\.1'], ['economics', 'Economics', '71\\.1'], ['business-studies', 'Business Studies', '61\\.2']];
  for (const [id, name, p] of rows) {
    if (exists(`data/coverage/cuet2026/${id}-final.json`)) continue;
    assert.ok(by[id], `${id} is in the summary`);
    assert.match(readme, new RegExp(`${name} ${by[id].covered} of ${by[id].counted} \\(${p}%`));
  }
  if (COVERAGE_SUMMARY.subjects.length === 3 && rows.every(([id]) => !exists(`data/coverage/cuet2026/${id}-final.json`))) {
    assert.deepEqual([COVERAGE_SUMMARY.total.covered, COVERAGE_SUMMARY.total.counted, COVERAGE_SUMMARY.total.pct], [100, 149, 67]);
  }
});

test('the words say what was checked and never that MockMob predicted the paper', () => {
  const all = [COVERAGE_COPY.kicker, COVERAGE_COPY.h2, COVERAGE_COPY.totalLabel(149), COVERAGE_COPY.note, COVERAGE_COPY.row(1, 2), COVERAGE_COPY.key];
  for (const text of all) {
    assert.doesNotMatch(text, /[—!]|\p{Extended_Pictographic}/u, text);
    assert.doesNotMatch(text, /predict|guarantee|came from MockMob|leaked|same questions/i, text);
  }
  assert.equal(COVERAGE_COPY.h2, 'CUET 2026, checked question by question.');
  assert.equal(COVERAGE_COPY.key, 'See every question');
  assert.match(COVERAGE_COPY.note, /two separate checks/);
  assert.ok(COVERAGE_COPY.h2.includes(COVERAGE_COPY.mark));
});

test('the section is a still server component, placed right before pricing, with one key to the full pages', () => {
  const src = read('src/components/landing/CoverageProof.jsx');
  assert.doesNotMatch(src, /'use client'/);
  assert.match(src, /subjects\.map/);
  assert.match(src, /<section className="lp-sec lp-cov" id="cuet-2026"/);
  assert.match(src, /href=\{COVERAGE_PATH\} className="mm-btn mm-btn--primary"/);
  const css = read('src/components/landing/coverage-proof.css');
  assert.doesNotMatch(css, /animation|transition|position:\s*(fixed|sticky)/);
  const page = read('src/app/page.js');
  assert.match(page, /<Later><CoverageProof \/><\/Later>/);
  const at = page.indexOf('<Later><CoverageProof />');
  const pricing = page.indexOf('id="pricing"');
  assert.ok(at > 0 && pricing > at, 'the teaser comes before the pricing section');
  assert.doesNotMatch(page.slice(at + 30, page.lastIndexOf('<Later>', pricing)), /<Later>/, 'nothing between the teaser and pricing');
});
