// GET /api/me/review (LEARN-REVIEW-1017 packet P-LR0): src/lib/server/review.js against a PostgREST-shaped fake, with the row
// shapes the real tables return (timestamptz as "2026-10-16T16:10:00+00:00", dates as "2026-10-17", jsonb as objects, an
// aliased JSON path as its own key) and a column whitelist per table, so a select of a column that does not exist fails the
// way PostgREST fails (42703) instead of passing silently. The world is built FROM the design student
// (data/tests/fixtures/review/student.json): the same three papers, 30 wrong answers, 9 repairs, 7 checks, 8 due in Revise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATTEMPT_WINDOW, buildReviewRecord, getReview, keyUnderReview, repairsById, stemLine } from '../../src/lib/server/review.js';
import { mistakeKey } from '../../src/lib/server/repairRecord.js';
import { receipt, reviewMove, reviewState } from '../review_input.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(here, p), 'utf8');
const student = JSON.parse(read('fixtures/review/student.json'));
const USER = 'user-1';
const NOW = Date.parse(student.now);

// ---------------------------------------------------------------- a PostgREST-shaped fake

const COLUMNS = {
  attempts: ['id', 'user_id', 'subject', 'score', 'correct', 'wrong', 'unattempted', 'total', 'details', 'questions_snapshot', 'completed_at', 'selection_meta'],
  ai_credit_reservations: ['operation_key', 'user_id', 'state', 'action', 'amount', 'receipt', 'created_at', 'updated_at'],
  revise_cards: ['user_id', 'question_id', 'box', 'due_day', 'state', 'right_total', 'last_recalled_day', 'key_hash', 'wrong_at', 'created_at', 'updated_at'],
  questions: ['id', 'subject', 'chapter', 'question', 'options', 'correct_index', 'status', 'is_deleted', 'verification_state', 'explanation'],
};
const pgError = (code, message) => ({ data: null, error: { code, message, details: null, hint: null } });
const arrow = (row, path) => path.split('->').reduce((v, k) => (v == null ? v : v[k.replace(/^>/, '')]), row);

function pgFake(tables, { withMode = true, failures = {} } = {}) {
  const calls = [];
  const cols = { ...COLUMNS, revise_cards: withMode ? [...COLUMNS.revise_cards, 'mode'] : COLUMNS.revise_cards };
  class Q {
    constructor(table) { this.table = table; this.filters = []; this.sorts = []; this.span = null; this.cap = null; this.fields = []; this.op = 'select'; }
    select(list) {
      this.fields = String(list).split(',').map((f) => f.trim()).map((f) => { const m = /^(?:(\w+):)?([\w>-]+)$/.exec(f); return { alias: m[1] || m[2], path: m[2] }; });
      return this;
    }
    eq(c, v) { this.filters.push((r) => arrow(r, c) === v); return this; }
    in(c, list) { this.filters.push((r) => list.includes(arrow(r, c))); return this; }
    not(c, kind, v) { if (kind === 'is' && v === null) this.filters.push((r) => arrow(r, c) !== null && arrow(r, c) !== undefined); return this; }
    order(c, { ascending = true } = {}) { this.sorts.push({ c, ascending }); return this; }
    range(a, b) { this.span = [a, b]; return this; }
    limit(n) { this.cap = n; return this; }
    insert() { this.op = 'insert'; return this; }
    update() { this.op = 'update'; return this; }
    upsert() { this.op = 'upsert'; return this; }
    delete() { this.op = 'delete'; return this; }
    run() {
      calls.push({ table: this.table, op: this.op, fields: this.fields.map((f) => f.path) });
      if (failures[this.table]) return pgError(failures[this.table].code, failures[this.table].message);
      if (!tables[this.table]) return pgError('42P01', `relation "public.${this.table}" does not exist`);
      for (const f of this.fields) {
        const base = f.path.split('->')[0];
        if (!cols[this.table].includes(base)) return pgError('42703', `column ${this.table}.${base} does not exist`);
      }
      let rows = tables[this.table].filter((r) => this.filters.every((f) => f(r)));
      for (const { c, ascending } of [...this.sorts].reverse()) rows = [...rows].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (ascending ? 1 : -1));
      if (this.span) rows = rows.slice(this.span[0], this.span[1] + 1);
      if (this.cap !== null) rows = rows.slice(0, this.cap);
      // the response carries only the selected fields, an aliased path under its alias, "->>" as text
      const data = rows.map((r) => Object.fromEntries(this.fields.map((f) => {
        const v = arrow(r, f.path);
        return [f.alias, f.path.includes('->>') ? (v == null ? null : String(v)) : structuredClone(v ?? null)];
      })));
      return { data, error: null };
    }
    then(resolveFn, rejectFn) { return Promise.resolve(this.run()).then(resolveFn, rejectFn); }
  }
  return { calls, from: (table) => new Q(table) };
}

// ---------------------------------------------------------------- the design student as database rows

const SUBJECT_ID = { Accountancy: 'accountancy', 'Business Studies': 'business_studies' };
const pgTime = (iso) => new Date(Date.parse(iso)).toISOString().replace('.000Z', '+00:00'); // PostgREST: "2026-10-16T16:10:00+00:00"
const qidOf = (paper, q) => `${paper}-q${q}`;
const REQUEST = 'r'.repeat(16);

function world({ items = student.items, papers = student.papers } = {}) {
  const chapterName = Object.fromEntries(student.chapters.map((c) => [c.id, c.name]));
  const attempts = papers.map((p) => {
    const here = items.filter((i) => i.paper === p.id);
    const snapshot = [];
    const details = [];
    for (let n = 1; n <= p.questions; n += 1) {
      const item = here.find((i) => i.q === n);
      const qid = qidOf(p.id, n);
      snapshot.push({
        id: qid, chapter: item ? chapterName[item.ch] : 'Filler chapter', subject: SUBJECT_ID[p.subject],
        question: item ? `${item.stem}\nSECOND LINE SHOULD NOT LEAK` : `Filler question ${n}`,
        options: ['SECRET option a', 'SECRET option b', 'SECRET option c', 'SECRET option d'], correct: 1, explanation: 'SECRET explanation',
      });
      if (!item) details.push({ qid, givenIndex: 1, isCorrect: true, timeMs: 30000 });
      else if (item.state === 'blank') details.push({ qid, givenIndex: null, isCorrect: null, timeMs: 12000 });
      else details.push({ qid, givenIndex: item.pick ? 'ABCD'.indexOf(item.pick) : 0, isCorrect: false, timeMs: 41000 });
    }
    return {
      id: p.id, user_id: USER, subject: SUBJECT_ID[p.subject], score: p.score, correct: p.right, wrong: p.wrong, unattempted: p.blank, total: p.questions,
      details, questions_snapshot: snapshot, completed_at: pgTime(p.at),
      selection_meta: { mode: p.kind === 'full mock' ? 'full' : 'quick', scoringVersion: 'server_snapshot_v1' },
    };
  });
  const reservations = [];
  for (const item of items.filter((i) => ['repaired', 'held', 'slipped'].includes(i.state))) {
    reservations.push({
      user_id: USER, state: 'committed', action: 'score_recovery_repair', amount: 1, created_at: pgTime(item.repairedAt), updated_at: pgTime(item.repairedAt),
      operation_key: `repair:${mistakeKey(USER, item.paper, qidOf(item.paper, item.q))}:${REQUEST}`,
      receipt: { repair: { rule: 'SECRET rule', key_idea: 'SECRET idea' }, ...(item.state === 'repaired' ? {} : { check: { right: item.state === 'held', answeredAt: item.checkedAt || item.repairedAt, checkQuestionId: 'chk', explanation: 'SECRET' } }) },
    });
  }
  // 30 cards in four boxes (14, 8, 5, 3): 5 wrong answers due today, the day each repaired mistake comes back, fillers later
  const cards = [];
  const due5 = ['m3-q42', 'm3-q38', 'm3-q45', 'm2-q11', 'm3-q40'];
  const card = (question_id, due_day, extra = {}) => ({ user_id: USER, question_id, box: 1, due_day, state: 'active', right_total: 0, last_recalled_day: null, key_hash: 'h', wrong_at: null, created_at: '2026-10-13T10:00:00+00:00', updated_at: '2026-10-13T10:00:00+00:00', ...extra });
  for (const q of due5) cards.push(card(q, '2026-10-17'));
  for (const item of items.filter((i) => i.reviseNext)) cards.push(card(qidOf(item.paper, item.q), item.reviseNext));
  for (let n = 0; cards.length < 30; n += 1) cards.push(card(`filler-${n}`, '2026-10-25'));
  [14, 8, 5, 3].forEach((count, b) => { cards.splice(([0, 14, 22, 27][b]), count, ...cards.slice([0, 14, 22, 27][b], [0, 14, 22, 27][b] + count).map((c) => ({ ...c, box: b + 1 }))); });
  // The design calls the papers "Mock 3" and "Mock 2", so the student has an older, perfect Mock 1 (the product numbers mocks in a subject by order).
  attempts.push({
    id: 'm1', user_id: USER, subject: 'accountancy', score: 250, correct: 50, wrong: 0, unattempted: 0, total: 50, details: [], questions_snapshot: [],
    completed_at: pgTime('2026-10-05T20:00:00+05:30'), selection_meta: { mode: 'full', scoringVersion: 'server_snapshot_v1' },
  });
  const questions = attempts.flatMap((a) => a.questions_snapshot.map((q) => ({ id: q.id, status: 'live', is_deleted: false, verification_state: 'verified' })));
  return { attempts, ai_credit_reservations: reservations, revise_cards: cards, questions };
}
const WALLET = { aiCredits: 40, aiRenews: '2026-11-01', practiceCredits: 140, isPremium: false };
const run = (tables, over = {}, fakeOptions = {}) => {
  const db = pgFake(tables, fakeOptions);
  return getReview(USER, { db, wallet: WALLET, readDueCards: async () => 2, now: NOW, ...over }).then((out) => ({ ...out, db }));
};

// ---------------------------------------------------------------- tests

test('the design student through the database rows: 30 found, 9 repaired, 7 retested, 6 still right, 22 open, 172 marks', async () => {
  const { http, body, db } = await run(world());
  assert.equal(http, 200);
  assert.equal(body.state, 'ready');
  assert.deepEqual([body.receipt.found, body.receipt.repaired, body.receipt.retested, body.receipt.stillRight], [30, 9, 7, 6]);
  assert.equal(body.receipt.line, '6 of the 7 checks held. Q17 slipped tonight, so it is open again and back in Revise tomorrow, Sun 18 Oct.');
  assert.deepEqual([body.counts.open, body.counts.blanks, body.counts.marks, body.counts.openPapers, body.counts.papers, body.counts.lost], [22, 8, 172, 3, 4, 220]);
  assert.deepEqual(body.chapters.map((c) => [c.name, c.marks]), [
    ['Admission of a partner', 35], ['Retirement and death of a partner', 29], ['Issue of shares', 28], ['Cash flow statement', 23],
    ['Dissolution of a partnership firm', 22], ['Principles of management', 18], ['Accounting ratios', 17],
  ]);
  assert.equal(body.chapters[0].source, '5 wrong, 1 left blank. Accountancy, Mock 3 and Mock 2');
  assert.equal(body.chapters[0].progress, '2 of 7 repaired, 1 slipped');
  assert.equal(body.head.sub, 'With 8 left blank, they cost you 172 marks across 3 papers. A wrong answer costs 6 marks, a blank 5.');
  // the papers, newest first, named the way the result names them
  assert.deepEqual(body.papers.map((p) => [p.id, p.name, p.kind, p.stamp]), [
    ['m3', 'Mock 3', 'full mock', 'Mock 3, 16 Oct, 9:40 PM'], ['bq', 'Quick practice', 'practice', 'Quick practice, 15 Oct, 7:05 PM'], ['m2', 'Mock 2', 'full mock', 'Mock 2, 12 Oct, 10:42 PM'], ['m1', 'Mock 1', 'full mock', 'Mock 1, 5 Oct, 8:00 PM'],
  ]);
  // every row carries its paper and time (F17)
  assert.ok(body.items.every((i) => /^(Mock \d|Quick practice), \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2} (AM|PM)$/.test(i.stamp)));
  const q17 = body.items.find((i) => i.paper === 'm2' && i.number === 17);
  assert.deepEqual([q17.state, q17.pill, q17.open, q17.repairable, q17.reviseNext], ['slipped', 'Slipped on a new question', true, false, '2026-10-18']);
  assert.equal(q17.stem, 'Hidden goodwill when the new partner\'s capital is given');
  // read-only: only selects, and every column named exists
  assert.ok(db.calls.length > 0 && db.calls.every((c) => c.op === 'select'), JSON.stringify(db.calls.filter((c) => c.op !== 'select')));
});

test('Revise today from revise_cards and the repair record: 5 questions back, 1 Check it held (Q27, repaired before today), 2 cards', async () => {
  const { body } = await run(world());
  assert.deepEqual([body.reviseDue.questions, body.reviseDue.again, body.reviseDue.checks, body.reviseDue.cards, body.reviseDue.total], [5, 0, 1, 2, 8]);
  assert.equal(body.reviseDue.mix, '5 questions back, 1 Check it held, 2 concept cards');
  assert.deepEqual(body.reviseDue.unknown, []);
  assert.equal(body.revise.rotation, 30);
  assert.deepEqual(body.revise.boxes, [14, 8, 5, 3]);
  // the ids behind the counts stay on the server
  assert.ok(!('sources' in body.revise));
  assert.deepEqual(body.revise.dueToday, { questions: 5, again: 0, checks: 1, cards: 2 });
});

test('the move from the body: the shared function on the joined data (paper order when no cohort order is sent), and Q42 first with it', async () => {
  const { body } = await run(world());
  const move = reviewMove(body);
  assert.equal(move.kind, 'repair');
  assert.equal(move.rule, 3);
  assert.equal(move.target.attemptId, 'm3');
  assert.equal(move.target.chapter, 'Admission of a partner');
  assert.equal(move.target.qid, 'm3-q38', 'without the Lab\'s cohort order Review falls back to paper order (Q38 is the lowest open number in Mock 3)');
  assert.equal(move.label, 'Repair Q38');
  assert.equal(move.panel.line, 'Your costliest chapter: 35 marks lost in Mock 3 and Mock 2. Q38 comes first.');
  // the same body with the server's repair order (lab.repairOrder across papers) names Q42, as the design fixture does
  const ordered = reviewMove({ ...body, repairOrder: ['m3:m3-q42', 'm3:m3-q38', 'm3:m3-q45'] });
  assert.equal(ordered.label, 'Repair Q42');
  assert.equal(ordered.target.qid, 'm3-q42');
  assert.equal(reviewMove({ ...body, wallet: { ...WALLET, aiCredits: 0 } }).label, 'Practise 10 on Admission of a partner');
});

test('a repaired mistake is not open: the saved repair keeps the paper stamp and never becomes a second paid repair (F17)', async () => {
  const { body } = await run(world());
  const held = body.items.find((i) => i.paper === 'm2' && i.number === 6);
  assert.deepEqual([held.state, held.pill, held.open, held.repairable, held.repairedAt, held.checkedAt], ['held', 'Held on a new question', false, false, '2026-10-13T17:21:00.000Z', '2026-10-13T17:21:00.000Z']);
  const pending = body.items.find((i) => i.paper === 'm3' && i.number === 29);
  assert.deepEqual([pending.state, pending.pill, pending.checkedAt], ['repaired', 'Check it held', null]);
  for (const i of body.items.filter((x) => ['repaired', 'held', 'slipped'].includes(x.state))) assert.equal(i.repairable, false, i.stamp);
  assert.equal(body.items.filter((i) => i.repairable).length, 21, '21 mistakes were never repaired');
});

test('the body carries no answer key, option, explanation, rule or second line of a stem', async () => {
  const { body } = await run(world());
  const text = JSON.stringify(body);
  assert.ok(!/SECRET|SECOND LINE|"options"|"correct"|explanation|key_idea|"rule"/.test(text), text.match(/SECRET[^"]*|SECOND LINE[^"]*/)?.[0]);
  assert.ok(body.items.every((i) => !('key' in i)));
});

test('a question wrong in two papers is two mistakes with two repair ids; repairing one leaves the other open', async () => {
  const items = [
    { paper: 'm3', q: 42, ch: 'adm', state: 'open', pick: 'D', stem: 'Same question' },
    { paper: 'm2', q: 11, ch: 'adm', state: 'repaired', pick: 'A', stem: 'Same question', repairedAt: '2026-10-14T21:00:00+05:30' },
  ];
  const w = world({ items, papers: student.papers.filter((p) => p.id !== 'bq').map((p) => ({ ...p, wrong: 1, blank: 0, right: p.questions - 1, score: (p.questions - 1) * 5 - 1 })) });
  // the same question id in both snapshots
  w.attempts.find((a) => a.id === 'm3').questions_snapshot[41].id = 'shared';
  w.attempts.find((a) => a.id === 'm3').details.find((d) => d.qid === 'm3-q42').qid = 'shared';
  w.attempts.find((a) => a.id === 'm2').questions_snapshot[10].id = 'shared';
  w.attempts.find((a) => a.id === 'm2').details.find((d) => d.qid === 'm2-q11').qid = 'shared';
  w.ai_credit_reservations = [{ ...w.ai_credit_reservations[0], operation_key: `repair:${mistakeKey(USER, 'm2', 'shared')}:${REQUEST}` }];
  const { body } = await run(w);
  const states = body.items.filter((i) => i.qid === 'shared').map((i) => [i.paper, i.state]).sort();
  assert.deepEqual(states, [['m2', 'repaired'], ['m3', 'open']]);
});

test('a wrong answer without a saved repair is open even when another student\'s repair or another user\'s key matches the ids', async () => {
  const w = world();
  w.ai_credit_reservations = [{ ...w.ai_credit_reservations[0], user_id: 'someone-else' }, ...w.ai_credit_reservations.slice(1)];
  const { body } = await run(w);
  // the first reservation belongs to another account: it is not read (the query filters on user_id), so that mistake is open
  assert.equal(body.receipt.repaired, 8);
});

test('a key that is not trusted (withdrawn, held, disputed, gone) is left out of repairs and out of the marks', async () => {
  const w = world();
  w.questions.find((q) => q.id === 'm3-q42').verification_state = 'disputed';
  w.questions.find((q) => q.id === 'm3-q38').status = 'quarantined';
  w.questions.find((q) => q.id === 'm3-q45').is_deleted = true;
  const { body } = await run(w);
  const views = Object.fromEntries(body.items.filter((i) => i.paper === 'm3').map((i) => [i.number, i]));
  for (const n of [42, 38, 45]) assert.deepEqual([views[n].keyState, views[n].pill, views[n].repairable, views[n].open], ['under_review', 'Key being re-checked', false, false], `Q${n}`);
  assert.equal(body.counts.open, 19);
  assert.equal(body.chapters.find((c) => c.name === 'Admission of a partner').marks, 17);
  assert.equal(reviewMove(body).target.chapter, 'Retirement and death of a partner');
  assert.ok(keyUnderReview(undefined) && keyUnderReview({ is_deleted: true }) && keyUnderReview({ status: 'rejected' }) && keyUnderReview({ verification_state: 'disputed' }));
  assert.ok(!keyUnderReview({ status: 'live', is_deleted: false, verification_state: 'verified' }));
});

test('empty is only a new account: no papers is "empty", and a read that failed is never "empty" (L12)', async () => {
  const none = await run({ attempts: [], ai_credit_reservations: [], revise_cards: [], questions: [] });
  assert.equal(none.http, 200);
  assert.equal(none.body.state, 'empty');
  assert.deepEqual(none.body.items, []);
  assert.equal(reviewState(none.body), 'empty');
  // the attempts read fails: 503 unavailable, with no figures at all
  const down = await run(world(), {}, { failures: { attempts: { code: '57014', message: 'canceling statement due to statement timeout' } } });
  assert.equal(down.http, 503);
  assert.equal(down.body.state, 'unavailable');
  assert.equal(reviewState(down.body), 'unavailable');
  assert.ok(!('items' in down.body) && !('counts' in down.body));
  // the saved repairs cannot be read: not "nothing repaired yet", because that would offer a second paid repair
  const noRepairs = await run(world(), {}, { failures: { ai_credit_reservations: { code: 'PGRST301', message: 'JWT expired' } } });
  assert.equal(noRepairs.http, 503);
  assert.equal(noRepairs.body.state, 'unavailable');
});

test('a failed read of Revise, of the keys or of the lesson cards degrades one part and names it; it never shows zero for unknown', async () => {
  const noCards = await run(world(), {}, { failures: { revise_cards: { code: '42P01', message: 'relation "public.revise_cards" does not exist' } } });
  assert.equal(noCards.http, 200);
  assert.deepEqual(noCards.body.reviseDue.unknown, ['questions', 'again']);
  assert.equal(noCards.body.reviseDue.checks, 1, 'a pending Check it held does not need the cards');
  assert.equal(noCards.body.revise.rotation, null);
  assert.deepEqual(noCards.body.revise.dueToday, { questions: null, again: null, checks: 1, cards: 2 });
  assert.equal(noCards.body.receipt.found, 30, 'the rest of the page is unaffected');
  const noLessons = await run(world(), { readDueCards: async () => { throw new Error('study offline'); } });
  assert.deepEqual(noLessons.body.reviseDue.unknown, ['cards']);
  assert.equal(noLessons.body.revise.dueToday.cards, null);
  const noKeys = await run(world(), {}, { failures: { questions: { code: '57014', message: 'timeout' } } });
  assert.equal(noKeys.http, 200);
  assert.ok(noKeys.body.items.every((i) => !i.keyState));
  const unknownWallet = await run(world(), { wallet: null });
  assert.equal(unknownWallet.body.wallet, null);
  assert.match(reviewMove(unknownWallet.body).cost, /^1 credit\./);
  assert.ok(!/You have 0/.test(reviewMove(unknownWallet.body).cost));
});

test('the mode column: before the migration Revise reads without it (every card is a question card); after it, Review again counts once', async () => {
  const before = await run(world(), {}, { withMode: false });
  assert.equal(before.http, 200);
  assert.deepEqual([before.body.reviseDue.questions, before.body.reviseDue.again], [5, 0]);
  // after the migration: a card in mode 'again' is source 2; a question due in both is not possible (one row per question), so it plays once
  const w = world();
  for (const c of w.revise_cards) c.mode = 'question';
  w.revise_cards.find((c) => c.question_id === 'm3-q42').mode = 'again';
  w.revise_cards.find((c) => c.question_id === 'm3-q38').mode = 'again';
  const after = await run(w, {}, { withMode: true });
  assert.deepEqual([after.body.reviseDue.questions, after.body.reviseDue.again, after.body.reviseDue.total], [3, 2, 8]);
  assert.equal(after.body.reviseDue.mix, '5 questions back, 1 Check it held, 2 concept cards');
  // the select that names the column is the first try; a database without it is read again without it
  assert.ok(before.db.calls.filter((c) => c.table === 'revise_cards').length === 2);
  assert.ok(after.db.calls.filter((c) => c.table === 'revise_cards').length === 1);
});

test('the window: the newest 40 papers are read, the rest are counted and `partial` says so', async () => {
  const w = world();
  const filler = (n) => ({ id: `old-${n}`, user_id: USER, subject: 'accountancy', score: 250, correct: 50, wrong: 0, unattempted: 0, total: 50, details: [], questions_snapshot: [], completed_at: pgTime(`2026-08-${String(1 + (n % 28)).padStart(2, '0')}T10:00:00+05:30`), selection_meta: { mode: 'quick' } });
  for (let n = 0; n < 45; n += 1) w.attempts.push(filler(n));
  const { body } = await run(w);
  assert.equal(ATTEMPT_WINDOW, 40);
  assert.equal(body.papers.length, 40);
  assert.equal(body.partial, true);
  assert.equal(body.papersTotal, 49);
  assert.equal(body.papers[0].id, 'm3', 'newest first');
  // "Mock 2" is numbered over the whole history, not the window: an old mock that fell out of the window still counts
  const old = filler(99); old.id = 'old-mock'; old.selection_meta = { mode: 'full' }; old.completed_at = pgTime('2026-07-01T10:00:00+05:30');
  w.attempts.push(old);
  const named = await run(w);
  assert.equal(named.body.papers.find((p) => p.id === 'm3').name, 'Mock 4');
  assert.equal(named.body.papers.find((p) => p.id === 'm2').name, 'Mock 3');
  assert.equal(named.body.papers.length, 40);
});

test('pure parts: stems cut at a word, repairs by id keep the newest and read a check from a string receipt, bad rows are skipped', () => {
  assert.equal(stemLine({ question: '  First line  \n second' }), 'First line');
  assert.equal(stemLine({ body: 'Only a body' }), 'Only a body');
  assert.equal(stemLine({}), '');
  const long = `${'word '.repeat(60)}end`;
  const cut = stemLine({ question: long });
  assert.ok(cut.length <= 141 && cut.endsWith('…') && !/ …$/.test(cut));
  const id = mistakeKey(USER, 'a1', 'q1');
  const map = repairsById([
    { operation_key: `repair:${id}:aaaaaaaaaaaaaaaa`, updated_at: '2026-10-10T10:00:00+00:00', receipt: { repair: { rule: 'x' } } },
    { operation_key: `repair:${id}:bbbbbbbbbbbbbbbb`, updated_at: '2026-10-11T10:00:00+00:00', receipt: JSON.stringify({ repair: { rule: 'y' }, check: { right: false, answeredAt: '2026-10-12T10:00:00+00:00' } }) },
    { operation_key: 'not-a-repair-key', updated_at: '2026-10-11T10:00:00+00:00', receipt: { repair: {} } },
    { operation_key: `repair:${id}:cccccccccccccccc`, updated_at: 'not a date', receipt: { repair: {} } },
    { operation_key: `repair:${id}:dddddddddddddddd`, updated_at: '2026-10-13T10:00:00+00:00', receipt: { note: 'no repair body' } },
  ]);
  assert.deepEqual(map.get(id), { repairedAt: '2026-10-11T10:00:00.000Z', check: { right: false, answeredAt: '2026-10-12T10:00:00.000Z' } });
  assert.equal(map.size, 1);
  const rec = buildReviewRecord({ userId: USER, slim: [], now: NOW });
  assert.equal(rec.state, 'empty');
});

test('the route and the migration: read-only route, additive idempotent migration with an undo outside the migrations folder', () => {
  const route = read('../../src/app/api/me/review/route.js');
  assert.match(route, /export async function GET/);
  assert.ok(!/export async function (POST|PUT|PATCH|DELETE)/.test(route));
  assert.ok(!/\.(insert|update|upsert|delete|rpc)\(/.test(route + read('../../src/lib/server/review.js')), 'Review writes nothing');
  assert.match(route, /force-dynamic/);
  assert.match(route, /Cache-Control/);
  const migration = read('../../supabase/migrations/20261017160000_revise_cards_mode.sql');
  const undo = read('../../supabase/undo/20261017160000_revise_cards_mode.undo.sql');
  assert.match(migration, /add column if not exists mode text not null default 'question'/);
  assert.match(migration, /check \(mode in \('question', 'again'\)\)/);
  assert.ok(!/drop |delete |truncate |update /i.test(migration.replace(/^--.*$/gm, '')), 'additive only');
  assert.match(undo, /drop column if exists mode/);
  assert.match(undo, /drop constraint if exists revise_cards_mode_check/);
  assert.ok(!/^\s*(alter|drop)/im.test(route));
});
