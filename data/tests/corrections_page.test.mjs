// /corrections (src/app/corrections): the site frame, its metadata and breadcrumb, the report path that really exists, one
// volt key, and the links to it from the footer, the About page and the sitemap. The log's data: corrections.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

test('/corrections: the site frame, its metadata and breadcrumb, the real report path, one volt key, and its links', () => {
  const page = read('src/app/corrections/page.js');
  assert.match(page, /<NavBar \/>/);
  assert.match(page, /<MarketingFooter \/>/);
  assert.match(page, /seoMetadata\(/);
  assert.match(page, /breadcrumbJsonLd\(/);
  assert.match(page, /loadCorrections\(/);
  assert.doesNotMatch(page, /supabase|fetch\(/, 'a visit never reads the database');
  const copy = read('src/app/corrections/correctionsCopy.mjs');
  assert.match(copy, /Report a problem with this question/, 'names the real control (src/components/result/reportModel.mjs)');
  assert.match(read('src/components/result/reportModel.mjs'), /rowOpen: 'Report a problem with this question'/);
  assert.match(copy, /three different students/, 'the threshold the server keeps (REPORT_POLICY.distinctReporters)');
  assert.doesNotMatch(copy, /!|24 hours|within a day|guarantee/i, 'no promise the code cannot keep');
  const way = read('src/app/corrections/CorrectionsWayIn.jsx');
  assert.equal((way.match(/mm-btn--primary/g) || []).length, 1, 'one volt key');
  assert.match(read('src/components/MarketingFooter.jsx'), /CORRECTIONS_LISTED \? \[\['Corrections', '\/corrections'\]\] : \[\]/);
  assert.match(read('src/app/about/page.js'), /href: '\/corrections'/);
  assert.match(read('src/app/sitemap.js'), /absoluteUrl\('\/corrections'\)/);
});

test('the log is unlisted until the owner says so: no footer, About or sitemap link, and not indexed; one switch lists it', () => {
  const flag = read('data/corrections_listed.mjs');
  assert.match(flag, /export const CORRECTIONS_LISTED = (true|false);/);
  assert.match(read('src/app/about/page.js'), /CORRECTIONS_LISTED \? \{ link: \{ href: '\/corrections'/);
  assert.match(read('src/app/sitemap.js'), /CORRECTIONS_LISTED \? \[corrections\] : \[\]/);
  assert.match(read('src/app/corrections/page.js'), /CORRECTIONS_LISTED \? LOG_METADATA : \{ \.\.\.LOG_METADATA, robots: \{ index: false, follow: false \} \}/);
});
