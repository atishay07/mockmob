// What a brand-new account sees (ux-fresh audit, 15 Nov 2026): U5 to U11 and the preview's fresh-account fixtures (U14 to U17).
// Static checks over the sources, as the other web tests here do; the screens were walked at 390 Day and Night and 1440 Day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

test('U5: Marks trend for a fresh account: one line, the first-set key, no empty rules count, the record kept in the account', () => {
  const page = read('src/app/(app)/analytics/AnalyticsPageClient.jsx');
  assert.match(page, /totalAttempts === 0 \? 'No sessions yet\.'/);
  assert.match(page, /rules\.data\.book\.count > 0 \? <Link href="\/review\/rules"/);
  assert.doesNotMatch(page, /emptyAction=\{false\}/);
  const copy = JSON.parse(read('data/mistake_lab.copy.json'));
  assert.equal(copy.across.none, 'Across your mocks starts with your first Full or NTA mock. Your account keeps its record.');
});

test('U6: a link inside an empty state sentence stays inline, with a 44 px hit area from padding', () => {
  assert.match(read('src/components/recovery/overview.css'), /\.rv-empty p \.pr-link \{ display: inline; min-height: 0; padding: 13px 2px; margin: -13px -2px;/);
});

test('U7: the den pennant says New before its first week, never a big 0', () => {
  assert.match(read('src/components/mob/den/DenStage.jsx'), /weeks > 0 \? \([\s\S]*?\) : <span className="den-pennant__fig"[^>]*>New<\/span>/);
});

test('U8 and U9: Your papers states go side by side from 1024 px; Saved shows the compact room on a phone', () => {
  const css = read('src/components/review/review-1017.css');
  assert.match(css, /@media \(min-width: 1024px\) \{\n {2}\.app-shell \.rvw-state \{ grid-template-columns: minmax\(240px, 360px\) minmax\(0, 1fr\)/);
  assert.equal((read('src/components/review/ReviewPage.jsx').match(/className="rvw-state__copy"/g) || []).length, 2, 'the empty and the failed state');
  assert.match(read('src/app/(app)/saved/saved.css'), /\.sv-empty \.scene-room \{ flex: none; width: min\(100%, 225px\); \}/);
});

test('U10: Key cards with nothing due and nothing added offers the first chapter, outlined', () => {
  const home = read('src/components/keycards/KeycardsHome.jsx');
  assert.match(home, /firstChapter \? <Link className="kc-btn kc-btn--line kc-today__key" href=\{links\.deck\(firstChapter\.key\)\}>Open the chapter<\/Link>/);
});

test('U11: when every Today read failed, the page is one failure with one Try again that reads everything again', () => {
  const page = read('src/app/(app)/today/page.jsx');
  assert.match(page, /const allFailed = phase === 'failed' && \[data\.plan, data\.papers, data\.rhythm, data\.goal, data\.road, data\.revise, data\.facts, data\.repaired\]\.every\(\(r\) => r\.status === 'error'\);/);
  assert.match(page, /\{allFailed \? null : <div className="today-grid__side">/);
  assert.match(page, /setRetried\(true\); data\.retryAll\(\); setAgain\(\(n\) => n \+ 1\);/);
  const reads = read('src/components/today/useToday.js');
  for (const name of ['goal', 'road', 'revise', 'record']) assert.match(reads, new RegExp(`const ${name} = useRead\\([^\\n]*key: [^\\n]*all`), `${name} is read again on the page's Try again`);
});

test('U14 to U17: the preview answers a fresh account as production would', () => {
  const chip = read('src/app/preview/arena/previewChip.js');
  assert.match(chip, /wallet === 'fresh' \|\| \(!wallet && \(params\.get\('data'\) === 'empty' \|\| params\.get\('student'\) === 'new'\)\)/);
  assert.match(read('src/app/preview/arena/previewReferrals.js'), /if \(url\.pathname !== '\/api\/referrals' \|\| method !== 'GET'\) return null;/);
  const arena = read('src/app/preview/arena/ArenaPreviewClient.jsx');
  assert.match(arena, /const referred = previewReferrals\(url, method, fixture, json\);/);
  assert.doesNotMatch(arena, /kind === 'down' \|\| state === 'empty'\) return json\(\{ error: 'unavailable', message: 'Your traps/);
  assert.match(read('src/app/preview/arena/previewMob.js'), /if \(kind === 'none'\) return \{ mob: null, v3Available: true \};/);
});
