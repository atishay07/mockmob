// Pass 1018 acceptance checks that run without a browser (REVIEW-RESULT-1018 section 9):
//   3  one label per state on the result, Review and the app (D15): actionLabel is the one source, and no surface carries
//      "Repair first", "Repair in N" or "Check it here"
//   5  one structure (D16): the six parts are named, in order, and every R4 block lives in the part section 5.3 gives it
//   2  the counts agree on the review states the mocks draw: one paper, a chapter with every mistake repaired, none at all
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ACTION_LABELS, actionLabel } from '../repair_presentation.mjs';
import { actionFor, chapterRows, chaptersBody, reviewLine } from '../review_chapters.mjs';
import { analysisFromRows, leadMistake, nextMove } from '../result_next_move.mjs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const student = JSON.parse(read('data/tests/fixtures/review/student-1018.json'));

test('actionLabel: Repair, Check it held, See repair, Try it again, or nothing for a held key', () => {
  assert.deepEqual({ ...ACTION_LABELS }, { repair: 'Repair', check: 'Check it held', see: 'See repair', again: 'Try it again' });
  assert.equal(actionLabel('open'), 'Repair');
  assert.equal(actionLabel('wrong'), 'Repair');
  assert.equal(actionLabel('repaired'), 'Check it held');
  assert.equal(actionLabel('held'), 'See repair');
  assert.equal(actionLabel('slipped'), 'See repair');
  assert.equal(actionLabel('blank'), 'Try it again');
  assert.equal(actionLabel('open', { keyHeld: true }), null);
  // Review's rows ask the same function, so the two surfaces cannot drift.
  for (const state of ['open', 'blank', 'repaired', 'held', 'slipped']) assert.equal(actionFor({ state }), actionLabel(state), state);
  assert.equal(actionFor({ state: 'open', keyState: 'under_review' }), null);
});

test('no surface of the result or Review says "Repair first", "Repair in N" or "Check it here"', () => {
  const files = [
    'src/app/(app)/result/[id]/ResultPageClient.jsx', 'data/result_next_move.mjs', 'data/repair_presentation.mjs', 'data/review_chapters.mjs',
    ...readdirSync(new URL('src/components/result/', root)).filter((f) => /\.(jsx|js|mjs)$/.test(f)).map((f) => `src/components/result/${f}`),
    ...readdirSync(new URL('src/components/review/', root)).filter((f) => /\.(jsx|js|mjs)$/.test(f)).map((f) => `src/components/review/${f}`),
  ];
  const banned = [/repair first/i, /repair in \d/i, /repair in \{/i, /check it here/i];
  for (const file of files) {
    // Comments may quote the owner's words; the audit reads what the product says.
    const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:])\/\/.*$/gm, '$1');
    for (const re of banned) assert.ok(!re.test(code), `${file} says ${re}`);
  }
});

// ---------- one structure: the six parts and where each R4 block lives ----------
const source = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
const partsAt = source.indexOf('const parts = [');
const partsBlock = source.slice(partsAt, source.indexOf('\n  ];', partsAt));
const IDS = ['marks', 'mistakes', 'time', 'rule', 'after', 'answers'];
const bodyOf = (id) => {
  const at = partsBlock.indexOf(`{ id: '${id}'`);
  assert.ok(at >= 0, `part ${id} exists`);
  const next = IDS.map((x) => partsBlock.indexOf(`{ id: '${x}'`)).filter((i) => i > at).sort((a, b) => a - b)[0] ?? partsBlock.length;
  return partsBlock.slice(at, next);
};

test('Your full analysis names six parts, in the order of section 5.2', () => {
  const found = [...partsBlock.matchAll(/\{ id: '(\w+)', name: '([^']+)'/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(found, [['marks', 'Where your marks went'], ['mistakes', 'Your mistakes'], ['time', 'Time and changes'], ['rule', 'Did your rule hold'], ['after', 'After this mock'], ['answers', 'Answer by answer']]);
  assert.match(read('src/components/result/AnalysisParts.jsx'), /PART_IDS = Object\.freeze\(\['marks', 'mistakes', 'time', 'rule', 'after', 'answers'\]\)/);
  // The front is above the parts and is not one of them.
  assert.ok(source.indexOf('<ResultHero') < source.indexOf('<AnalysisParts'));
  assert.ok(source.indexOf('<NextMove') < source.indexOf('<AnalysisParts'));
});

test('every R4 block lives in exactly the part section 5.3 gives it (nothing lost, nothing twice)', () => {
  const homes = {
    marks: ['<LabLedger', '<KeyReviewLog', 'rl-cohort', 'Answer corrections'],
    mistakes: ['<MistakeList', '<RepairTotal', 'Reopening a repair is free', ': lesson}', '<RunTrack'],
    time: ['<LabTime'],
    rule: ['<LabProof'],
    after: ['<SwotPanel'],
    answers: ['rp-filters', 'rp-list', 'rp-q__bar'],
  };
  for (const [id, needles] of Object.entries(homes)) {
    const body = bodyOf(id);
    for (const needle of needles) assert.ok(body.includes(needle), `${needle} is in part ${id}`);
  }
  // Each block appears in one part only.
  for (const tag of ['<LabLedger', '<LabTime', '<LabProof', '<SwotPanel', '<MistakeList', '<KeyReviewLog']) {
    const where = IDS.filter((id) => bodyOf(id).includes(tag));
    assert.equal(where.length, 1, `${tag} is in ${where.join(', ')}`);
  }
  // The replay (D17) is part of Time and changes through LabTime; the old 10-minute Replay is no longer mounted anywhere.
  assert.match(read('src/components/ScoreRecoveryLab.jsx'), /<ReplaySlots/);
  assert.doesNotMatch(read('src/components/ScoreRecoveryLab.jsx'), /<Replay[ \n]/);
  // "Play your paper back" (D29) sits under the front, never inside it.
  assert.ok(source.indexOf('<ReelEntry') > source.indexOf('<ResultHero') && source.indexOf('<ReelEntry') < source.indexOf('<AnalysisParts'));
});

test('the front is not touched: the hero, the next move and the answer map keep their R4 props', () => {
  assert.match(source, /<ResultHero receipt=\{receipt\} marks=\{marks\} finding=\{finding\} reaction=\{reaction\}/);
  assert.match(source, /<NextMove move=\{move\} onAct=\{onAct\}/);
  assert.match(source, /aria-label="Answer map: press a question to open it"/);
});

// ---------- the review states the mocks draw ----------
const lostOf = (rows) => rows.reduce((s, r) => s + r.lost, 0);

test('one paper: the chapters are priced from that paper alone and still add up', () => {
  const one = { ...student, papers: student.papers.filter((p) => p.id === 'm3'), items: student.items.filter((i) => i.paper === 'm3'), chapterQuestions: { m3: student.chapterQuestions.m3 } };
  const rows = chapterRows(one);
  const line = reviewLine(one, rows);
  assert.equal(lostOf(rows), line.lost);
  assert.ok(rows.every((r) => r.offer - r.lost === r.scored && r.papers.length === 1 && r.papers[0] === one.papers[0].name));
  assert.match(line.text, /^Mock 3 lost \d+ marks/);
  assert.match(chaptersBody(one).across, /^Each chapter in Mock 3\.$/);
});

test('a chapter with every mistake repaired: nothing left to repair, its marks still counted, its repairs named', () => {
  const lead = chapterRows(student)[0];
  const done = { ...student, items: student.items.map((i) => (i.ch === lead.id && i.state === 'open' ? { ...i, state: 'repaired', repairedAt: '2026-10-17T20:10:00+05:30' } : i)) };
  const after = chapterRows(done).find((r) => r.id === lead.id);
  assert.equal(after.open.length, 0);
  assert.equal(after.lost, lead.lost, 'a repaired mistake still lost its marks on its paper');
  assert.equal(after.repaired.length, lead.repaired.length + lead.open.length);
  assert.ok(after.repaired.every((r) => r.state), 'each is a saved repair');
});

test('an empty record has no chapters and says nothing was lost', () => {
  const empty = { state: 'ready', now: student.now, papers: [], chapters: [], items: [], chapterQuestions: {} };
  assert.deepEqual(chapterRows(empty), []);
  assert.match(reviewLine(empty).text, /lost no marks\.$/);
});

test('the head line and the Saved repairs line agree with the rows (9 repaired = held + slipped + waiting)', () => {
  const body = chaptersBody(student);
  assert.equal(body.line.lost, lostOf(body.rows));
  assert.equal(body.saved.length, body.saved.filter((s) => s.state === 'held').length + body.saved.filter((s) => s.state === 'slipped').length + body.saved.filter((s) => s.state === 'repaired').length);
  assert.match(body.line.fixed, new RegExp(`${body.saved.length} are repaired`));
});

test('the stamps carry a real weekday and a 12-hour clock on Review and the Saved repairs', () => {
  const body = chaptersBody(student);
  for (const row of body.rows) for (const m of [...row.open, ...row.blanks, ...row.repaired]) assert.match(m.stamp, /(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec), \d{1,2}:\d{2} (AM|PM)$/);
  for (const s of body.saved) assert.match(s.stamp, /(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} \w{3}, \d{1,2}:\d{2} (AM|PM)$/);
});

test('every saved repair opens free: a repaired, held or slipped mistake is never offered a paid Repair (F17)', () => {
  for (const s of chaptersBody(student).saved) assert.ok(['Check it held', 'See repair'].includes(s.action), s.action);
  const sheet = read('src/components/review/AnswerSheet.jsx');
  assert.match(sheet, /A mistake that already has a saved repair/);
  assert.match(sheet, /const SAVED = new Set\(\['repaired', 'held', 'slipped'\]\)/);
});

// D15: the key says "Repair Q6", so the list leads with Q6 (priority by order, never by a label).
test('the mistake the next move names is the one the list leads with, on every shared paper', () => {
  const dir = new URL('data/tests/fixtures/result_next_move/', root);
  let named = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const { name, input } = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    const analysis = analysisFromRows(input.rows);
    const repaired = new Set(input.repaired);
    const move = nextMove({ ...input, analysis, repaired });
    const lead = leadMistake({ analysis, answerReviews: input.answerReviews, repairOrder: input.repairOrder, repaired });
    const named_ = move.kind === 'repair' ? move.target?.number : move.alt?.kind === 'repair' ? move.alt.target?.number : null;
    if (named_ != null) { named += 1; assert.equal(lead?.number, named_, `${name}: the key names Q${named_}, the list leads with Q${lead?.number}`); }
  }
  assert.ok(named >= 3, 'at least three shared papers name a mistake');
});

test('the result page leads its list with that mistake, read once at load so rows do not shuffle', () => {
  assert.match(source, /const leadQid = useMemo\(/);
  assert.match(source, /inRepairOrder\(analysis\?\.mistakes, listOrder\)/);
  assert.match(source, /lead=\{leadMoved \? runNumbers\[leadQid\] : null\}/);
});
