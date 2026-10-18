// Release 9, the result, Review and the reel (packet "review"). Each test would have failed on release 8 (00328e54).
// The browser walk of the same fixes (390 and 1440, Night and Day) is in tmp/r9-fixes/review.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { analyseSession } from '../session_recovery.js';
import { analysisFromRows, costliestLine } from '../result_next_move.mjs';
import { chapterRows } from '../review_chapters.mjs';
import { reelScript, replayView } from '../replay.js';
import { splitPhaseFor, SPLIT_OBSERVER } from '../../src/components/result/splitReveal.mjs';
import { heroAct } from '../../src/components/result/heroAct.mjs';
import { cleanStem, sameStem } from '../../src/components/review/stemText.mjs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/mistake_lab/${name}.json`, import.meta.url), 'utf8'));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------------------------------------------------
// D18 and LOST-X-OF-Y: never "lost X of Y" with X > Y, and the bar agrees with the words.
// ---------------------------------------------------------------------------------------------------------------------
const chapterRecord = ({ questions, wrong, blank, withCounts = true }) => ({
  now: '2026-10-17T21:00:00+05:30',
  papers: [{ id: 'm3', name: 'Mock 3', at: '2026-10-16T21:40:00+05:30' }],
  chapters: [{ id: 'c', name: 'Cash flow statement' }],
  ...(withCounts ? { chapterQuestions: { m3: { c: questions } } } : {}),
  items: [
    ...Array.from({ length: wrong }, (_, i) => ({ paper: 'm3', q: i + 1, ch: 'c', state: 'open' })),
    ...Array.from({ length: blank }, (_, i) => ({ paper: 'm3', q: wrong + i + 1, ch: 'c', state: 'blank' })),
  ],
});
const said = (row) => `${row.line.lead}${row.line.rest}`;
const lostOf = (s) => { const m = /Lost (\d+) of the (\d+) marks/.exec(s); return m ? [Number(m[1]), Number(m[2])] : null; };

test('D18: every question wrong (6 a wrong, 5 a question) drops the "of N" and says the marks alone', () => {
  const [row] = chapterRows(chapterRecord({ questions: 5, wrong: 5, blank: 0 }));
  assert.equal(row.lost, 30);
  assert.equal(row.offer, 25);
  assert.equal(said(row), 'Lost 30 marks, 5 questions in Mock 3. 5 wrong.');
  assert.doesNotMatch(said(row), /\bof the\b/);
  assert.equal(row.share, 1, 'the bar is full, and it agrees with "Lost 30 marks"');
});

test('D18: lost equal to the offer keeps "of N" (30 of 30 is true)', () => {
  const [row] = chapterRows(chapterRecord({ questions: 6, wrong: 5, blank: 0 }));
  assert.equal(row.lost, 30);
  assert.equal(row.offer, 30);
  assert.equal(said(row), 'Lost 30 of the 30 marks on offer, 6 questions in Mock 3. 5 wrong.');
  assert.equal(row.share, 1);
});

test('D18: lost under the offer keeps "of N" and a part-full bar', () => {
  const [row] = chapterRows(chapterRecord({ questions: 10, wrong: 2, blank: 1 }));
  assert.equal(row.lost, 17);
  assert.equal(said(row), 'Lost 17 of the 50 marks on offer, 10 questions in Mock 3. 2 wrong, 1 left blank.');
  assert.equal(row.share, 17 / 50);
});

test('D18: the offer unknown (an older server) says the marks alone', () => {
  const [row] = chapterRows(chapterRecord({ questions: 5, wrong: 5, blank: 0, withCounts: false }));
  assert.equal(row.offer, null);
  assert.equal(said(row), 'Lost 30 marks in Mock 3. 5 wrong.');
});

test('D18: no chapter, in any mix of wrong and blank answers, ever says "lost X of Y" with X > Y', () => {
  for (let questions = 1; questions <= 8; questions += 1) {
    for (let wrong = 0; wrong <= questions; wrong += 1) {
      for (let blank = 0; blank + wrong <= questions; blank += 1) {
        if (!wrong && !blank) continue;
        const [row] = chapterRows(chapterRecord({ questions, wrong, blank }));
        const pair = lostOf(said(row));
        if (pair) assert.ok(pair[0] <= pair[1], `${wrong} wrong, ${blank} blank of ${questions}: ${said(row)}`);
        assert.ok(row.share >= 0 && row.share <= 1);
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// D15: a count that belongs to a chapter names the chapter; "of N questions" is never read against the paper.
// ---------------------------------------------------------------------------------------------------------------------
test('D15: the finding under the score names its chapter ("of its 6 questions"), never a bare "of 6 questions"', () => {
  const dir = new URL('./fixtures/result_next_move/', import.meta.url);
  let seen = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const { name, input: fixture } = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    const head = costliestLine(analysisFromRows(fixture.rows), { answerReviews: fixture.answerReviews });
    if (!head.detail) continue;
    seen += 1;
    assert.doesNotMatch(head.detail, /, of \d+ questions?\.$/, `${name}: a stray comma before "of N"`);
    assert.doesNotMatch(head.detail, /(^|[ :])of \d+ questions?/, `${name}: "of N questions" with no "its"`);
    assert.match(head.detail, new RegExp(`^In ${escapeRe(head.chapter)}: `), `${name}: the chapter is named`);
    assert.match(head.detail, /of its \d+ questions?\.$|right of its \d+ questions?, /, name);
  }
  assert.ok(seen >= 6);
});

test('D15: the sentence reads as the owner asked: "In Share Capital: 4 wrong and 1 left blank of its 6 questions."', () => {
  const { input: fixture } = JSON.parse(readFileSync(new URL('./fixtures/result_next_move/avg.json', import.meta.url), 'utf8'));
  const head = costliestLine(analysisFromRows(fixture.rows), {});
  assert.equal(head.detail, 'In Share Capital: 4 wrong and 1 left blank of its 6 questions.');
});

test('D15: the reel carries the same scoped sentence, and "After this mock" is printed once on the result', () => {
  const swot = read('src/components/result/SwotPanel.jsx');
  assert.match(swot, /inFold \? null : <h2/, 'the in-part panel prints no heading of its own');
  assert.doesNotMatch(swot, /mr-sr/, 'no screen-reader-only second title either');
  assert.match(swot, /aria-label=\{inFold \? SWOT_UI_COPY\.title : undefined\}/, 'it is still named for screen readers, by label');
});

// ---------------------------------------------------------------------------------------------------------------------
// F11: an opened Review mistake shows its stem once and carries one Repair entry.
// ---------------------------------------------------------------------------------------------------------------------
test('F11: a stem is hidden below its row only when the row already says the same words', () => {
  assert.equal(sameStem('New partner brings premium in cash; the sacrificing ratio is not given.', 'New partner brings premium in cash; the sacrificing ratio is not given.:'), true);
  assert.equal(sameStem('New partner brings premium in cash; the sacrificing…', 'New partner brings premium in cash; the sacrificing ratio is not given.'), false, 'a cut-short row stem is not the question');
  assert.equal(sameStem('', 'Anything?'), false);
});

test('F11: no ".:" join after a stem that already ends its sentence', () => {
  assert.equal(cleanStem('The ratio is not given.:'), 'The ratio is not given.');
  assert.equal(cleanStem('Which is right?:'), 'Which is right?');
  assert.equal(cleanStem('Goodwill is shared in:'), 'Goodwill is shared in:', 'a real colon after a lead-in stays');
});

test('F11: Review shows one Repair entry at a time and the sheet leaves out a stem the row has already shown', () => {
  const chapters = read('src/components/review/ReviewChapters.jsx');
  assert.match(chapters, /\{open \? null : <button type="button" className="rv8-act mk-press" onClick=\{onRepair\}/, "the row's Repair goes while its sheet is open");
  assert.match(chapters, /<AnswerSheet key=\{item\.uid\} item=\{item\} wallet=\{wallet\} onChanged=\{onChanged\} stemInRow \/>/);
  const sheet = read('src/components/review/AnswerSheet.jsx');
  assert.match(sheet, /stemInRow && q && sameStem\(item\.stem, q\.stem\)/);
  assert.match(sheet, /showStem=\{showStem\}/);
  assert.match(sheet, /Repair Q\{item\.number\}, 1 AI credit/, "the sheet's own paid Repair stays: it is the one entry once the row is open");
});

// ---------------------------------------------------------------------------------------------------------------------
// LOW: "Where your marks went" never waits on a 14 px bar being wholly in view.
// ---------------------------------------------------------------------------------------------------------------------
test('the ledger reveals when its bar is first reached, or at once when the page opened past it', () => {
  assert.equal(SPLIT_OBSERVER.threshold, 0, 'any part of the bar counts: threshold 1 never fires for a bar the page opened past');
  assert.equal(splitPhaseFor({ isIntersecting: true, bottom: 500, height: 14, rootTop: 0 }), 'split');
  assert.equal(splitPhaseFor({ isIntersecting: false, bottom: -40, height: 14, rootTop: 0 }), 'still', 'above the viewport: show it, no animation');
  assert.equal(splitPhaseFor({ isIntersecting: false, bottom: 1500, height: 14, rootTop: 0 }), null, 'below the fold: wait');
  assert.equal(splitPhaseFor({ isIntersecting: false, bottom: 0, height: 0, rootTop: 0 }), null, 'a closed part has no layout: wait');
  const ledger = read('src/components/result/MarksLedger.jsx');
  assert.match(ledger, /SPLIT_OBSERVER/);
  assert.doesNotMatch(ledger, /threshold: 1/);
});

// ---------------------------------------------------------------------------------------------------------------------
// LOW: the reel plays its moments by the clock, and rings only what it lists.
// ---------------------------------------------------------------------------------------------------------------------
const replayInput = load('replay_full_input');
const contract = load('contract_replay_v1');
const analysis = analyseSession(replayInput.attempt);
const changes = replayInput.attempt.selectionMeta.recovery.observed.answerChanges;
const view = replayView(contract.replay, { total: analysis.rows.length });
const finding = costliestLine(analysis, {});
const script = reelScript({ rows: analysis.rows, changes, view, paceSec: 72, finding, next: { kind: 'repair', label: 'Repair Q42', target: { number: 42 } } });
const clockSeconds = (label) => label.split(':').reduce((s, p) => s * 60 + Number(p), 0);

test('the reel lights the whole sheet first, then plays the moments in clock order', () => {
  const kinds = script.frames.map((f) => f.kind);
  const firstMoment = kinds.indexOf('moment');
  assert.ok(firstMoment > 0);
  assert.ok(kinds.slice(0, firstMoment).every((k, i) => k === (i === 0 ? 'start' : 'light')), 'no pause inside the sheet');
  assert.ok(kinds.slice(firstMoment, firstMoment + script.moments.length).every((k) => k === 'moment'));
  const stamps = script.frames.filter((f) => f.kind === 'moment' && f.caption.at).map((f) => clockSeconds(f.caption.at));
  assert.ok(stamps.length >= 2, 'the fixture has dated moments');
  assert.deepEqual(stamps, [...stamps].sort((a, b) => a - b), `clock stamps run forward: ${stamps}`);
  assert.deepEqual(script.frames.filter((f) => f.kind === 'moment').map((f) => f.n), script.moments.map((m) => m.n));
  script.frames.reduce((prev, f) => { assert.ok(f.t > prev); return f.t; }, -1);
});

test('the reel carries the scoped chapter sentence, and a ring is only ever on a listed moment', () => {
  const chapterFrame = script.frames.find((f) => f.kind === 'chapter');
  assert.match(chapterFrame.caption.detail, /^In Share Capital: .* of its \d+ questions\.$/);
  const listed = new Set(script.moments.map((m) => m.n));
  for (const f of script.frames) if (f.ring !== null) assert.ok(listed.has(f.ring), `Q${f.ring} is ringed but is not a listed moment`);
  for (const f of script.frames.filter((x) => x.kind === 'moment')) assert.equal(f.ring, f.n);
});

test('the chapter rings, which are not moments, come with a sentence that says what they are', () => {
  const reel = read('src/components/result/PaperReel.jsx');
  assert.match(reel, /Ringed: \$\{chapter\.numbers\.length/);
  assert.match(reel, /<p className="pbk-ringnote">/);
});

// ---------------------------------------------------------------------------------------------------------------------
// LOW: the hero Mobi is awake.
// ---------------------------------------------------------------------------------------------------------------------
test('the hero shows Mobi awake: rest becomes a wide-eyed idle, and the proud and encouraging acts pass through', () => {
  assert.equal(heroAct('rest'), 'idle');
  for (const act of ['proud', 'cheer', 'encourage']) assert.equal(heroAct(act), act);
  assert.match(read('src/components/result/ResultHero.jsx'), /act=\{heroAct\(reaction\.act\)\}/);
});

// ---------------------------------------------------------------------------------------------------------------------
// LOW: the preview fixtures.
// ---------------------------------------------------------------------------------------------------------------------
test('previewReview: the saved repair names the same key everywhere (B), and no stem gets a ".:"', () => {
  const src = read('src/app/preview/arena/previewReview.js');
  assert.match(src, /const KEY_INDEX = 1;/);
  assert.match(src, /replace\(\/option C\/g, `option \$\{LETTER\[KEY_INDEX\]\}`\)/);
  assert.match(src, /keyIndex: KEY_INDEX/);
  assert.doesNotMatch(src, /question: item \? `\$\{item\.stem\}:`/);
});

test('previewFixtures: the paper in fixtureAttempt is recent, so ?earned= can show the Badge earned row', () => {
  const src = read('src/app/preview/arena/previewFixtures.js');
  assert.doesNotMatch(src, /completedAt: '2026-10-04/);
  assert.match(src, /completedAt: new Date\(Date\.now\(\) - PAPER_AGE_MS\)\.toISOString\(\)/);
});
