import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckStore } from '../../src/services/recovery/repairCheckStore.js';

// A fake of the slice of the Supabase client the store uses: chainable filters over in-memory tables, with errors injected
// per table. Every call is logged, so a test can see what was read and what was written.
function fakeDb(tables, { errors = {} } = {}) {
  const log = [];
  const value = (row, path) => (path.includes('->') ? path.split('->').reduce((o, k) => (o == null ? undefined : o[k]), row) : row[path]);
  const like = (text, pattern) => new RegExp(`^${String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`).test(String(text ?? ''));
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.op = 'select'; this.opts = {}; }
    select() { return this; }
    eq(k, v) { this.filters.push([`eq ${k}`, (r) => value(r, k) === v, k, v]); return this; }
    in(k, list) { this.filters.push([`in ${k}`, (r) => list.includes(value(r, k)), k, list]); return this; }
    like(k, p) { this.filters.push([`like ${k}`, (r) => like(value(r, k), p), k, p]); return this; }
    gte(k, v) { this.filters.push([`gte ${k}`, (r) => Number(value(r, k) ?? 0) >= v, k, v]); return this; }
    or(expr) { this.orExpr = expr; return this; }
    is(k, v) { this.filters.push([`is ${k}`, (r) => (v === null ? value(r, k) == null : value(r, k) === v), k, v]); return this; }
    order() { return this; }
    limit(n) { this.max = n; return this; }
    range(a, b) { this.from = a; this.to = b; return this; }
    update(patch) { this.op = 'update'; this.patch = patch; return this; }
    upsert(rows, opts) { this.op = 'upsert'; this.rows = rows; this.opts = opts || {}; return this; }
    maybeSingle() { this.single = true; return this; }
    then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject); }
    run() {
      log.push({ table: this.table, op: this.op, filters: this.filters.map((f) => [f[0], f[3]]), orExpr: this.orExpr, patch: this.patch, rows: this.rows, opts: this.opts });
      if (errors[this.table] && (errors[this.table].ops || ['select', 'update', 'upsert']).includes(this.op)) return { data: null, error: errors[this.table].error };
      const all = tables[this.table] || (tables[this.table] = []);
      if (this.op === 'upsert') {
        const key = this.opts.onConflict.split(',');
        for (const row of this.rows) {
          const at = all.findIndex((r) => key.every((k) => r[k] === row[k]));
          if (at < 0) all.push({ ...row });
          else if (!this.opts.ignoreDuplicates) all[at] = { ...all[at], ...row };
        }
        return { data: null, error: null };
      }
      let rows = all.filter((r) => this.filters.every((f) => f[1](r)));
      if (this.op === 'update') {
        if (this.beforeUpdate) this.beforeUpdate();
        for (const r of rows) Object.assign(r, this.patch);
        return { data: rows.map((r) => ({ operation_key: r.operation_key })), error: null };
      }
      if (this.from !== undefined) rows = rows.slice(this.from, this.to + 1);
      if (this.max) rows = rows.slice(0, this.max);
      return this.single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null };
    }
  }
  return { log, from: (table) => new Query(table), tables };
}

const store = (tables, over = {}) => { const db = fakeDb(tables, over.db); return { db, store: createCheckStore({ db, recordProgress: over.recordProgress || (async () => {}), readable: over.readable || (async (rows) => rows.filter((r) => r.status === 'live')) }) }; };
const missingTable = { code: '42P01', message: 'relation "x" does not exist' };
const attempt = { subject: 'accountancy', questionsSnapshot: [{ id: 'in_this_attempt' }] };

test('never seen: loadSeen unions progress, interactions, attempts, sessions and the attempt itself, for this student only', async () => {
  const { store: s } = store({
    user_question_progress: [{ user_id: 'u1', question_id: 'p1' }, { user_id: 'u2', question_id: 'other_student_progress' }],
    question_interactions: [{ user_id: 'u1', question_id: 'i1', interaction_type: 'seen' }, { user_id: 'u1', question_id: 'i2', interaction_type: 'like' }, { user_id: 'u2', question_id: 'other_student_interaction' }],
    attempts: [{ user_id: 'u1', subject: 'accountancy', questions_snapshot: [{ id: 'a_old' }] }, { user_id: 'u1', subject: 'economics', questions_snapshot: [{ id: 'other_subject' }] }, { user_id: 'u2', subject: 'accountancy', questions_snapshot: [{ id: 'other_student_attempt' }] }],
    recovery_sessions: [{ user_id: 'u1', subject: 'accountancy', questions: [{ id: 's_open' }] }, { user_id: 'u2', subject: 'accountancy', questions: [{ id: 'other_student_session' }] }],
  });
  const candidates = ['p1', 'i1', 'i2', 'other_student_progress', 'other_student_interaction', 'fresh'];
  const seen = await s.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: candidates, attempt });
  assert.deepEqual([...seen].sort(), ['a_old', 'i1', 'i2', 'in_this_attempt', 'p1', 's_open']);
  for (const id of ['fresh', 'other_student_progress', 'other_student_interaction', 'other_student_attempt', 'other_student_session']) assert.equal(seen.has(id), false, id);
});

test('never seen: any failing lookup throws, so the caller offers nothing; a table missing in this environment adds nothing', async () => {
  for (const table of ['user_question_progress', 'question_interactions', 'attempts', 'recovery_sessions']) {
    const { store: s } = store({}, { db: { errors: { [table]: { error: { code: 'XX000', message: 'boom' } } } } });
    await assert.rejects(() => s.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: ['a'], attempt }), /unavailable/, table);
  }
  for (const table of ['user_question_progress', 'question_interactions', 'recovery_sessions']) {
    const { store: s } = store({ attempts: [{ user_id: 'u1', subject: 'accountancy', questions_snapshot: [{ id: 'a_old' }] }] }, { db: { errors: { [table]: { error: missingTable } } } });
    const seen = await s.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: ['a'], attempt });
    assert.equal(seen.has('a_old'), true, `${table} missing`);
  }
  // attempts is the one table that must exist: its absence is not tolerated.
  const { store: s } = store({}, { db: { errors: { attempts: { error: missingTable } } } });
  await assert.rejects(() => s.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: ['a'], attempt }));
});

test('never seen: ids are read in chunks of 100, so a big chapter is fully checked', async () => {
  const ids = Array.from({ length: 250 }, (_, i) => `q${i}`);
  const { store: s, db } = store({ user_question_progress: [{ user_id: 'u1', question_id: 'q249' }, { user_id: 'u1', question_id: 'q120' }] });
  const seen = await s.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: ids, attempt });
  assert.equal(seen.has('q249') && seen.has('q120'), true);
  assert.equal(db.log.filter((l) => l.table === 'user_question_progress').length, 3);
});

test('held: open content disputes are excluded, resolved ones are not; a missing table adds nothing; any other failure throws', async () => {
  const tables = { question_content_disputes: [{ question_id: 'a', state: 'open' }, { question_id: 'b', state: 'resolved' }, { question_id: 'c', state: 'open' }] };
  const { store: s } = store(tables);
  assert.deepEqual([...(await s.loadExcluded(['a', 'b', 'x']))].sort(), ['a']);
  const { store: missing } = store({}, { db: { errors: { question_content_disputes: { error: missingTable } } } });
  assert.equal((await missing.loadExcluded(['a'])).size, 0);
  const { store: broken } = store({}, { db: { errors: { question_content_disputes: { error: { code: 'XX000', message: 'boom' } } } } });
  await assert.rejects(() => broken.loadExcluded(['a']), /disputes_unavailable/);
});

test('the publication gate runs on full rows: only what it accepts comes back, and a deleted row never does', async () => {
  const rows = [{ id: 'a', status: 'live' }, { id: 'b', status: 'pending' }, { id: 'c', status: 'live', is_deleted: true }];
  const { store: s } = store({ questions: rows });
  const got = await s.verifyPublished(['a', 'b', 'c']);
  assert.deepEqual([...got.keys()], ['a']);
});

test('candidates: one subject and chapter, not deleted, visible by the practice filter, no heavy evidence columns', async () => {
  const rows = [{ id: 'a', subject: 'accountancy', chapter: 'C', is_deleted: false, score: 0 }, { id: 'b', subject: 'accountancy', chapter: 'Other', is_deleted: false, score: 0 }, { id: 'c', subject: 'accountancy', chapter: 'C', is_deleted: true, score: 0 }, { id: 'd', subject: 'accountancy', chapter: 'C', is_deleted: false, score: -5 }];
  const { store: s, db } = store({ questions: rows });
  assert.deepEqual((await s.loadChapterCandidates({ subject: 'accountancy', chapter: 'C' })).map((r) => r.id), ['a']);
  const q = db.log[0];
  assert.match(q.orExpr, /status\.eq\.live/);
  assert.deepEqual(q.filters.map((f) => f[0]).sort(), ['eq chapter', 'eq is_deleted', 'eq subject', 'gte score']);
});

test('the repair reservation: this student, committed, a repair, this mistake', async () => {
  const tables = { ai_credit_reservations: [
    { user_id: 'u1', state: 'committed', action: 'score_recovery_repair', operation_key: 'repair:M1:req1', receipt: { repair: { rule: 'r' } } },
    { user_id: 'u1', state: 'released', action: 'score_recovery_repair', operation_key: 'repair:M1:req0', receipt: null },
    { user_id: 'u2', state: 'committed', action: 'score_recovery_repair', operation_key: 'repair:M1:req9', receipt: { repair: { rule: 'someone else' } } },
    { user_id: 'u1', state: 'committed', action: 'prepos_mentor', operation_key: 'repair:M1:req5', receipt: {} },
  ] };
  const { store: s } = store(tables);
  assert.equal((await s.findRepairReservation('u1', 'M1')).operation_key, 'repair:M1:req1');
  assert.equal(await s.findRepairReservation('u1', 'M2'), null);
  const { store: broken } = store({}, { db: { errors: { ai_credit_reservations: { error: { code: 'XX000', message: 'boom' } } } } });
  await assert.rejects(() => broken.findRepairReservation('u1', 'M1'), /reservation_unavailable/);
});

test('claim: the first answer is stored on the committed receipt and nothing else about the reservation changes', async () => {
  const row = { user_id: 'u1', state: 'committed', amount: 1, from_included: 1, from_bonus: 0, operation_key: 'op1', receipt: { repair: { rule: 'r' }, model: 'm' } };
  const { store: s, db } = store({ ai_credit_reservations: [row] });
  const won = await s.claimCheck({ operationKey: 'op1', userId: 'u1', check: { checkQuestionId: 'q', right: true } });
  assert.deepEqual(won, { ok: true });
  assert.deepEqual(row.receipt, { repair: { rule: 'r' }, model: 'm', check: { checkQuestionId: 'q', right: true } });
  assert.deepEqual([row.state, row.amount, row.from_included, row.from_bonus], ['committed', 1, 1, 0]);
  const update = db.log.find((l) => l.op === 'update');
  assert.deepEqual(update.filters.map((f) => f[0]).sort(), ['eq operation_key', 'eq state', 'eq user_id', 'is receipt->check']);
  assert.deepEqual(Object.keys(update.patch), ['receipt'], 'only the receipt is written');
  const lost = await s.claimCheck({ operationKey: 'op1', userId: 'u1', check: { checkQuestionId: 'other', right: false } });
  assert.deepEqual(lost, { ok: false, existing: { checkQuestionId: 'q', right: true } });
  assert.equal(row.receipt.check.checkQuestionId, 'q', 'the second answer never overwrites the first');
});

test('claim race: an answer that lands between the read and the write wins, the loser reads it back and overwrites nothing', async () => {
  const row = { user_id: 'u1', state: 'committed', operation_key: 'op1', receipt: { repair: {} } };
  const tables = { ai_credit_reservations: [row] };
  const db = fakeDb(tables);
  const from = db.from.bind(db);
  let intercepted = false;
  db.from = (table) => {
    const q = from(table);
    if (table === 'ai_credit_reservations') {
      const run = q.run.bind(q);
      q.run = () => { if (q.op === 'update' && !intercepted) { intercepted = true; row.receipt = { repair: {}, check: { checkQuestionId: 'winner' } }; } return run(); };
    }
    return q;
  };
  const s = createCheckStore({ db, recordProgress: async () => {} });
  const result = await s.claimCheck({ operationKey: 'op1', userId: 'u1', check: { checkQuestionId: 'loser' } });
  assert.deepEqual(result, { ok: false, existing: { checkQuestionId: 'winner' } });
  assert.equal(row.receipt.check.checkQuestionId, 'winner');
});

test('claim: a missing or foreign receipt, or a failed write, throws so nothing else is written', async () => {
  const { store: none } = store({ ai_credit_reservations: [] });
  await assert.rejects(() => none.claimCheck({ operationKey: 'op1', userId: 'u1', check: {} }), /receipt_unavailable/);
  const { store: foreign } = store({ ai_credit_reservations: [{ user_id: 'u2', state: 'committed', operation_key: 'op1', receipt: { repair: {} } }] });
  await assert.rejects(() => foreign.claimCheck({ operationKey: 'op1', userId: 'u1', check: {} }), /receipt_unavailable/);
  const { store: broken } = store({ ai_credit_reservations: [{ user_id: 'u1', state: 'committed', operation_key: 'op1', receipt: { repair: {} } }] }, { db: { errors: { ai_credit_reservations: { ops: ['update'], error: { code: 'XX000', message: 'boom' } } } } });
  await assert.rejects(() => broken.claimCheck({ operationKey: 'op1', userId: 'u1', check: {} }), /receipt_write_failed/);
});

test('patch: the extras are merged into the stored answer without touching the rest', async () => {
  const row = { user_id: 'u1', state: 'committed', operation_key: 'op1', receipt: { repair: { rule: 'r' }, check: { checkQuestionId: 'q', right: true, revise: null } } };
  const { store: s } = store({ ai_credit_reservations: [row] });
  await s.patchCheck({ operationKey: 'op1', userId: 'u1', patch: { revise: { scheduled: true }, progressRecorded: true } });
  assert.deepEqual(row.receipt, { repair: { rule: 'r' }, check: { checkQuestionId: 'q', right: true, revise: { scheduled: true }, progressRecorded: true } });
});

test('Revise: cards are inserted and an existing card is never reset; the due day comes back; a missing table is skipped without an error', async () => {
  const existing = { user_id: 'u1', question_id: 'q_mistake', box: 3, due_day: '2026-10-25', state: 'active', right_total: 2, key_hash: 'k', wrong_at: null };
  const tables = { revise_cards: [existing] };
  const { store: s, db } = store(tables);
  const rows = [
    { question_id: 'q_mistake', box: 1, due_day: '2026-10-18', state: 'active', right_total: 0, key_hash: 'k', wrong_at: null },
    { question_id: 'q_check', box: 1, due_day: '2026-10-18', state: 'active', right_total: 0, key_hash: 'k2', wrong_at: '2026-10-17T01:00:00.000Z' },
  ];
  const placed = await s.scheduleRevise({ userId: 'u1', rows, dueRowId: 'q_check' });
  assert.deepEqual(placed, { count: 2, dueDay: '2026-10-18' });
  assert.deepEqual(tables.revise_cards.find((c) => c.question_id === 'q_mistake'), existing, 'the box-3 card is untouched');
  assert.equal(tables.revise_cards.length, 2);
  const upsert = db.log.find((l) => l.op === 'upsert');
  assert.deepEqual(upsert.opts, { onConflict: 'user_id,question_id', ignoreDuplicates: true });
  assert.ok(upsert.rows.every((r) => r.user_id === 'u1'));
  assert.equal((await s.scheduleRevise({ userId: 'u1', rows: [rows[0]], dueRowId: 'q_mistake' })).dueDay, '2026-10-25', 'reports the day the existing card is due');
  for (const error of [missingTable, { code: 'PGRST205', message: 'Could not find the table in the schema cache' }]) {
    const { store: m } = store({}, { db: { errors: { revise_cards: { ops: ['upsert'], error } } } });
    assert.equal(await m.scheduleRevise({ userId: 'u1', rows, dueRowId: 'q_check' }), null);
  }
  const { store: broken } = store({}, { db: { errors: { revise_cards: { ops: ['upsert'], error: { code: 'XX000', message: 'boom' } } } } });
  await assert.rejects(() => broken.scheduleRevise({ userId: 'u1', rows, dueRowId: 'q_check' }), /revise_write_failed/);
});

test('progress: the check question is written as one answered question, in its stored option order', async () => {
  const calls = [];
  const { store: s } = store({}, { recordProgress: async (args) => { calls.push(args); } });
  await s.recordProgress({ userId: 'u1', row: { id: 'q9', subject: 'accountancy', chapter: 'C', options: [{ key: 'A', text: 'a' }] }, pickedStored: 2, right: false });
  assert.deepEqual(calls, [{ userId: 'u1', subject: 'accountancy', details: [{ qid: 'q9', givenIndex: 2, isCorrect: false }], questionsSnapshot: [{ id: 'q9', internalSubject: 'accountancy', subject: 'accountancy', chapter: 'C', options: [{ key: 'A', text: 'a' }] }] }]);
});

test('never seen: saved questions, questions shown in a learning episode and questions of a family the student has met are all seen', async () => {
  const { store: s } = store({
    question_bookmarks: [{ user_id: 'u1', question_id: 'saved' }, { user_id: 'u2', question_id: 'other_student_saved' }],
    learning_question_exposure: [{ user_id: 'u1', question_id: 'taught' }, { user_id: 'u2', question_id: 'other_student_taught' }],
    learning_family_exposure: [{ user_id: 'u1', family_id: 'fam_taught' }, { user_id: 'u2', family_id: 'fam_other_student' }],
    user_question_progress: [{ user_id: 'u1', question_id: 'p_member' }],
    attempts: [{ user_id: 'u1', subject: 'accountancy', questions_snapshot: [{ id: 'a_old', familyId: 'fam_attempt' }] }],
  });
  const candidates = [
    { id: 'saved' }, { id: 'taught' }, { id: 'other_student_saved' }, { id: 'other_student_taught' }, { id: 'fresh' },
    { id: 'm_taught', family_id: 'fam_taught' }, { id: 'm_attempt', template_id: 'fam_attempt' }, { id: 'm_ev', ev_family: 'fam_ev' },
    { id: 'p_member', family_id: 'fam_progress' }, { id: 'm_progress', family_id: 'fam_progress' },
    { id: 'm_other_student', family_id: 'fam_other_student' }, { id: 'unrelated', family_id: 'fam_unrelated' },
  ];
  const seen = await s.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: candidates.map((c) => c.id), attempt, candidates });
  for (const id of ['saved', 'taught', 'm_taught', 'm_attempt', 'p_member', 'm_progress', 'a_old']) assert.equal(seen.has(id), true, id);
  for (const id of ['fresh', 'other_student_saved', 'other_student_taught', 'm_other_student', 'm_ev', 'unrelated']) assert.equal(seen.has(id), false, id);
});

test('never seen: the new lookups fail closed too, and a table missing in this environment adds nothing', async () => {
  for (const table of ['question_bookmarks', 'learning_question_exposure', 'learning_family_exposure']) {
    const { store: broken } = store({}, { db: { errors: { [table]: { error: { code: 'XX000', message: 'boom' } } } } });
    await assert.rejects(() => broken.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: ['a'], attempt }), /unavailable/, table);
    const { store: missing } = store({ attempts: [{ user_id: 'u1', subject: 'accountancy', questions_snapshot: [{ id: 'a_old' }] }] }, { db: { errors: { [table]: { error: missingTable } } } });
    assert.equal((await missing.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: ['a'], attempt })).has('a_old'), true, `${table} missing`);
  }
});

test('never seen: interactions are append-only, so every page is read (a cap would let a seen question through)', async () => {
  const rows = Array.from({ length: 1200 }, (_, i) => ({ id: i, user_id: 'u1', question_id: i < 1100 ? 'busy' : 'late', interaction_type: 'seen' }));
  const { store: s } = store({ question_interactions: rows });
  const seen = await s.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: ['busy', 'late', 'fresh'], attempt });
  assert.equal(seen.has('busy') && seen.has('late'), true);
  assert.equal(seen.has('fresh'), false);
});
