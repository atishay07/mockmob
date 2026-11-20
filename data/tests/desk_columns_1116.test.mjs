// Desk lane (16 Nov 2026): the result, Progress and the Wallet in two columns from 1100 px, with the left column staying in
// view (src/lib/stickySide.mjs). Below 1100 px every wrapper is `display: contents`, so phones and tablets keep the page they
// had: that was proven at 390 x 844 Day for 22 states, box for box (tmp/1116-tools/cmp_layout.py). These checks hold the
// pieces that make both true.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { observeSideHeight, SIDE_HEIGHT_VAR } from '../../src/lib/stickySide.mjs';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// The sticky top every left column uses: below the top bar while it fits, its foot in view when it is taller than the window.
const STICKY = /position: sticky;\s*top: min\(calc\(var\(--arena-topbar-h, 63px\) \+ 20px\), calc\(100dvh - var\(--side-h, 0px\) - 20px\)\);/;

test('observeSideHeight writes the column height into --side-h, follows changes and stops on cleanup', () => {
  const made = [];
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.on = new Set(); made.push(this); }
    observe(el) { this.on.add(el); }
    disconnect() { this.on.clear(); this.off = true; }
  };
  const props = {};
  const el = { offsetHeight: 812.4, style: { setProperty: (k, v) => { props[k] = v; } } };
  const cleanup = observeSideHeight(el);
  assert.equal(SIDE_HEIGHT_VAR, '--side-h');
  assert.equal(props['--side-h'], '813px', 'written at once, rounded up so the foot never sits a fraction under the edge');
  el.offsetHeight = 640;
  made[0].cb([]);
  assert.equal(props['--side-h'], '640px');
  assert.equal(typeof cleanup, 'function');
  cleanup();
  assert.equal(made[0].off, true);
  assert.equal(observeSideHeight(null), undefined, 'React calls a ref with null when the element goes');
  delete globalThis.ResizeObserver;
  assert.equal(observeSideHeight(el), undefined, 'no ResizeObserver: nothing is written and the CSS falls back to the plain sticky top');
});

test('result: the card is the left column from 1100 px; below it the right column is display: contents and the map copy is not drawn', () => {
  const css = read('src/components/result/result-desk.css');
  assert.match(css, /^\.rl-main \{ display: contents; \}$/m);
  assert.match(css, /^\.rl-map \{ display: none; \}$/m);
  const desk = css.slice(css.indexOf('@media (min-width: 1100px)'));
  assert.ok(desk.length > 100, 'the two columns live behind the Mob den breakpoint');
  assert.match(read('src/components/mob/mob.css'), /@media \(min-width: 1100px\)/, 'the same breakpoint as the den');
  assert.match(desk, /\.rx\.rl-split \{ grid-template-columns: minmax\(300px, 2fr\) minmax\(0, 3fr\);/);
  assert.match(desk, /\.rx\.rl-split > \.rh \{[^}]*align-self: start;/);
  assert.match(desk, STICKY);
  assert.match(desk, /\.rx\.rl-split > \.rh > :is\(\.rp-strip, \.rp-legend\) \{ display: none; \}/);
  assert.match(desk, /\.rx\.rl-split > \.rl-main > \.rl-map \{ display: grid;/);
  // The narrow card keeps the phone's forms: Mobi top right, counts two by two, the next move's terms under its key.
  assert.match(desk, /\.rx\.rl-split > \.rh \.rp-stats \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(desk, /\.rx\.rl-split > \.rh \.rx-next\[data-flat\] \{ grid-template-columns: minmax\(0, 1fr\); \}/);

  const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(page, /import '@\/components\/result\/result-desk\.css';/);
  assert.match(page, /className="container-narrow student-page student-page--result rp rx rl-page rl-split pb-20"/);
  assert.match(page, /sideRef=\{observeSideHeight\} \/>\n\n      <div className="rl-main">/, 'everything after the card is the right column');
  assert.match(page, /<div className="rl-map">\{answerMap\}\{legend\}<\/div>/);
  assert.ok(page.indexOf('<div className="rl-main">') < page.indexOf('<AnalysisParts parts'), 'the analysis is in the right column');
  assert.ok(page.lastIndexOf('</nav>\n      </div>\n    </div>') > page.indexOf('className="rp-links"'), 'the links close the right column');
  // One volt key in view: the right column adds none (the map's bubbles and the rows are quiet).
  assert.doesNotMatch(page.slice(page.indexOf('<div className="rl-map">'), page.indexOf('<div className="rl-map">') + 80), /btn-volt|data-page-primary/);

  const held = read('src/app/(app)/result/[id]/HeldResult.jsx');
  assert.match(held, /rl-page rl-split pb-20/);
  assert.match(held, /<ResultHero receipt=\{receipt\} marks=\{marks\} finding=\{finding\} reaction=\{reaction\} sideRef=\{observeSideHeight\} \/>\n      <div className="rl-main">/);
  assert.match(read('src/components/result/ResultHero.jsx'), /<header ref=\{sideRef\} className="rp-hero rh"/);
});

test('progress: the trend and the record on the left, the breakdown on the right; one column while the record is not read', () => {
  const css = read('src/app/(app)/progress/progress.css');
  assert.match(css, /\.app-shell \.student-page--progress \.pr-side,\n\.app-shell \.student-page--progress \.pr-main \{ display: contents; \}/);
  const desk = css.slice(css.indexOf('@media (min-width: 1100px)'));
  assert.match(desk, /\.student-page--progress:has\(\.pr-main:not\(:empty\)\) \{\s*display: grid; grid-template-columns: minmax\(300px, 2fr\) minmax\(0, 3fr\);/);
  assert.match(desk, STICKY);
  assert.match(desk, /:has\(\.pr-main:not\(:empty\)\) > \.rv-sec \{ grid-column: 2; grid-row: 4; \}/, 'Your standing closes the right column');
  // Lane arena-a (19 Nov 2026): the week band runs across both columns above them; the record is a ledger in the left column.
  assert.match(desk, /:has\(\.pr-main:not\(:empty\)\) > \.ov > :is\(\.pw, \.ui-state\) \{ grid-column: 1 \/ -1; grid-row: 2; \}/);
  assert.match(desk, /\.pr-side \.pw-record \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(desk, /\.pr-main \.sb-paths \{ grid-template-columns: minmax\(0, 1fr\); \}/);

  const overview = read('src/components/RecoveryOverview.jsx');
  const side = overview.indexOf('<div className="pr-side" ref={observeSideHeight}>');
  const main = overview.indexOf('<div className="pr-main">');
  assert.ok(side > overview.indexOf('<ArenaHead title="Your study days and checks."'), 'the header spans both columns');
  const band = overview.indexOf('<RhythmCard key={retryCount}');
  assert.ok(band > overview.indexOf('<ArenaHead title="Your study days and checks."') && band < side, 'the week band spans the page, above the columns');
  for (const piece of ['<FinishedWeeks rhythm={rhythm} />', '<ProgressMob />', 'aria-labelledby="ov-record"']) {
    const at = overview.indexOf(piece);
    assert.ok(at > side && at < main, `${piece} is in the left column`);
  }
  for (const piece of ['<StudyProgress />', '<StudyBadges key=', 'aria-labelledby="ov-checks"', 'aria-labelledby="ov-playbook"']) {
    assert.ok(overview.indexOf(piece) > main, `${piece} is in the right column`);
  }
});

test('wallet: what you hold on the left, how to get more and where it went on the right; buying is untouched', () => {
  const css = read('src/app/(app)/wallet/wallet.css');
  assert.match(css, /\.app-shell \.wl-side, \.app-shell \.wl-main \{ display: contents; \}/);
  const desk = css.slice(css.indexOf('@media (min-width: 1100px)'));
  assert.match(desk, /\.app-shell \.wl:has\(> \.wl-main\) \{ grid-template-columns: minmax\(300px, 2fr\) minmax\(0, 3fr\);/);
  assert.match(desk, STICKY);
  assert.match(desk, /\.wl-main \.wl-pack \{ grid-row: auto; grid-template-rows: none;/, 'the packs are rows, not three cramped cards');
  // Lane arena-a (19 Nov 2026): what credits buy is four desk objects, two by two in the left column.
  assert.match(desk, /\.wl-side \.wl-buys \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);

  const page = read('src/app/(app)/wallet/WalletPageClient.jsx');
  const side = page.indexOf('<div className="wl-side" ref={observeSideHeight}>');
  const main = page.indexOf('<div className="wl-main">');
  assert.ok(side > 0 && main > side);
  for (const piece of ['className="wl-hero" data-state', 'className="wl-costs"']) assert.ok(page.indexOf(piece) > side && page.indexOf(piece) < main, piece);
  for (const piece of ['<InviteFriendCard id="wl-invite" />', 'className="wl-packs"', 'className="wl-pro"', 'className="wl-history"']) assert.ok(page.indexOf(piece) > main, piece);
  assert.equal((page.match(/startWalletPurchase\(/g) || []).length, 1, 'one purchase call, as before');
});

// The docked Ask Mobi panel is gone (20 Nov 2026: a floating window that never narrows the page, askMobiLauncher.test.mjs), so
// no desk rule waits on a dock attribute nothing writes. The rules keep a leading :root, the weight the old guard gave them, so
// they still win over the card's phone and desktop rules whatever order the sheets load in (proven on 21 Nov 2026 by a
// computed-style diff of every element at 1440, 1920 and 2560 on eight pages: 0 changed).
test('the desk columns no longer wait on the removed Ask Mobi dock, and keep their weight', () => {
  for (const file of ['src/components/result/result-desk.css', 'src/app/(app)/progress/progress.css', 'src/app/(app)/wallet/wallet.css']) {
    const css = read(file);
    assert.doesNotMatch(css, /data-mobi-form='dock'|data-mobi-dock/, file);
    const block = css.slice(css.indexOf('@media (min-width: 1100px)'));
    const desk = block.slice(0, block.indexOf('\n}\n'));
    const rules = desk.split('\n').filter((line) => /^\s{2}[.:]/.test(line));
    assert.ok(rules.length > 8, file);
    for (const line of rules) assert.match(line, /^\s{2}:root /, `${file}: ${line.trim().slice(0, 60)}`);
  }
  for (const file of ['src/components/today/today.css', 'src/components/profile/account.css', 'src/app/(app)/analytics/analytics.css',
    'src/components/streak/streak-line.css', 'src/app/(app)/leaderboard/leaderboard.css', 'src/app/(app)/admission-compass/compass.css']) {
    assert.doesNotMatch(read(file), /data-mobi-form='dock'|data-mobi-dock/, file);
  }
});
