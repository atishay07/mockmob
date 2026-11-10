// node --test src/components/learn2/home/__tests__/r7Webfull.test.mjs
// R7 W (LK59, LK62): Up next as one module (one move on the card, the others in its footer), the roadmap's rows saying state not advice,
// Find's sets on Learn home, the cover's "Suggested", and the preview's own links keeping Learn v2 (the prototype links rule).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { otherMoves, upNextMoves, MOVE_WHY } from '../homeModel.mjs';
import { leadLine } from '../../feed/coverModel.js';

const src = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const PICKUP = {
  mode: 'pickup', headline: 'Pick up Admission of a Partner', line: '6 of 16 done', progress: { done: 6, of: 16 },
  key: { label: 'Continue · 5 min', run: { chapterKey: 'a.b', minutes: 5, resume: 'r1' } },
  or: [
    { kind: 'revise', label: 'Revise 9 due cards · 2 min', run: { chapterKey: 'a.b', minutes: 2, kind: 'cards', cardIds: ['x'] } },
    { kind: 'fix', label: 'Fix 3 open mistakes · 3 min', line: 'Accounting for Partnership: Basic Concepts', run: { chapterKey: 'a.c', minutes: 3, fresh: true } },
    { kind: 'feed', label: 'never a third', href: '/explore/run?chapter=a.b&min=10', go: 'feed' },
  ],
};

test('Up next: the server offer leads, marked suggested; at most two other moves, in the server order', () => {
  const moves = upNextMoves(PICKUP);
  assert.deepEqual(moves.map((m) => m.id), ['lead', 'revise', 'fix']);
  assert.equal(moves[0].suggested, true);
  assert.equal(moves[0].headline, 'Pick up Admission of a Partner');
  assert.equal(moves[0].why, '6 of 16 done');
  assert.deepEqual(moves[0].key, PICKUP.key, 'the offer keeps its own key, run and resume');
  assert.deepEqual(upNextMoves(null), []);
});

test('Up next: a move from an Or row has its headline without minutes, one line saying why, and a key that names its length', () => {
  const [, revise, fix] = upNextMoves(PICKUP);
  assert.equal(revise.headline, 'Revise 9 due cards');
  assert.equal(revise.why, MOVE_WHY.revise);
  assert.equal(revise.key.label, 'Start · 2 min');
  assert.deepEqual(revise.key.run, PICKUP.or[0].run, 'the run is the server\'s, untouched');
  assert.deepEqual(revise.cell, { title: 'Revise 9 due cards', value: '2 min' });
  assert.equal(fix.why, 'In Accounting for Partnership: Basic Concepts.');
  assert.equal(fix.key.label, 'Start · 3 min');
  const feed = upNextMoves({ ...PICKUP, or: [PICKUP.or[2]] })[1];
  assert.equal(feed.key.label, 'Start · 10 min', 'a feed starts, at the length in its address');
});

test('Up next: the footer shows every move but the one on the card, the server pick first', () => {
  const moves = upNextMoves(PICKUP);
  assert.deepEqual(otherMoves(moves, 'lead').map((m) => m.id), ['revise', 'fix']);
  assert.deepEqual(otherMoves(moves, 'fix').map((m) => m.id), ['lead', 'revise']);
});

test('Up next: the module is the page\'s one recommendation and starts nothing on a cell tap (only its key starts)', () => {
  const hero = src('../RoadmapHero.jsx');
  assert.match(hero, /upNextMoves\(roadmap, \{ subjectName \}\)/);
  assert.match(hero, /className="lh-up__cell"[^>]*onClick=\{\(\) => pick\(m\.id\)\}/);
  assert.match(hero, /Suggested/);
  assert.doesNotMatch(hero, /lh-or__row/, 'no list rows competing with the roadmap');
  const css = src('../learn-home.css');
  // 10 Nov (design rule 1): a hairline on the raised card, never a volt rim or wash around the whole card; the volt is the key's.
  assert.match(css, /\.lh-up \{[^}]*border: 1px solid var\(--a-line\)/, 'the next-step card keeps one hairline');
  assert.doesNotMatch(css.match(/\.lh-up \{[^}]*\}/)[0], /volt/, 'no volt rim or wash around the whole card');
  assert.doesNotMatch(css.match(/\.lh-up \{[^}]*\}/)[0], /0 0 \d+px|glow/, 'no halo in Night');
});

test('roadmap rows say state, not advice: "Needs work" with its ring, why said once under the head, a quiet Up next tag', () => {
  const map = src('../ChapterMap.jsx');
  assert.match(map, /verdictWord\(road\.verdict\)/);
  assert.match(map, /lh-map__why/);
  assert.match(map, /Needs work: from the mistakes in your papers\./);
  assert.match(map, /spoken = \[displayTitle\(row\.title\), here, road\.verdict, line\]/, 'the row still says where it comes from to a screen reader');
  const css = src('../learn-home.css');
  assert.match(css, /\.lh-row__here \{[^}]*background: transparent/);
  assert.match(css, /\.lh-row__verdict \{[^}]*color: var\(--a-ink-2\)/);
});

test('Find\'s sets are on Learn home under the field, each opening in place; none drawn when empty', () => {
  const home = src('../LearnHome.jsx');
  assert.match(home, /<CardSets shelves=\{shelves\} onShelf=\{openShelf\} subjectName=\{subjectName\} \/>/);
  const sets = src('../CardSets.jsx');
  assert.match(sets, /shelfKeys\(shelves, subjectName\)/);
  assert.match(sets, /if \(!items\.length\) return null;/);
  assert.match(sets, /data-skey=\{it\.id\}/, 'focus returns to the set key on Back');
});

test('the cover marks the server pick with the same word: Suggested (book order still says Start here)', () => {
  assert.deepEqual(leadLine({ forYou: true, reason: '3 old mistakes to fix' }), { prefix: 'Suggested:', text: '3 open mistakes to fix' });
  assert.deepEqual(leadLine({ forYou: true, reason: 'Chapter 1 of your book' }), { prefix: 'Start here:', text: 'first in the syllabus' });
});

test('the prototype links rule: the preview shell keeps decks, student and subject, and its Learn opens Learn v2', () => {
  const preview = src('../../../../app/preview/arena/ArenaPreviewClient.jsx');
  assert.match(preview, /const carried = \['decks', 'student', 'subject'/);
  assert.match(preview, /\.\.\.Object\.fromEntries\(carried\)/);
  assert.match(preview, /params\.get\('study'\) === 'on' && !learnV2 \? \{ learn: '\/preview\/study' \}/);
});

// R8 LEARN-02: the Revise row says its scope, so it never reads against Key cards' all-subject count.
test('R8 LEARN-02: the Revise move names its subject; without one it reads as the server wrote it', async () => {
  const { scopedRevise } = await import('../homeModel.mjs');
  assert.equal(scopedRevise('Revise 8 due cards', 'Accountancy'), 'Revise 8 Accountancy cards');
  assert.equal(scopedRevise('Revise 1 due card', 'Business Studies'), 'Revise 1 Business Studies card');
  assert.equal(scopedRevise('Revise 8 due cards', ''), 'Revise 8 due cards');
  const revise = upNextMoves(PICKUP, { subjectName: 'Accountancy' }).find((m) => m.kind === 'revise');
  if (revise) assert.doesNotMatch(revise.cell.title, /due cards/);
});

// R8 w6 revision: a set chip on Learn home opened SetPanel, which read Results' `r`, `results` and `onSubject` and crashed
// ("r is not defined"). Sets are not searches and the shelf API sends no `others`, so SetPanel never draws AlsoIn.
test('R8 LEARN-08 revision: SetPanel uses none of Results\' search values; AlsoIn stays in Results only', () => {
  const view = src('../../cards/FindView.jsx');
  const body = (name) => {
    const at = view.indexOf(`function ${name}(`);
    assert.ok(at >= 0, `${name} is in FindView.jsx`);
    const next = view.slice(at + 1).search(/\n(?:export default )?function /);
    return next < 0 ? view.slice(at) : view.slice(at, at + 1 + next);
  };
  const set = body('SetPanel');
  assert.doesNotMatch(set, /AlsoIn/);
  assert.doesNotMatch(set, /\bresults\./);
  assert.doesNotMatch(set, /(^|[^\w.])r\./m, 'no bare r. in SetPanel');
  assert.doesNotMatch(set, /onSubject/);
  assert.match(body('Results'), /<AlsoIn others=\{r\.others\} onSubject=\{onSubject\} \/>/);
});

// R8 w6 revision: on Free's used day the length picker did nothing beside "Quick recap · 1 min", and held piles kept an empty ring.
test('R8 LEARN-01 revision: the used day draws no length picker, titles the piles "Back tomorrow", and held piles show no ring', () => {
  const page = src('../../chapter/ChapterPage.jsx');
  assert.match(page, /\{dayDone \? null : <div className="lc-ctl">/);
  assert.match(page, /<h2 className="lc-incl__h" id=\{`\$\{headId\}-incl`\}>Back tomorrow<\/h2>/);
  assert.match(page, /aria-labelledby=\{dayDone \? `\$\{headId\}-incl` : headId\}/);
  assert.match(page, /\{"What's in this session"\}/, 'every other day keeps its heading');
  const css = src('../../chapter/chapter.css');
  assert.match(css, /\.lc-pile\[data-held\] \.lc-tick \{ display: none; \}/);
  assert.match(page, /data-n=\{n\} data-daydone=\{dayDone \? '' : undefined\}/);
  assert.match(css, /\.lc-piles\[data-daydone\] \.lc-pile\[data-held\] \.lc-pile__min \{ display: none; \}/, 'the heading says it once');
});

// R8 w6 revision: a row's own Show gives the whole line with the NCERT excerpt's leading '…' and the page it comes from.
test('R8 LEARN-10 revision: the whole line keeps the leading ellipsis and names its page', async () => {
  const list = src('../../cards/CardList.jsx');
  assert.match(list, /withLead\(whole \? flat\(source\) : snippet\(source, query, 210\), card\)/);
  assert.match(list, /const whereFrom = whole \? sourceLine\(card\.source\) : null;/);
  const { withLead } = await import('../../../keycards/kinds.js');
  const ncert = { source: { kind: 'ncert', book: 'x' }, kind: 'fact' };
  assert.equal(withLead('relation between persons', ncert).startsWith('…'), true);
  assert.equal(withLead('…already cut', ncert), '…already cut');
  assert.equal(withLead('Partnership is a relation', ncert), 'Partnership is a relation');
});
