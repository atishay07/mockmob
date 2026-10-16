import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readablePracticeQuestions } from '../practice_library.js';
import { eligibilitySnapshot, publicationEligibility } from '../evidence_registry.js';
import { INVENTORY_COLUMNS, INVENTORY_SELECT, countInventory, readInventoryRows } from '../inventory_count.js';
import { ALL_COLUMNS, buildBank, fakeDb, bytesOf, setFixtureSecret } from './helpers/egress_fixtures.mjs';

// Egress item 2 (16 Oct 2026): the daily inventory count reads 22 columns of the visible rows instead of
// every column of every row. The "before" below is the code of src/lib/server/inventory.js at commit
// 4db57fc5, copied verbatim apart from the database being a parameter. Software fixtures; they do not
// establish academic reliability.
const restore = setFixtureSecret();
after(restore);
const FIXED = () => new Date('2026-10-16T00:00:00.000Z');

async function countBefore(db) {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from('questions').select('*').eq('is_deleted', false).order('id').range(start, start + 999);
    if (error) throw new Error('INVENTORY_UNAVAILABLE');
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const visible = rows.filter(q => q.status === 'live' || (q.verification_state === 'verified' && q.exploration_state === 'active'));
  const eligible = await readablePracticeQuestions(visible, db, { requireEvidence: false });
  const subjectCounts = {}, recoverySubjectCounts = {};
  const snapshot = eligible.length ? eligibilitySnapshot() : undefined;
  for (const q of eligible) {
    subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;
    if (publicationEligibility(q, snapshot).eligible) recoverySubjectCounts[q.subject] = (recoverySubjectCounts[q.subject] || 0) + 1;
  }
  return { state: 'available', bankSize: eligible.length, subjectCounts, recoverySubjectCounts, recoveryEligible: Object.values(recoverySubjectCounts).reduce((a,b)=>a+b,0), checkedAt: FIXED().toISOString() };
}

const holdsFor = (rows) => rows.filter((r) => r.family_id).filter((_, i) => i % 11 === 0).map((r) => ({ family_id: r.family_id }));
const strip = ({ note, ...rest }) => rest;

test('the inventory column list is real columns, with the two signed records and no duplicates', () => {
  assert.equal(new Set(INVENTORY_COLUMNS).size, INVENTORY_COLUMNS.length);
  for (const column of INVENTORY_COLUMNS) assert.ok(ALL_COLUMNS.includes(column), column);
  assert.ok(INVENTORY_COLUMNS.includes('evidence') && INVENTORY_COLUMNS.includes('provenance'));
  assert.equal(INVENTORY_SELECT.split(',').length, 22);
});

test('the count is identical before and after over generated banks (including held families and broken records)', async () => {
  let counted = 0;
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
    const bank = buildBank(seed);
    const tables = { questions: bank, recovery_family_holds: holdsFor(bank) };
    const before = await countBefore(fakeDb(tables, { strict: false }));
    // strict: any read of a column that is not in the select throws, so a hidden dependency fails loudly.
    const after = await countInventory(await readInventoryRows(fakeDb(tables, { strict: true })), fakeDb(tables, { strict: true }), { now: FIXED });
    assert.deepEqual(strip(after), before, `seed ${seed}`);
    counted += before.bankSize;
    assert.ok(before.recoveryEligible > 0, 'fixtures include evidence-eligible rows');
  }
  assert.ok(counted > 500);
});

test('the count does not change when every unselected column holds different values', async () => {
  const bank = buildBank(77);
  const scrambled = bank.map((row) => {
    const copy = structuredClone(row);
    for (const column of ALL_COLUMNS) {
      if (INVENTORY_COLUMNS.includes(column)) continue;
      copy[column] = typeof copy[column] === 'number' ? copy[column] + 9 : copy[column] === null ? 'junk' : Array.isArray(copy[column]) ? ['z'] : typeof copy[column] === 'string' ? 'zzz' : copy[column];
    }
    return copy;
  });
  const run = async (rows) => { const tables = { questions: rows, recovery_family_holds: holdsFor(rows) }; return countInventory(await readInventoryRows(fakeDb(tables)), fakeDb(tables), { now: FIXED }); };
  assert.deepEqual(await run(scrambled), await run(bank));
});

test('rows the count would drop anyway are not read, and pages stay 1000 rows', async () => {
  const bank = buildBank(9, { legacy: 2300, managed: 14 });
  const db = fakeDb({ questions: bank, recovery_family_holds: [] });
  const rows = await readInventoryRows(db);
  const visibleLive = bank.filter((r) => !r.is_deleted && (r.status === 'live' || (r.verification_state === 'verified' && r.exploration_state === 'active')));
  assert.equal(rows.length, visibleLive.length);
  assert.ok(db.calls.every((c) => c.select === INVENTORY_SELECT));
  assert.ok(db.calls.length >= 2 && db.calls.slice(0, -1).every((c) => c.rows === 1000));
});

test('bytes: the narrow visible read moves a fraction of what select(*) did over the same bank', async () => {
  const bank = buildBank(4, { legacy: 600, managed: 60 });
  const tables = { questions: bank };
  const before = fakeDb(tables, { strict: false });
  await countBefore(before);
  const after = fakeDb(tables);
  await readInventoryRows(after);
  const beforeBytes = before.calls.filter((c) => c.table === 'questions').reduce((n, c) => n + c.bytes, 0);
  const afterBytes = after.calls.filter((c) => c.table === 'questions').reduce((n, c) => n + c.bytes, 0);
  assert.ok(afterBytes < beforeBytes, `${afterBytes} < ${beforeBytes}`);
  // The signed records are still read for every row that has one: they are most of the bytes of an evidence row.
  const evidenceBytes = bank.filter((r) => r.evidence && !r.is_deleted).reduce((n, r) => n + bytesOf(r.evidence), 0);
  assert.ok(afterBytes >= evidenceBytes * 0.8);
});

test('a read error stops the count (INVENTORY_UNAVAILABLE), as before', async () => {
  const failing = { from: () => ({ select: () => ({ eq: () => ({ or: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: 'down' } }) }) }) }) }) }) };
  await assert.rejects(readInventoryRows(failing), /INVENTORY_UNAVAILABLE/);
});
