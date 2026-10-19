// Mobi v13 on the website, "Where you stand" (C-dec 3 item c, D157): the pure view of GET /api/mobi/standing that leads the
// Ask your record door. Free on every plan, no model. Every figure is the server's; honest partial, thin, empty and
// no-colleges states; the note on every band.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JOB_COPY, gapLine, collegeRowView, marksWord, practiceHref, rangeScale, safePracticeHref, standingView,
} from '../../src/components/ai/mobiJobs.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const NOTE = 'From your own practice, before NTA normalisation. Not a prediction.';
const BANNED = /[!→←↗»]|Included in Pro|fair use|no credits on Pro/i;

const college = (o = {}) => ({ college: 'Shri Ram College of Commerce', programme: 'B.Com (Hons)', programmeId: 'srcc-bcom', cutoff: 712, category: 'UR', position: 'below', gap: 67, ...o });
const READY = {
  ok: true, status: 'ready',
  band: { low: 610, mid: 645, high: 680, max: 1000, count: 4, complete: true, papers: [{ subject: 'accountancy', name: 'Accountancy', low: 150, mid: 160, high: 170, open: 61 }] },
  thin: [],
  colleges: [college(), college({ college: 'Hindu College', programme: 'B.Com', programmeId: 'hindu-bcom', cutoff: 640, position: 'within', gap: -5 }), college({ college: 'Kirori Mal College', programmeId: 'kmc', cutoff: null, position: 'none', gap: null })],
  first: college(), gap: 67,
  closeFastest: [
    { subject: 'accountancy', subjectName: 'Accountancy', chapter: 'Share Capital', marks: 38, wrong: 6, blank: 2, href: '/test?subject=accountancy&mode=quick&count=10&chapter=Share+Capital' },
    { subject: 'economics', subjectName: 'Economics', chapter: 'Money & Banking', marks: 21, wrong: 4, blank: 0 },
  ],
  paperMostOpen: { subject: 'accountancy', name: 'Accountancy', open: 61 }, category: 'UR', note: NOTE, minSample: 30, paperMax: 250,
  links: { colleges: '/admission-compass', practice: '/test?subject=accountancy&mode=quick&count=10&chapter=Share+Capital' },
};

test('marks read as a student reads them, and unknown is never 0', () => {
  assert.equal(marksWord(66), '66');
  assert.equal(marksWord(66.54), '66.5');
  assert.equal(marksWord(-5), '-5');
  assert.equal(marksWord(null), null);
  assert.equal(marksWord(undefined), null);
  assert.equal(marksWord(Number.NaN), null);
});

test('the ready band: range, the first college\'s 2026 Round 1 closing mark, the gap in marks, the fastest chapters, the note', () => {
  const v = standingView({ phase: 'done', body: READY });
  assert.equal(v.kind, 'ready');
  assert.equal(v.headline, 'Your practice puts you at 610 to 680 out of 1000.');
  assert.deepEqual(v.range, { low: '610', high: '680', max: '1000' });
  assert.equal(v.college.name, 'Shri Ram College of Commerce, B.Com (Hons)');
  assert.equal(v.college.line, 'Closed at 712 in 2026 Round 1, for the UR category.');
  assert.equal(v.gap, 'You are 67 marks short of it at the middle of your range.');
  assert.equal(v.chaptersTitle, JOB_COPY.closeGap);
  assert.deepEqual(v.chapters.map((c) => [c.chapter, c.marks, c.detail]), [['Share Capital', '38 marks open', '6 wrong answers and 2 left blank'], ['Money & Banking', '21 marks open', '4 wrong answers']]);
  assert.equal(v.chapters[0].href, READY.closeFastest[0].href, 'the server\'s own practice link is used');
  assert.equal(v.chapters[1].href, '/test?subject=economics&mode=quick&count=10&chapter=Money+%26+Banking', 'built the server\'s way when it sent none');
  assert.equal(v.note, NOTE);
  assert.equal(v.others.length, 2, 'the first college is not listed twice');
  assert.deepEqual(v.others.map((o) => o.where), ['Inside your range', 'No 2026 Round 1 closing mark']);
  assert.equal(v.addColleges, null);
  assert.ok(v.scale && v.scale.tick > v.scale.band[1], 'the cutoff sits to the right of a band that is short of it');
});

test('the gap says where the band sits, in words, from the server\'s gap (positive = marks short)', () => {
  assert.equal(gapLine(college({ position: 'below', gap: 1 })), 'You are 1 mark short of it at the middle of your range.');
  assert.equal(gapLine(college({ position: 'within', gap: 12.5 })), 'It sits inside your range. The middle of your range is 12.5 marks short of it.');
  assert.equal(gapLine(college({ position: 'within', gap: -8 })), 'It sits inside your range. The middle of your range clears it by 8 marks.');
  assert.equal(gapLine(college({ position: 'above', gap: -40 })), 'Your whole range is above it. The middle of your range clears it by 40 marks.');
  assert.equal(gapLine(college({ gap: null })), null);
  assert.deepEqual(collegeRowView(college({ position: 'below', gap: 30 })), { name: 'Shri Ram College of Commerce, B.Com (Hons)', cutoff: 'Closed at 712', where: '30 marks short', position: 'below' });
  assert.equal(collegeRowView(college({ position: 'above', gap: -3 })).where, 'Above your range');
  const above = standingView({ phase: 'done', body: { ...READY, first: college({ position: 'above', gap: -20, cutoff: 600 }) } });
  assert.equal(above.chaptersTitle, JOB_COPY.mostOpen, 'no gap to close: the chapters are where marks are most open');
});

test('no colleges, or none with a cutoff: the band stays, and the student is told how to add colleges, never a guessed gap', () => {
  const none = standingView({ phase: 'done', body: { ...READY, colleges: [], first: null, gap: null } });
  assert.equal(none.kind, 'ready');
  assert.equal(none.college, null);
  assert.equal(none.gap, null);
  assert.equal(none.addColleges, JOB_COPY.addCollegesLine);
  assert.equal(none.collegesHref, '/admission-compass');
  assert.equal(none.scale.tick, null);
  const noCut = standingView({ phase: 'done', body: { ...READY, colleges: [college({ cutoff: null, position: 'none', gap: null })], first: null, gap: null } });
  assert.equal(noCut.addColleges, JOB_COPY.noCutoffLine);
  assert.equal(noCut.college, null);
});

test('partial: the band out of count x 250, which papers it counts, no college compared, and the note', () => {
  const v = standingView({ phase: 'done', body: {
    ...READY, status: 'partial', colleges: [college({ position: 'none', gap: null })], first: null, gap: null,
    band: { low: 280, mid: 300, high: 320, max: 500, count: 2, complete: false, papers: [{ name: 'Accountancy' }, { name: 'Economics' }] },
    thin: [{ subject: 'english', name: 'English', needed: 12 }],
  } });
  assert.equal(v.kind, 'partial');
  assert.equal(v.headline, 'Your practice puts you at 280 to 320 out of 500.');
  assert.equal(v.from, 'From Accountancy and Economics, 2 of the 4 papers DU adds up.');
  assert.equal(v.compare, JOB_COPY.standCompare);
  assert.equal(v.college, undefined, 'a partial band is never set against a college');
  assert.deepEqual(v.thin.map((t) => t.line), ['12 more questions to go']);
  assert.equal(v.note, NOTE);
});

test('thin, empty, loading, offline and failed: honest words, nothing invented, a retry where trying again can help', () => {
  const thin = standingView({ phase: 'done', body: { ok: true, status: 'thin', band: null, thin: [{ subject: 'accountancy', name: 'Accountancy', needed: 1 }], colleges: [], first: null, closeFastest: [], note: NOTE } });
  assert.equal(thin.kind, 'thin');
  assert.equal(thin.line, JOB_COPY.standThin);
  assert.deepEqual(thin.thin.map((t) => [t.name, t.line, t.href]), [['Accountancy', '1 more question to go', '/test?subject=accountancy&mode=quick&count=10']]);
  assert.equal(standingView({ phase: 'done', body: { ok: true, status: 'empty', band: null, thin: [] } }).kind, 'empty');
  assert.equal(standingView({ phase: 'done', body: { ok: true, status: 'thin', band: null, thin: [] } }).kind, 'empty', 'thin with nothing to list says the empty line');
  assert.deepEqual(standingView({ phase: 'loading' }), { kind: 'loading', line: JOB_COPY.standReading });
  assert.deepEqual(standingView({ phase: 'offline' }), { kind: 'error', line: JOB_COPY.standOffline, retry: true });
  assert.deepEqual(standingView({ phase: 'error' }), { kind: 'error', line: JOB_COPY.standFailed, retry: true });
  assert.deepEqual(standingView({ phase: 'done', body: { ok: false } }).kind, 'error');
  assert.match(JOB_COPY.standFailed, /Nothing was charged\.$/);
});

test('the bar: a window around the band and the cutoff, snapped to 50s, inside 0..max', () => {
  assert.deepEqual(rangeScale({ low: 610, high: 680, max: 1000, cutoff: 712 }), { from: 550, to: 800, band: [24, 52], tick: 64.8 });
  assert.deepEqual(rangeScale({ low: 10, high: 990, max: 1000 }), { from: 0, to: 1000, band: [1, 99], tick: null });
  assert.equal(rangeScale({ low: 700, high: 600, max: 1000 }), null);
  assert.equal(rangeScale({ low: null, high: 600, max: 1000 }), null);
});

test('practice links are ours: a server link is used only when it is a relative practice link', () => {
  assert.equal(practiceHref('accountancy', 'Share Capital'), '/test?subject=accountancy&mode=quick&count=10&chapter=Share+Capital');
  assert.equal(practiceHref('bad id!', 'X'), '/dashboard?mode=quick');
  assert.equal(safePracticeHref('https://evil.example/test?x', 'accountancy', 'Goodwill Valuation'), '/test?subject=accountancy&mode=quick&count=10&chapter=Goodwill+Valuation');
  assert.equal(safePracticeHref('//evil.example/test?x', 'accountancy', null), '/test?subject=accountancy&mode=quick&count=10');
  assert.equal(safePracticeHref('/test?subject=economics&mode=quick&count=10', 'x', null), '/test?subject=economics&mode=quick&count=10');
});

test('the words: plain, no exclamation marks or arrows, and never a Pro claim about Mobi (C-dec 3b)', () => {
  const v = standingView({ phase: 'done', body: READY });
  const lines = [...Object.values(JOB_COPY).filter((x) => typeof x === 'string'), v.headline, v.gap, v.college.line, ...v.chapters.flatMap((c) => [c.marks, c.detail])];
  for (const line of lines) assert.doesNotMatch(String(line), BANNED, String(line));
});

test('wiring: Where you stand leads the record door, reads its own route, and the old leak button is gone', () => {
  const doors = read('src/components/ai/AskMobiDoors.jsx');
  assert.match(doors, /\{ready \|\| status === 'unavailable' \? <WhereYouStand userId=\{userId\} \/> : null\}/);
  assert.ok(doors.indexOf('<WhereYouStand') < doors.indexOf('DOOR_COPY.recordTip'), 'it leads the record questions');
  assert.doesNotMatch(doors, /className="amd-lead"/);
  const parts = read('src/components/ai/MobiJobParts.jsx');
  assert.match(parts, /fetch\('\/api\/mobi\/standing', \{ cache: 'no-store' \}\)/);
  assert.match(parts, /<p className="mj-note">\{view\.note\}<\/p>/, 'the note is on every band');
  assert.match(parts, /data-price="free">Free</, 'free for everyone, said on the card');
  const css = read('src/components/ai/mobi-jobs.css');
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /linear-gradient|backdrop-filter|text-shadow|transition: all/);
});
