// Release 6 verifier fixes (docs/brain: the independent verifier's report on the 18 Oct web release 6). Source-level checks
// that run without a browser; the browser walk of the same fixes is in tmp/fix-r6 (headless, Night and Day).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cutIndexLine, cutSentence, knownRecord, nearestSlot, replayView, spokenTime } from '../replay.js';
import { aiRenewsLine } from '../review_input.mjs';
import COPY from '../mistake_lab.copy.json' with { type: 'json' };

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
// The text of every at-rule block that opens with `head` (brace-matched), so a rule can be asked "which block holds you".
function blocks(css, head) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(head, from);
    if (at < 0) return out;
    let depth = 0;
    let i = css.indexOf('{', at);
    const start = i;
    for (; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') { depth -= 1; if (depth === 0) break; }
    }
    out.push(css.slice(start + 1, i));
    from = i;
  }
}

test('the docked Ask Mobi panel cannot squeeze the analysis: the side-by-side layout is a container query on the section, not the window', () => {
  const css = stripComments(read('src/components/result/result-parts.css'));
  assert.match(css, /\.ap\s*\{[^}]*container:\s*ap\s*\/\s*inline-size/, '.ap is the container');
  const inContainer = blocks(css, '@container ap (min-width: 880px)').join('\n');
  for (const piece of ['.ap-grid { display: grid', '.ap-indexwrap { position: sticky', '.ap-detail { margin-top: 0', '.ap .ap-all { display: none']) {
    assert.ok(inContainer.includes(piece), `${piece} sits in the container query`);
  }
  for (const media of blocks(css, '@media (min-width: 1024px)')) {
    assert.ok(!/\.ap-grid|\.ap-indexwrap|\.ap-detail|\.ap-all/.test(media), 'no window-width rule decides the analysis columns');
  }
  // The index (360) and the gap (44) leave the detail 476 px or more at the threshold.
  assert.ok(360 + 44 + 476 <= 880);
});

test('the docked panel cannot squeeze Review: its two columns are a container query on the page, not the window', () => {
  const css = stripComments(read('src/components/review/review-1018.css'));
  assert.match(css, /\.app-shell \.rvw\s*\{[^}]*container:\s*rvw\s*\/\s*inline-size/, '.rvw is the container');
  const inContainer = blocks(css, '@container rvw (min-width: 720px)').join('\n');
  for (const piece of ['.rv8-board { display: grid', '.rv8-board > .rv8-side { display: block', 'position: sticky']) {
    assert.ok(inContainer.includes(piece), `${piece} sits in the container query`);
  }
  for (const media of blocks(css, '@media (min-width: 1024px)')) {
    assert.ok(!/rv8-board|rv8-side/.test(media), 'no window-width rule decides the Review columns');
  }
});

test('the analysis scroll helper asks the layout, not the window, whether the detail sits beside the index', () => {
  const code = read('src/components/result/AnalysisParts.jsx');
  assert.ok(!/matchMedia\('\(min-width: 1024px\)'\)/.test(code), 'no 1024 px window query left in the part scroll');
  assert.match(code, /getComputedStyle\(g\)\.display === 'grid'/);
});

test('a URL that matches no route gets the themed not-found page, never the default white 404', () => {
  const root = read('src/app/not-found.js');
  assert.match(root, /export default function NotFound\(\)/);
  assert.match(root, /SiteNotFound/);
  const page = read('src/components/SiteNotFound.jsx');
  // The arena's own tokens (Night by default, Day when chosen) come from the shell scope and its two sheets.
  assert.match(page, /className="view app-shell snf"/);
  assert.match(page, /@\/app\/\(app\)\/arena\.css/);
  assert.match(page, /@\/app\/\(app\)\/student-pages\.css/);
  // The AppNotFound look: the same headline, an ArenaHead, the same primary action class.
  const inApp = read('src/app/(app)/not-found.js');
  const headline = inApp.match(/title="([^"]+)"/)[1];
  assert.ok(page.includes(`title="${headline}"`), 'the same headline as the signed-in not-found');
  assert.match(page, /<ArenaHead/);
  assert.match(page, /ui-state__action ui-state__action--primary/);
  // A way home that works for a signed-in student and for a visitor: "/" (the front page sends a student on to Today).
  assert.match(page, /<Link href="\/"/);
  assert.match(page, /<Logo \/>/);
  // It never blanks the page white: the ground is the arena's.
  const css = read('src/components/site-not-found.css');
  assert.match(css, /min-height:\s*100dvh/);
  assert.ok(!/background:\s*#fff|background:\s*white/i.test(css));
});

test('Time and changes never says there is no record of a paper whose total time and changed answers it already shows', () => {
  const noReplay = replayView(null, { total: 10 });
  assert.equal(noReplay.cut.reason, 'none');
  // The 10-question quick practice: 5m 03s, two answers changed, and no replay of the sitting.
  const known = knownRecord({ totalMs: 303000, changed: 2 });
  assert.deepEqual(known, { sec: 303, changed: 2 });
  const line = cutSentence(noReplay, { known });
  assert.equal(line, 'There is no replay of this paper to play back. It took 5m 03s. 2 answers changed. Every answer is in Answer by answer.');
  assert.ok(!/no record/i.test(line), 'the sentence does not claim there is no record');
  assert.equal(cutIndexLine(noReplay, { known }), '5m 03s. Nothing to replay.');
  assert.match(cutSentence(noReplay, { known: knownRecord({ totalMs: 303000, changed: 1 }) }), /1 answer changed\./);
  assert.ok(!/changed/.test(cutSentence(noReplay, { known: knownRecord({ totalMs: 303000, changed: 0 }) })), 'no changes, none claimed');
  // Only a paper that holds no time at all keeps the old words.
  assert.equal(knownRecord({ totalMs: 0, changed: 3 }), null);
  assert.equal(knownRecord({}), null);
  assert.equal(cutSentence(noReplay, { known: null }), COPY.replay.slots.cutNone);
  assert.equal(cutIndexLine(noReplay, { known: null }), 'No record. Nothing to replay.');
  // A replay that exists keeps its own clock and its own reasons.
  const short = { version: 1, rowSec: 600, durationSec: 58, recordSec: 58, total: 10, rows: [{ from: 0, to: 600, bars: [] }], opened: [], facts: [], chips: [] };
  const shortView = replayView(short, { total: 10 });
  assert.equal(shortView.cut.reason, 'short');
  assert.match(cutSentence(shortView, { known }), /^You submitted after 58 seconds/);
  assert.equal(cutIndexLine(shortView, { known }), '58 seconds. Nothing to replay.');
  assert.equal(cutIndexLine({ cut: null }, { known }), null);
  assert.equal(spokenTime(1), '1 second');
});

test('the Time part passes the paper\'s own record to the replay and to its index line', () => {
  assert.match(read('src/components/ScoreRecoveryLab.jsx'), /known=\{knownRecord\(\{ totalMs: analysis\.timing\?\.totalMs/);
  assert.match(read('src/app/(app)/result/[id]/ResultPageClient.jsx'), /replayCutLine\(lab\.replay \|\| null, analysis\.rows\.length, knownRecord\(/);
  assert.match(read('src/components/result/ReplaySlots.jsx'), /cutSentence\(view, \{ known \}\)/);
});

test('Progress reserves the week card\'s resting height while the week loads, so the next step does not jump', () => {
  const css = stripComments(read('src/app/(app)/student-pages.css'));
  const reserve = css.match(/\.app-shell \.rc--wait:not\(\.rc--compact\)\s*\{[^}]*min-height:\s*(\d+)px/);
  assert.ok(reserve, 'the full card has a reserved height');
  // The loaded card measured 270 to 357 px across its states and widths; the reserve sits inside that range.
  assert.ok(Number(reserve[1]) >= 270 && Number(reserve[1]) <= 357, `reserve ${reserve[1]} px`);
  const code = read('src/components/RhythmCard.jsx');
  assert.match(code, /rc__skeleton--head/);
  assert.match(code, /rc__skeleton--weeks/);
  // The compact Today card keeps its own slim wait.
  assert.match(code, /compact \? <span className="rc__skeleton"/);
});

test('replay slots: a 44 px hit area, and a press goes to the nearest slot even where the areas overlap', () => {
  const css = stripComments(read('src/components/result/replay-slots.css'));
  assert.match(css, /\.rs \.rs-q::after\s*\{[^}]*width:\s*max\(100%,\s*44px\)/);
  assert.match(css, /\.rs \.rs-q\s*\{\s*position:\s*relative/);
  assert.match(read('src/components/result/ReplaySlots.jsx'), /onClickCapture=\{pressSlot\}/);
  // Slots 14.5 px apart (50 questions on a 390 px phone): a press 6 px right of slot 3's centre is slot 3, 9 px right is slot 4.
  const centers = Array.from({ length: 25 }, (_, i) => 10 + i * 14.5);
  assert.equal(nearestSlot(centers, centers[3] + 6), 3);
  assert.equal(nearestSlot(centers, centers[3] + 9), 4);
  assert.equal(nearestSlot(centers, -30), 0, 'left of the row is the first slot');
  assert.equal(nearestSlot(centers, 999), 24, 'right of the row is the last slot');
  assert.equal(nearestSlot([], 5), -1);
});

test('the small links are 44 px targets without moving a line: badge names, Bests, Today\'s Why this?, Review\'s inline question', () => {
  const badges = stripComments(read('src/components/study-badges.css'));
  assert.match(badges, /\.sb-badge__open\s*\{[^}]*min-width:\s*44px;\s*padding:\s*12px 0;\s*margin-block:\s*-12px/);
  assert.match(read('src/components/StudyBadges.jsx'), /sb-link sb-link--tap" href=\{r\.href\}>Open that paper/);
  assert.match(stripComments(read('src/components/today/today.css')), /a\.tm__inline\s*\{\s*padding-block:\s*12px/);
  assert.match(stripComments(read('src/components/review/review-1018.css')), /\.rv8-inline\s*\{[^}]*display:\s*inline-block;[^}]*padding:\s*12px 0;\s*margin-block:\s*-12px/);
});

test('Review at 0 AI credits says when they renew, only where the server knows the day', () => {
  assert.equal(aiRenewsLine({ aiCredits: 0, aiRenews: '2026-11-01' }), 'They renew on 1 Nov.');
  assert.equal(aiRenewsLine({ aiCredits: 0, aiRenews: '2026-12-01' }), 'They renew on 1 Dec.');
  // No known day, a balance above 0, or an unknown balance (never read as 0): nothing is said.
  assert.equal(aiRenewsLine({ aiCredits: 0, aiRenews: null }), '');
  assert.equal(aiRenewsLine({ aiCredits: 3, aiRenews: '2026-11-01' }), '');
  assert.equal(aiRenewsLine({ aiCredits: null, aiRenews: '2026-11-01' }), '');
  assert.equal(aiRenewsLine(null), '');
  assert.equal(aiRenewsLine({ aiCredits: 0, aiRenews: 'soon' }), '');
  // The chapter's cost line and the answer sheet's repair line both use it; the Practise line (practice credits never renew) does not.
  assert.match(read('src/components/review/ReviewChapters.jsx'), /aiRenewsLine\(wallet\)/);
  assert.match(read('src/components/review/AnswerSheet.jsx'), /\{haveLine\(0\)\}\{aiRenewsLine\(wallet\)/);
  const practise = read('src/components/review/ReviewChapters.jsx').match(/function practiseLine[\s\S]*?\n\}\n/)[0];
  assert.ok(!/renew/.test(practise), 'practice credits do not renew, so their line never says they do');
});

test('inside the Ask panel volt is Mobi\'s mark alone: the Free chip and the Key text are ink 2, no lime token is used', () => {
  const css = stripComments(read('src/components/ai/ask-mobi.css'));
  assert.match(css, /\.amb-quote__key\s*\{\s*color:\s*var\(--a-ink-2\)/);
  assert.match(css, /\.amb-ask em\[data-price='free'\]\s*\{\s*color:\s*var\(--a-ink-2\)/);
  for (const token of ['--a-good-text', '--a-accent', '--a-select', '--a-volt', '--volt', '#d2f000', '#D2F000']) assert.ok(!css.includes(token), `${token} is not used in the panel`);
});
