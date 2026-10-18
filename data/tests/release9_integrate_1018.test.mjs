// Release 9 integration leftovers (part A): source-level checks. The browser walk is in tmp/r9-integrate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMistakeLab, LAB_COPY } from '../mistake_lab.js';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('the result page names its last link for what it opens: /analytics is "Marks trend", so the link says so', () => {
  const src = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(src, /<Link href="\/analytics"><AppIcon name="radar" size=\{16\} \/>See your marks trend<\/Link>/);
  assert.doesNotMatch(src, /Open weak chapters/);
  assert.match(read('src/lib/arenaNavigation.js'), /item\('analytics', 'Marks trend'/);
});

test('an answer key under re-check is said once on the result page: the notice under the score, not a second list or a ledger group', () => {
  const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.doesNotMatch(page, /KeyReviewLog/);
  assert.match(page, /is being re-checked/, 'the one notice stays');
  assert.doesNotMatch(page, /Answer keys we are re-checking/);
  assert.equal(LAB_COPY.groups.held.label, 'Not sorted');
  assert.doesNotMatch(JSON.stringify(LAB_COPY.groups.held), /re-check/i);
  assert.equal(typeof buildMistakeLab, 'function');
});

test('Practice says the price once: no price under the lede, no amount in the "charged after" note, and the card has no balance row', () => {
  const page = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.doesNotMatch(page, /PRACTICE_PRICE_TAIL/);
  assert.doesNotMatch(page, /data-balance/);
  assert.match(page, /<dt>Cost<\/dt><dd data-tone=\{costTone\}>\{costLabel\}<\/dd>/, "the card's own Cost line stays");
  assert.doesNotMatch(read('data/practice_quote.js'), /\$\{creditCost\} credits are charged only after/);
  assert.match(read('data/practice_quote.js'), /You are charged only after a complete set is built\./);
});
