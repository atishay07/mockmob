// Writes the variants of the one Review student (data/tests/fixtures/review/*.json) from student.json, and
// expected.json (what the shared rules answer on each). student.json itself is the design fixture, copied unchanged from
// tmp/design-1017/learn-review/fixture.json (LEARN-REVIEW-1017 section 9); never edit it here.
// Run after a deliberate rule change: node scripts/gen_review_fixtures.mjs
// The app's port reads the same files (copy them to flutter_app/test/fixtures/review/).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paperRows, paperRepairOrder } from '../data/result_papers.mjs';
import { chapterRows, reviewCounts, reviewMove, reviewState, reviseDue, receipt } from '../data/review_input.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'data/tests/fixtures/review');
const student = JSON.parse(readFileSync(resolve(dir, 'student.json'), 'utf8'));
const copy = (v) => JSON.parse(JSON.stringify(v));
const LETTERS = 'ABCD';

const variants = {};

// Every wrong answer repaired tonight, its Check it held not taken: rule 4.
variants.check_pending = (() => {
  const r = copy(student);
  for (const item of r.items) if (item.state === 'open') { item.state = 'repaired'; item.repairedAt = '2026-10-17T20:10:00+05:30'; }
  return r;
})();

// No AI credits: rule 5, the practice set, and the day the credits renew.
variants.zero_credits = (() => { const r = copy(student); r.wallet.aiCredits = 0; return r; })();

// Every wrong answer repaired and held on its check; only blanks are left: rule 5.
variants.all_held = (() => {
  const r = copy(student);
  for (const item of r.items) {
    if (item.state === 'blank' || item.state === 'held') continue;
    item.state = 'held';
    item.repairedAt ||= '2026-10-16T22:00:00+05:30';
    item.checkedAt = '2026-10-17T20:00:00+05:30';
    item.reviseNext = '2026-10-18';
  }
  return r;
})();

// One paper, no repairs: the shared result fixture "avg" as a Review record, so the result page and Review name the same move.
variants.one_paper = (() => {
  const rows = paperRows('avg');
  const chapters = [...new Set(rows.map((x) => x.chapter))].map((name, i) => ({ id: `c${i + 1}`, name, subject: 'accountancy', subjectName: 'Accountancy', syllabus: i + 1 }));
  const chapterId = (name) => chapters.find((c) => c.name === name).id;
  const missed = rows.filter((x) => x.verdict !== 'correct');
  const right = rows.filter((x) => x.verdict === 'correct').length;
  const wrong = rows.filter((x) => x.verdict === 'wrong').length;
  const blank = rows.length - right - wrong;
  const stem = (x) => `Question ${x.number} of the illustrative paper`;
  return {
    about: 'The result fixture "avg" (data/result_papers.mjs) as a Review record: one paper, no repairs (LEARN-REVIEW-1017 acceptance 5).',
    now: '2026-10-17T21:41:00+05:30',
    wallet: { aiCredits: 68, aiRenews: '2026-11-01', practiceCredits: 40, isPremium: false },
    papers: [{ id: 'p1', name: 'Mock 1', subject: 'accountancy', subjectName: 'Accountancy', kind: 'full mock', mode: 'full', at: '2026-10-17T20:30:00+05:30', questions: rows.length, right, wrong, blank, score: right * 5 - wrong, of: rows.length * 5 }],
    chapters,
    items: missed.map((x) => ({ paper: 'p1', q: x.number, qid: x.qid, ch: chapterId(x.chapter), state: x.verdict === 'wrong' ? 'open' : 'blank', ...(x.verdict === 'wrong' ? { pick: LETTERS[x.givenIndex] } : {}), stem: stem(x) })),
    repairOrder: paperRepairOrder('avg').qids.map((qid) => `p1:${qid}`),
    revise: { rotation: 0, boxes: [0, 0, 0, 0], cap: 10, dueToday: { questions: 0, again: 0, checks: 0, cards: 0 } },
  };
})();

// Revise holds one question twice (a wrong answer due and a repaired mistake due again): it plays once. 5 wrong answers due,
// 2 repaired mistakes due again (one of them also due as a wrong answer), 1 pending Check it held and 2 lesson cards: 9 due.
variants.revise_dedupe = (() => {
  const r = copy(student);
  r.revise.sources = {
    questions: ['m3:42', 'm3:38', 'm3:45', 'm2:11', 'm3:40'],
    again: ['m3:40', 'm2:17'],
    checks: ['m2:27'],
    cards: 2,
  };
  r.revise.dueToday = { questions: 5, again: 2, checks: 1, cards: 2 };
  return r;
})();

// A new account: no paper yet. The empty state, never the failure state.
variants.empty = {
  about: 'A new account with no paper: the lamp-lit room, an example row, "Start 10 questions".',
  state: 'empty', now: '2026-10-17T21:41:00+05:30',
  wallet: { aiCredits: 10, aiRenews: '2026-11-01', practiceCredits: 140, isPremium: false },
  papers: [], chapters: [], items: [],
  revise: { rotation: 0, boxes: [0, 0, 0, 0], cap: 10, dueToday: { questions: 0, again: 0, checks: 0, cards: 0 } },
};

// Papers on record and the read failing (L12): the failure state, never the empty one.
variants.record_down = {
  about: 'The read failed with papers on record: the failure state ("Your mistakes did not load"), never the empty state.',
  state: 'unavailable', now: '2026-10-17T21:41:00+05:30', message: 'Your record did not load.',
};

// Every answer right on every paper: rule 1.
variants.nothing_missed = (() => {
  const r = copy(student);
  r.papers = [{ id: 'm1', name: 'Mock 1', subject: 'Accountancy', kind: 'full mock', at: '2026-10-17T20:00:00+05:30', questions: 50, right: 50, wrong: 0, blank: 0, score: 250, of: 250 }];
  r.chapters = []; r.items = [];
  r.revise = { rotation: 0, boxes: [0, 0, 0, 0], cap: 10, dueToday: { questions: 0, again: 0, checks: 0, cards: 0 } };
  return r;
})();

const expected = {};
for (const [name, record] of Object.entries({ student, ...variants })) {
  if (name !== 'student') writeFileSync(resolve(dir, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  const state = reviewState(record);
  const move = state === 'ready' ? reviewMove(record) : null;
  expected[name] = {
    state,
    move: move && { kind: move.kind, rule: move.rule, label: move.label, why: move.why, cost: move.cost, late: move.late, alt: move.alt ? { kind: move.alt.kind, label: move.alt.label } : null, note: move.note, target: move.target, panel: move.panel },
    ...(state === 'ready' ? {
      receipt: { found: receipt(record).found, repaired: receipt(record).repaired, retested: receipt(record).retested, stillRight: receipt(record).stillRight, line: receipt(record).line },
      counts: reviewCounts(record),
      chapters: chapterRows(record).map((c) => ({ name: c.name, marks: c.marks, openWrong: c.openWrong, blank: c.blank, repaired: c.repaired, slipped: c.slipped, source: c.source, progress: c.progress })),
      reviseDue: reviseDue(record),
    } : {}),
  };
  console.log(name.padEnd(15), '|', state, '|', move?.label ?? '-', '|', move?.panel?.line ?? '-');
}
writeFileSync(resolve(dir, 'expected.json'), `${JSON.stringify({ about: 'Generated by scripts/gen_review_fixtures.mjs from the files in this folder. The tests also assert the design numbers by hand (data/tests/review_input.test.mjs); this file only pins the rest.', cases: expected }, null, 2)}\n`);
