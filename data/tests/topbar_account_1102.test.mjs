// node --test data/tests/topbar_account_1102.test.mjs
// LK42 (owner, 2 Nov 2026): "In the top bar where it shows Pro, and I think it's credits, wallet symbol, all that is very low-quality".
// The signed-in bar's account is one capsule with two doors: the balance in words (Wallet) and the person (Account), with "Pro"
// beside the person only when the plan is Pro. No coin glyph, no separate Pro badge, no Pro pitch for Free.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const shell = read('src/app/(app)/AppLayoutClient.jsx');
const css = read('src/app/(app)/arena.css');
const bar = shell.slice(shell.indexOf('<header className="arena-topbar">'), shell.indexOf('</header>'));

test('one capsule holds the balance and the person, in that order; no coin glyph or separate Pro badge in the bar', () => {
  assert.match(bar, /<div className="arena-acct" role="group" aria-label="Your account">[\s\S]*className="arena-acct__credits"[\s\S]*className="arena-acct__rule"[\s\S]*className="arena-acct__you"/);
  assert.doesNotMatch(bar, /CreditAmount|CreditMark|arena-chip--pro|arena-chip--credits/);
  assert.equal((bar.match(/<Avatar /g) || []).length, 1, 'one avatar for every width');
});

test('the balance says its unit in words and opens the Wallet; the person opens Account', () => {
  assert.match(bar, /<b>\{Number\(barCredits\)\.toLocaleString\('en-IN'\)\}<\/b><span>\{barCredits === 1 \? 'credit' : 'credits'\}<\/span>/);
  assert.match(bar, /href=\{previewLinks\?\.wallet \|\| '\/wallet'\} className="arena-acct__credits" data-tour="credits-pill"/, 'the tour still finds the balance');
  assert.match(bar, /aria-label=\{`\$\{creditsWords\(barCredits\)\}\. Open Wallet`\}/);
  assert.match(bar, /href=\{previewLinks\?\.profile \|\| '\/profile'\}\s*className="arena-acct__you"/);
  assert.match(bar, /aria-current=\{isActive\('profile'\) \? 'page' : undefined\}/);
});

test('Pro shows the word Pro beside the person; Free shows nothing extra', () => {
  assert.match(bar, /\{user\?\.isPremium \? <span className="arena-acct__plan">Pro<\/span> : null\}/);
  assert.match(bar, /aria-label=\{`Account, \$\{accountName \?\? 'your profile'\}\$\{user\?\.isPremium \? ', Pro' : ''\}`\}/);
  assert.doesNotMatch(bar, /Free<|Upgrade|Get Pro|\/pricing/);
});

test('the capsule is a 44 px target in both themes, tokens only, figures tabular and never monospace', () => {
  assert.match(css, /\.app-shell \.arena-acct \{[^}]*height: 44px;[^}]*border: 1px solid var\(--a-line\);[^}]*background: var\(--a-raised\);/);
  assert.match(css, /\.app-shell \.arena-acct__credits b \{[^}]*font-variant-numeric: tabular-nums;/);
  const block = css.slice(css.indexOf('.app-shell .arena-acct {'), css.indexOf("html[data-motion='reduced'] .app-shell .arena-acct > a"));
  assert.doesNotMatch(block, /font-mono|monospace|#[0-9a-f]{3,6}\b|box-shadow: 0 0 [1-9]/i, 'no mono costume, no literal colours, no halo');
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.app-shell \.arena-acct > a:hover/);
  assert.match(css, /\.app-shell \.arena-acct > a:focus-visible \{ outline: 2px solid var\(--a-focus\)/);
});
