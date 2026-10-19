// The owner's 19 Oct app picks brought to the website (D126; owner H6, H7, H9; 20 Oct):
//   Practice: the ways to practise straight after the subject; Your papers and Learn as proper places under the setup.
//   Colleges: a Your colleges strip under Today's greeting with the real closing mark, and the Colleges card on You with each
//   college's closing mark, right under the sheet on a phone. "Choose your colleges" on a fresh account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cutoffFigure, hardestOf, programmesOf, stripView, withCutoffs } from '../../src/lib/colleges/cutoffs.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const BCOM = JSON.parse(read('public/du/2026/offerings/b-com-hons.json'));
const entry = (college, programmeId = 'b-com-hons', programme = 'B.Com (Hons)') => ({ college, programme, programmeId });

test('cutoffs: each college gets DU’s own 2026 Round 1 unreserved figure, read from the programme file', () => {
  const rows = withCutoffs([entry('Shri Ram College of Commerce'), entry('Hansraj College')], { 'b-com-hons': BCOM });
  const srcc = BCOM.rows.find((r) => r[0] === 'Shri Ram College of Commerce');
  assert.equal(rows[0].cut.cutoff, srcc[2][0], 'the Round 1 UR value, unchanged');
  assert.equal(rows[0].cut.category, 'UR');
  assert.equal(cutoffFigure(rows[0]), '924.3');
  assert.ok(rows[1].cut.cutoff > 0);
});

test('cutoffs: a programme file that did not load, or a college with no row, has no figure and is never ranked', () => {
  const rows = withCutoffs([entry('Hindu College'), entry('Nowhere College'), entry('Some College', 'b-a-hons-x')], new Map([['b-com-hons', BCOM], ['b-a-hons-x', null]]));
  assert.ok(rows[0].cut);
  assert.equal(rows[1].cut, null);
  assert.equal(rows[2].cut, null);
  assert.equal(cutoffFigure(rows[1]), null);
  assert.equal(hardestOf(rows).college, 'Hindu College');
  assert.equal(hardestOf([{ college: 'A', cut: null }]), null);
});

test('cutoffs: the strip names the college that needed the most (the app’s rule), ties keep the higher one on the list', () => {
  const tie = [{ college: 'A', cut: { cutoff: 900 } }, { college: 'B', cut: { cutoff: 910 } }, { college: 'C', cut: { cutoff: 910 } }];
  assert.equal(hardestOf(tie).college, 'B');
  assert.deepEqual(programmesOf([entry('A'), entry('B'), entry('C', 'b-a-hons-economics'), { college: 'D' }]), ['b-com-hons', 'b-a-hons-economics']);
});

test('strip copy: real figure in a plain sentence; a fresh account is asked to choose; a failure still opens the list', () => {
  const rows = withCutoffs(['Shri Ram College of Commerce', 'Lady Shri Ram College for Women (W)', 'Hansraj College', 'Hindu College', 'Kirori Mal College'].map((c) => entry(c)), { 'b-com-hons': BCOM });
  const ready = stripView({ state: 'ready', rows });
  assert.equal(ready.label, 'Your colleges, 5 picked');
  assert.equal(ready.line, 'Shri Ram College of Commerce needed 924.3 of 1000 last year');
  assert.equal(ready.figure, '924.3');
  const empty = stripView({ state: 'ready', rows: [] });
  assert.equal(empty.kind, 'empty');
  assert.equal(empty.line, 'Choose your colleges');
  assert.equal(stripView({ state: 'ready', rows: [{ college: 'X', cut: null }] }).line, 'Open them to see the score each one needed last year');
  assert.equal(stripView({ state: 'error' }).line, 'Tap to open your list');
  assert.equal(stripView({ state: 'loading' }).kind, 'loading');
  for (const v of [ready, empty]) assert.doesNotMatch(`${v.label} ${v.line} ${v.sub}`, /!|guarantee|chance/i, 'plain copy, no promise of a seat');
});

test('Today: the strip sits under the greeting, opens Colleges, lands with the page; the block at the end stays (R3)', () => {
  const page = read('src/app/(app)/today/page.jsx');
  const head = page.slice(page.indexOf('<header className="today__head">'), page.indexOf('</header>'));
  assert.match(head, /<TodayCollegesStrip userId=\{userId\} hold=\{landing\} \/>/);
  assert.match(page, /<TodayColleges userId=\{userId\}/, 'the Your colleges block lower on Today is kept');
  const strip = read('src/components/today/TodayCollegesStrip.jsx');
  assert.match(strip, /href="\/admission-compass"/);
  assert.match(strip, /useCollegeCutoffs\(userId\)/);
  assert.match(read('src/components/today/today.css'), /\.app-shell \.tcs \{[\s\S]*?min-height: 60px/);
});

test('You: the Colleges card is Your colleges with each closing mark, right under the sheet on a phone; Choose your colleges when empty', () => {
  const card = read('src/components/colleges/MyColleges.jsx');
  assert.match(card, /<h2 id="mc-account-h" className="mc-h2">Your colleges<\/h2>/);
  assert.match(card, /<CutLine read=\{cuts\} entry=\{c\} \/>/);
  assert.match(card, /Needed <b>\{figure\}<\/b> of 1000 last year/);
  assert.match(card, /'Choose your colleges'/);
  const css = read('src/components/profile/account.css');
  const phone = css.slice(css.lastIndexOf('@media (max-width: 1023px)'));
  assert.match(phone, /> #colleges \{ order: 2; \}/);
  assert.match(phone, /> \.acct-moved--colleges \{ order: 2; \}/);
  assert.match(phone, /> #progress-glance \{ order: 3; \}/);
  assert.match(read('src/app/(app)/profile/ProfilePageClient.jsx'), /<AccountColleges userId=\{user\?\.id\} picker=/, 'the list editor and picker stay');
});

test('Practice: Ways to practise straight after the subject; Your papers and Learn are cards right under the setup; nothing dropped', () => {
  const page = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  const at = (s) => { const i = page.indexOf(s); assert.ok(i > 0, `missing ${s}`); return i; };
  const subjects = at('pr-step--subjects');
  const modes = at('<h2 id="pr-s2">Ways to practise</h2>');
  const setupEnd = at('<div className="pr-bar" role="region"');
  const doors = at('<div className="pr-doors"');
  const papers = at('<h2 id="pr-recent">Your papers</h2>');
  const learn = at('{studyEnabled && <ConceptsPanel />}');
  const stats = at('<dl className="pr-stats"');
  assert.ok(subjects < modes && modes < setupEnd && setupEnd < doors && doors < papers && papers < learn && learn < stats, 'order');
  assert.ok(!page.slice(subjects, modes).includes('<PracticeRepairs'), 'nothing between the shelf and the ways to practise');
  // Kept (R3): the repairs line with Ask Mobi, the newest five papers with their scores, the way to all papers, the Pro panel.
  assert.match(page.slice(papers, learn), /<PracticeRepairs userId=/);
  assert.match(page.slice(papers, learn), /attempts\.slice\(0, 5\)/);
  assert.match(page.slice(papers, learn), /href="\/review"/);
  assert.match(page, /aria-labelledby="pr-access"/);
  assert.equal(page.match(/<ConceptsPanel \/>/g).length, 1, 'Learn is drawn once');
  const learnCard = read('src/components/study/ConceptsPanel.jsx');
  assert.match(learnCard, /<h2 id="pr-concepts">Learn<\/h2>/);
  assert.match(learnCard, /Next lesson/);
  assert.match(learnCard, /href="\/learn"/);
});

test('"Question stream" is not a label anywhere on the signed-in website (D126 rename has nothing to rename on web)', () => {
  for (const rel of ['src/app/(app)/dashboard/DashboardPageClient.jsx', 'src/lib/arenaNavigation.js', 'src/components/feed/DiscoveryFeed.jsx']) {
    assert.doesNotMatch(read(rel), /Question stream|Questions in stream/);
  }
});
