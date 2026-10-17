// node --test src/components/landing/landingCopy.test.mjs
// The landing's claims about the question bank and repeats must stay as true as the code behind them: the mock
// selector favours unanswered questions but promises nothing more (data/mock_question_selector.js), and Recovery
// checks fail rather than repeat when a bank runs dry. So no landing copy may say a question "never repeats".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { weakChapters } from './labStory.mjs';

const here = new URL('./', import.meta.url);
const read = (url) => readFileSync(url, 'utf8');
const PAGE = read(new URL('../../app/page.js', import.meta.url));
const LANDING = readdirSync(here)
  .filter((name) => /\.(jsx|mjs)$/.test(name) && !name.endsWith('.test.mjs'))
  .map((name) => [name, read(new URL(name, here))]);

test('no landing copy promises that questions never repeat', () => {
  for (const [name, source] of [['page.js', PAGE], ...LANDING]) {
    assert.doesNotMatch(source, /never\s+repeat/i, `${name} says "never repeat"`);
    assert.doesNotMatch(source, /no repeats|without repeats|zero repeats/i, `${name} promises no repeats`);
  }
});

test('the question bank and unlimited mocks are said at heading level, and always "with Pro"', () => {
  assert.match(PAGE, /<h2 className="lp-shelf__title"[^>]*>One question bank\. As many mocks as you want with Pro\.<\/h2>/);
  assert.match(PAGE, /Unlimited mocks with Pro, ₹\$\{OFFER\.oneTime\.rupees\} once\./, 'the pricing heading names unlimited mocks with Pro');
  assert.match(PAGE, /Unlimited mocks with Pro, ₹\$\{OFFER\.monthly\.rupees\} a month\./);
  // The hero's facts lead with the full mock it links to; the unlimited claim is said once, on the shelf's heading,
  // not again one screen above it.
  const facts = PAGE.slice(PAGE.indexOf('<nav className="lp-proof"'), PAGE.indexOf('</nav>'));
  assert.ok(facts.indexOf('Full mocks') >= 0 && facts.indexOf('Full mocks') < facts.indexOf('Two exam screens'), 'the full-mock fact comes first');
  assert.doesNotMatch(facts, /Unlimited/, 'the hero facts do not repeat the shelf heading');
  // The shelf's note is honest that an answered question can come back.
  assert.match(PAGE, /one you have answered can come back/);
});

test('the bank counts are in the server HTML, read from the stored snapshot', () => {
  assert.match(PAGE, /export const revalidate = \d+;/);
  assert.match(PAGE, /<SubjectCount id=\{id\} initial=\{/);
  assert.match(PAGE, /<HeroLive initial=\{bankCounts\} \/>/);
});

test('the tour titles its chapter list as a ranked list, since it holds strengths too', () => {
  const tour = read(new URL('TourScreens.jsx', here));
  assert.match(tour, /<Frame title="Your chapters, weakest first"/);
  assert.doesNotMatch(tour, /Weak chapters across/);
  const rows = weakChapters();
  for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i - 1].right / rows[i - 1].of <= rows[i].right / rows[i].of, 'weakest first');
});

test('the full-repair key and its sheet sit outside the scaled repair panel, so no window clips them', () => {
  const cinema = read(new URL('LabCinema.jsx', here));
  const panel = cinema.slice(cinema.indexOf('function RepairPanel('), cinema.indexOf('function RepairSheet('));
  assert.doesNotMatch(panel, /lcr-more|<dialog/, 'the key is not inside the panel that ScrollStory scales');
  assert.match(cinema, /<div className="lc-scene__fit"[^>]*>.*<\/div>\s*\{key === 'repair' \? <RepairSheet on=\{on\} \/> : null\}/);
});

test('the Benchmarks scene shows the real benchmark levels and a question count the app offers', async () => {
  const { RIVAL_PROFILES } = await import('../../services/ai-rival/rivalProfiles.js');
  const { BENCH_LADDER, BENCH_COUNT, BENCH_DAILY } = await import('./benchLadder.mjs');
  const pct = (p) => `${Math.round(p.targetAccuracy * 100)}%`;
  const ladder = Object.fromEntries(BENCH_LADDER.map(([level, score]) => [level, score]));
  assert.equal(ladder['DU level'], pct(RIVAL_PROFILES.SRCC_DREAM));
  assert.equal(ladder['College level'], pct(RIVAL_PROFILES.HANSRAJ_LEVEL));
  assert.equal(ladder.Daily, pct(RIVAL_PROFILES.NORTH_CAMPUS_RIVAL));
  assert.equal(BENCH_DAILY, RIVAL_PROFILES.NORTH_CAMPUS_RIVAL);
  const arena = read(new URL('../ai/AIRivalArena.jsx', import.meta.url));
  const offered = arena.match(/\{\[([\d,\s]+)\]\.map\(\(count\)/);
  assert.ok(offered, 'the arena still lists its question counts');
  assert.ok(offered[1].split(',').map(Number).includes(BENCH_COUNT), `${BENCH_COUNT} questions is a count the arena offers`);
  const tour = read(new URL('TourScreens.jsx', here));
  assert.doesNotMatch(tour, /\b25 questions\b|'88%'|'82%'/, 'no hard-coded benchmark numbers in the scene');
});

test('no leaderboard of other students: the product shows only the student's own standing', () => {
  // /leaderboard answers only the caller's own rank (the privacy hotfix of 17 Oct 2026), so the landing never sells a
  // board of other students: the feature is "Your standing".
  assert.doesNotMatch(PAGE, /'Leaderboard'|to the leaderboard|See the leaderboard|leaderboard points/i);
  assert.match(PAGE, /Your standing among MockMob students/);
  assert.match(PAGE, /cta: 'See your standing'/);
  for (const [name, source] of LANDING) assert.doesNotMatch(source, /leaderboard/i, `${name} names a leaderboard`);
});

test('Score Recovery delayed fresh checks are promised only while Recovery is released', async () => {
  const { recoveryCopy } = await import('./recoveryCopy.mjs');
  const soon = recoveryCopy('blocked_content');
  const text = Object.values(soon).filter((v) => typeof v === 'string').join(' ');
  assert.doesNotMatch(text, /days later|Check it holds|Open for every repair/i, 'a blocked Recovery is not sold as live');
  assert.equal(soon.soon, true);
  assert.equal(recoveryCopy('available').soon, false);
  // The page reads the copy from the real capability state, never a typed one.
  assert.match(PAGE, /recoveryCopy\(CAPABILITIES\.recovery\.state\)/);
  assert.doesNotMatch(PAGE, /days later|Check it holds/, 'page.js types no recovery promise of its own');
  const lab = read(new URL('MistakeLab.jsx', here));
  assert.doesNotMatch(lab, /each check unlocks on its day/);
});

test('the landing never says "41 subjects": counts and claims cover only the 15 public subjects', async () => {
  for (const [name, source] of [['page.js', PAGE], ...LANDING]) {
    assert.doesNotMatch(source, /(^|[^\d])41\s+(CUET\s+)?subjects/i, `${name} says 41 subjects`);
  }
  const { SAMPLE_SUBJECTS } = await import('./sampleSubjects.mjs');
  assert.equal(SAMPLE_SUBJECTS.length, 15);
});

test('the benchmark run is a whole number of right answers, and its clock follows from the numbers', async () => {
  const { BENCH_YOU, BENCH_COUNT, BENCH_RIGHT, BENCH_PACE, BENCH_DAILY, BENCH_USED, BENCH_ALLOWED } = await import('./benchLadder.mjs');
  assert.ok(Number.isInteger((BENCH_YOU * BENCH_COUNT) / 100), `${BENCH_YOU}% of ${BENCH_COUNT} is a whole number of answers`);
  assert.equal((BENCH_RIGHT * 100) / BENCH_COUNT, BENCH_YOU);
  const sec = (mmss) => mmss.split(':').reduce((m, s) => Number(m) * 60 + Number(s));
  assert.equal(sec(BENCH_USED), BENCH_COUNT * BENCH_PACE);
  assert.equal(sec(BENCH_ALLOWED), BENCH_COUNT * BENCH_DAILY.avgTimePerQuestion);
  assert.ok(sec(BENCH_USED) <= sec(BENCH_ALLOWED), 'the run fits inside the time it had');
  const tour = read(new URL('TourScreens.jsx', here));
  assert.doesNotMatch(tour, /<b>52s<\/b>|useCountdown\(play, 4 \* 60/, 'no hard-coded pace or countdown');
});
