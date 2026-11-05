// The logged-in web's 5 Nov 2026 refinement (packet R2-C, docs/design-decisions/web-1105-appweb.md): each fix found by the
// layout scan and the screenshots at 360-1440 px is held here as the rule that fixed it, so a later edit cannot quietly undo it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('Practice: the mode tiles stay one to a row until 1440 px, so NTA mode\'s line never runs under "Needs Pro"', () => {
  const css = strip(read('src/app/(app)/dashboard/practice.css'));
  assert.match(css, /@media \(min-width: 1280px\) and \(max-width: 1439px\) \{\s*\.app-shell \.pr \.pr-tiles \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /\.pr-tile__kicker \{[^}]*text-wrap: balance;/, 'the kicker breaks evenly, never "exam / day"');
});

test('Learn feed: on the 600 px stage the bar fits (no "Turn over" over "Chapter")', () => {
  const css = strip(read('src/components/learn2/stage/stage.css'));
  const band = css.match(/@media \(min-width: 768px\) and \(max-width: 1359px\) \{([\s\S]*?)\n\}/);
  assert.ok(band, 'the 768-1359 band rule exists');
  assert.match(band[1], /\.st-bar:not\(\[data-wide\]\) \.st-prev \.kc-kbd \{ display: none; \}/);
  assert.match(band[1], /\.st-bar:not\(\[data-wide\]\) \.st-step\.kc-btn \{ min-width: 196px; \}/);
  assert.match(band[1], /\.st-bar:not\(\[data-wide\]\) \{ gap: 10px; \}/);
});

test('Your papers: in a right column under 400 px a saved repair\'s key goes under its words', () => {
  const css = strip(read('src/components/review/review-1018.css'));
  assert.match(css, /\.rv8-board > \.rv8-side \{ container: rv8side \/ inline-size; \}/);
  assert.match(css, /@container rv8side \(max-width: 399px\) \{[^@]*\.rv8-side \.rv8-sv__row \{ grid-template-columns: 40px minmax\(0, 1fr\); \}[^@]*\.rv8-act \{ grid-column: 2;/);
});

test('Wallet: the three packs share their rows, so prices and keys line up', () => {
  const css = strip(read('src/app/(app)/wallet/wallet.css'));
  assert.match(css, /\.wl-pack \{ grid-row: span 5; grid-template-rows: subgrid; row-gap: 6px; \}/);
});

test('figures sit under their labels: the marks ledger and the study record', () => {
  assert.match(strip(read('src/app/(app)/analytics/analytics.css')), /\.app-shell \.rd \.pp-ledger > div \{ align-content: start;/);
  assert.match(strip(read('src/components/study/study.css')), /\.study-facts \{ display: flex; align-items: center;/);
});

test('no Geist Mono as a costume: the balance, the MockMob test screen, its legend, Explore\'s option letters', () => {
  const arena = strip(read('src/app/(app)/arena.css'));
  assert.match(arena, /\.credit-amount__value \{ font-family: var\(--font-display\);[^}]*tabular-nums/);
  assert.match(arena, /\.app-shell \.nta-runner\[data-interface="mockmob"\] \{\s*--font-mono: var\(--font-display\);/);
  assert.doesNotMatch(arena, /\.nta-runner\[data-interface="nta"\][^{]*\{[^}]*--font-mono/, 'NTA\'s screen keeps its own type');
  const legend = strip(read('src/app/(app)/test/practice-run.css')).match(/\.pr-legend button \{[^}]*\}/)[0];
  assert.doesNotMatch(legend, /font-mono|10px/);
  assert.match(legend, /min-height: 44px/);
  const explore = strip(read('src/app/(app)/explore/explore.css'));
  assert.doesNotMatch(explore.match(/\.ex-option__key \{[^}]*\}/)[0], /font-mono/);
  assert.doesNotMatch(explore.match(/\.question-vote__score \{[^}]*\}/)[0], /font-mono/);
});

test('targets: the account doors and the card menu are 44 px', () => {
  assert.match(strip(read('src/app/(app)/arena.css')), /\.app-shell \.arena-acct > :is\(a, button\) \{ margin-block: -1px; \}/);
  assert.match(strip(read('src/components/keycards/keycards.css')), /\.kc-menu__btn \{[^}]*width: 44px; height: 44px;/);
});

test('even lines app-wide (D3 carried into the app), the NTA console excepted', () => {
  const arena = strip(read('src/app/(app)/arena.css'));
  assert.match(arena, /:where\(\.app-shell\) :where\(p, li, dd, figcaption\) \{ text-wrap: pretty; \}/);
  assert.match(arena, /:where\(\.app-shell\) :where\(h1, h2, h3, h4\) \{ text-wrap: balance; \}/);
  assert.match(arena, /:where\(\.app-shell \.nta-runner\[data-interface='nta'\]\) :where\([^)]*\) \{ text-wrap: wrap; \}/);
});

test('small words: Key cards counts are readable in Day, the rival line has no middle dot', () => {
  const cards = strip(read('src/components/learn2/cards/cards.css'));
  assert.match(cards, /\.l2c-chip \.l2c-n \{[^}]*color: var\(--a-ink-3\);/);
  assert.doesNotMatch(cards.match(/\.l2c-chip \.l2c-n \{[^}]*\}/)[0], /opacity: 0\.7/);
  const rival = read('src/components/ai/AIRivalArena.jsx');
  const wallet = rival.slice(rival.indexOf('<p className="rvl-wallet">'), rival.indexOf('</p>', rival.indexOf('<p className="rvl-wallet">')));
  assert.doesNotMatch(wallet, /·/);
});
