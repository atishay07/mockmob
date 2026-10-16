// /api/me/playbook and /api/me/rules (src/lib/server/playbook.js, src/lib/server/ruleBook.js; spec
// tmp/mistake-lab-v4/SPEC.md 4.10, 4.12): server validation, one rule in force per student, idempotent writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePlaybookBody, parseSubject, postPlaybook, playbookBody, rulesBody, PLAYBOOK_COPY } from '../../src/lib/server/playbook.js';
import { repairRulesFrom, writeRule } from '../../src/lib/server/ruleBook.js';
import { HABIT_TEXT, strategyFor } from '../rule_book.js';
import { S3 } from '../../scripts/mistake-lab/build-s3-fixtures.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { USER, T0, DAY, M1, M2, M3, M4, PRACTICE, RESERVATIONS, PLAYBOOK } = S3;
const HISTORY = [M4, PRACTICE, M3, M2, M1];
const SOURCES = { repairs: repairRulesFrom({ userId: USER, reservations: RESERVATIONS, attempts: HISTORY }), playbook: PLAYBOOK };

function recorder() {
  const calls = [];
  const write = async (rule, opts) => { calls.push({ rule, opts }); return { id: rule.id, kind: rule.kind, text: rule.text, since: '2026-10-16T00:00:00.000Z' }; };
  return { calls, write };
}

test('the POST body is exactly { ruleId } with a valid id', () => {
  for (const bad of [null, 'habit:changes', [], {}, { ruleId: 7 }, { ruleId: 'habit:changes', extra: 1 }, { rule: 'habit:changes' }]) {
    assert.equal(parsePlaybookBody(bad).error, PLAYBOOK_COPY.badBody, JSON.stringify(bad));
  }
  for (const bad of ['habit:nap', 'repair:123', 'rule:habit:changes', '']) assert.equal(parsePlaybookBody({ ruleId: bad }).error, PLAYBOOK_COPY.badRule, bad);
  assert.deepEqual(parsePlaybookBody({ ruleId: 'habit:never_opened' }), { ruleId: 'habit:never_opened' });
  assert.equal(parseSubject(null), null);
  assert.equal(parseSubject('accountancy'), 'accountancy');
  assert.equal(parseSubject('Accountancy; drop'), undefined);
});

test('POST keeps a rule from the student\'s own book, anchored to their newest attempt', async () => {
  const { calls, write } = recorder();
  const out = await postPlaybook({ body: { ruleId: 'habit:long_stay' }, attempts: HISTORY, sources: SOURCES, write });
  assert.equal(out.status, 200);
  assert.deepEqual(out.body.active, { id: 'habit:long_stay', kind: 'habit', text: HABIT_TEXT.long_stay, since: '2026-10-16T00:00:00.000Z' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.anchorAttemptId, 'm4', 'the newest attempt');
  assert.equal(calls[0].rule.text, HABIT_TEXT.long_stay, 'the words come from the server\'s book, never the client');
});

test('POST refuses what is not in the book: a repair of someone else, habits before 3 mocks, no attempts', async () => {
  const { calls, write } = recorder();
  const notMine = await postPlaybook({ body: { ruleId: 'repair:0123456789abcdef01234567' }, attempts: HISTORY, sources: SOURCES, write });
  assert.deepEqual([notMine.status, notMine.body.message], [422, PLAYBOOK_COPY.notInBook]);
  const early = await postPlaybook({ body: { ruleId: 'habit:changes' }, attempts: [M1], sources: { repairs: [], playbook: [] }, write });
  assert.deepEqual([early.status, early.body.message], [422, PLAYBOOK_COPY.notInBook]);
  const none = await postPlaybook({ body: { ruleId: 'habit:changes' }, attempts: [], sources: { repairs: [], playbook: [] }, write });
  assert.deepEqual([none.status, none.body.message], [422, PLAYBOOK_COPY.noAttempt]);
  const bad = await postPlaybook({ body: { ruleId: 'habit:changes', note: 'x' }, attempts: HISTORY, sources: SOURCES, write });
  assert.equal(bad.status, 422);
  assert.equal(calls.length, 0, 'nothing is written on a refusal');
});

test('POST is idempotent: the rule already in force for this stretch is not written again', async () => {
  const { calls, write } = recorder();
  const same = await postPlaybook({ body: { ruleId: 'habit:never_opened' }, attempts: HISTORY, sources: SOURCES, write });
  assert.equal(same.status, 200);
  assert.deepEqual(same.body.active, { id: 'habit:never_opened', kind: 'habit', text: HABIT_TEXT.never_opened, since: new Date(T0 + 5 * DAY).toISOString() });
  assert.equal(calls.length, 0);
  // After a newer paper the same rule is a new choice for the new stretch.
  const newer = { ...PRACTICE, id: 'p2', completedAt: T0 + 7 * DAY };
  await postPlaybook({ body: { ruleId: 'habit:never_opened' }, attempts: [newer, ...HISTORY], sources: SOURCES, write });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.anchorAttemptId, 'p2');
});

test('a repair rule can be chosen, with the words of its receipt', async () => {
  const { calls, write } = recorder();
  const id = `repair:${SOURCES.repairs.find((r) => r.chapter === 'Share Capital').id}`;
  const out = await postPlaybook({ body: { ruleId: id }, attempts: HISTORY, sources: SOURCES, write });
  assert.equal(out.status, 200);
  assert.equal(calls[0].rule.text, 'Calls in arrears are deducted from called-up capital, never added.');
});

test('writeRule upserts one active row for the stretch, then retires every other rule row of the student', async () => {
  const log = [];
  const chain = (name) => {
    const q = { name, ops: [] };
    const self = new Proxy({}, {
      get: (_, op) => {
        if (op === 'then') return (resolveFn) => resolveFn(q.name === 'upsert' ? { data: { id: 41 }, error: null } : { data: null, error: null });
        return (...args) => { q.ops.push([op, ...args]); return self; };
      },
    });
    log.push(q);
    return self;
  };
  const db = { from: (table) => { assert.equal(table, 'recovery_playbook'); return { upsert: (...a) => { const c = chain('upsert'); log.at(-1).ops.push(['upsert', ...a]); return c; }, update: (...a) => { const c = chain('update'); log.at(-1).ops.push(['update', ...a]); return c; } }; } };
  const active = await writeRule(USER, { id: 'habit:changes', kind: 'habit', text: HABIT_TEXT.changes }, { anchorAttemptId: 'm4', db, now: Date.UTC(2026, 9, 16) });
  assert.deepEqual(active, { id: 'habit:changes', kind: 'habit', text: HABIT_TEXT.changes, since: '2026-10-16T00:00:00.000Z' });
  const up = log[0].ops.find((o) => o[0] === 'upsert');
  assert.deepEqual(up[1], { user_id: USER, attempt_id: 'm4', strategy: strategyFor('habit:changes'), reflection: HABIT_TEXT.changes, evidence_state: 'active', created_at: '2026-10-16T00:00:00.000Z' });
  assert.deepEqual(up[2], { onConflict: 'user_id,attempt_id,strategy' });
  const retire = log[1].ops;
  assert.deepEqual(retire[0], ['update', { evidence_state: 'retired' }]);
  assert.ok(retire.some((o) => o[0] === 'neq' && o[1] === 'id' && o[2] === 41), 'the new row is never retired');
  assert.ok(retire.some((o) => o[0] === 'eq' && o[1] === 'user_id' && o[2] === USER), 'only this student');
  assert.ok(retire.some((o) => o[0] === 'like' && o[1] === 'strategy' && o[2] === 'rule:%'), 'only rule rows, never the old notes');
  await assert.rejects(writeRule(USER, { id: 'habit:changes', kind: 'habit', text: 'x' }, { anchorAttemptId: null, db }), /NO_ATTEMPT/);
});

test('GET bodies: the rule in force with the start sheet strings; the Rule book with Across your mocks', () => {
  const pb = playbookBody({ attempts: HISTORY, sources: SOURCES });
  assert.equal(pb.active.id, 'habit:never_opened');
  assert.equal(pb.startSheet.rule, 'Your rule for this mock: open every question once before you go deep on any.');
  assert.deepEqual(playbookBody({ attempts: HISTORY, sources: { repairs: [], playbook: [] } }), { active: null, startSheet: null });
  const rb = rulesBody({ attempts: HISTORY, sources: SOURCES });
  assert.equal(rb.book.countLabel, 'Your rules (7)');
  assert.equal(rb.acrossMocks.state, 'ready');
});

test('the routes authenticate with auth(request), refuse bad input, and rate-limit the write', () => {
  const pb = readFileSync(resolve(root, 'src/app/api/me/playbook/route.js'), 'utf8');
  const rules = readFileSync(resolve(root, 'src/app/api/me/rules/route.js'), 'utf8');
  for (const [src, methods] of [[pb, ['GET', 'POST']], [rules, ['GET']]]) {
    for (const m of methods) assert.match(src, new RegExp(`export async function ${m}[(]request`));
    assert.match(src, /\bauth\(request\)/);
    assert.match(src, /status: 401/);
    assert.match(src, /'Cache-Control': 'no-store'/);
  }
  assert.match(pb, /checkRateLimit\(request, \{ route: '\/api\/me\/playbook'/);
  // The old note list leaves the rule rows out.
  const recovery = readFileSync(resolve(root, 'src/app/api/recovery/route.js'), 'utf8');
  assert.match(recovery, /\.not\('strategy','like','rule:%'\)/);
});
