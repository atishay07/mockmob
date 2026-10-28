import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { installTemporaryOwnerBudgetCaps } from '../lib/temporaryOwnerBudgetGuard.mjs';

const execFileAsync = promisify(execFile);
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'owner-budget-')), path = join(dir, 'ledger.sqlite');
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE requests(id TEXT PRIMARY KEY, reserved INTEGER NOT NULL, actual INTEGER, state TEXT NOT NULL, owner_pid INTEGER);
    CREATE TABLE budget(id INTEGER PRIMARY KEY, limit_micro INTEGER NOT NULL);
    INSERT INTO budget VALUES(1,50000000);`);
  return { dir, path, db };
}

test('owner cap accounts actual settled cost and maximum held reservations; failed insert leaves no row', () => {
  const { dir, db } = setup();
  try {
    installTemporaryOwnerBudgetCaps(db, [{ owner_pid: 101, cap_micro: 1_500_000 }]);
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run('settled', 900_000, 200_000, 'settled', 101);
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run('held', 600_000, 500_000, 'unresolved', 101);
    // Committed baseline = settled actual 0.2M + unresolved max(reserved, actual) 0.6M.
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run('fits', 700_000, null, 'reserved', 101);
    assert.throws(() => db.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run('over', 1, null, 'reserved', 101), /campaign_budget_exhausted/);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM requests WHERE id='over'").get().n, 0);
    // This emergency gate is limited to named processes; it leaves the global cap unchanged.
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run('other-owner', 49_000_000, null, 'reserved', 202);
    assert.equal(db.prepare('SELECT limit_micro FROM budget WHERE id=1').get().limit_micro, 50_000_000);
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('per-owner limits survive reopen and removing one scope does not remove another', () => {
  const { dir, path, db } = setup();
  try {
    installTemporaryOwnerBudgetCaps(db, [{ owner_pid: 101, cap_micro: 1_000_000 }, { owner_pid: 202, cap_micro: 2_000_000 }]);
    db.close();
    const reopened = new DatabaseSync(path);
    try {
      assert.throws(() => reopened.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run('over-101', 1_000_001, null, 'reserved', 101), /campaign_budget_exhausted/);
      reopened.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run('fits-202', 1_500_000, null, 'reserved', 202);
      reopened.prepare('DELETE FROM temporary_owner_budget_caps WHERE owner_pid=101').run();
      reopened.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run('unscoped-101', 50_000_000, null, 'reserved', 101);
      assert.throws(() => reopened.prepare('INSERT INTO requests VALUES(?,?,?,?,?)').run('over-202', 500_001, null, 'reserved', 202), /campaign_budget_exhausted/);
    } finally { reopened.close(); }
  } finally { try { db.close(); } catch {} rmSync(dir, { recursive: true, force: true }); }
});

test('drain cap blocks only future reservations while held accepted work can settle without history deletion', () => {
  const { dir, db } = setup();
  try {
    db.exec('ALTER TABLE requests ADD COLUMN receipt_json TEXT');
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?)').run('accepted-openai-1', 800, null, 'reserved', 6916, null);
    db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?)').run('accepted-gemini-2', 700, null, 'reserved', 6916, null);
    const before = db.prepare('SELECT id,reserved,actual,state,owner_pid FROM requests WHERE owner_pid=? ORDER BY id').all(6916);
    assert.deepEqual(before.map(row => row.id), ['accepted-gemini-2', 'accepted-openai-1']);

    installTemporaryOwnerBudgetCaps(db, [{ owner_pid: 6916, cap_micro: 9_000_000 }, { owner_pid: 37712, cap_micro: 6_000_000 }]);
    assert.equal(db.prepare('SELECT cap_micro FROM temporary_owner_budget_caps WHERE owner_pid=6916').get().cap_micro, 9_000_000);
    installTemporaryOwnerBudgetCaps(db, [{ owner_pid: 6916, cap_micro: 1 }]);
    assert.throws(() => db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?)').run('new-reservation', 1, null, 'reserved', 6916, null), /campaign_budget_exhausted/);

    // Settlement updates remain available to accepted requests after the cap is installed.
    const openaiReceipt = { provider_request_id: 'provider-1', usage: { prompt_tokens: 12, completion_tokens: 8 } };
    const geminiReceipt = { provider_request_id: 'provider-2', usage: { prompt_tokens: 9, completion_tokens: 6 } };
    db.prepare("UPDATE requests SET actual=?,state='settled',receipt_json=? WHERE id=?").run(230, JSON.stringify(openaiReceipt), 'accepted-openai-1');
    db.prepare("UPDATE requests SET actual=?,state='settled',receipt_json=? WHERE id=?").run(190, JSON.stringify(geminiReceipt), 'accepted-gemini-2');
    const after = db.prepare('SELECT id,reserved,actual,state,owner_pid FROM requests WHERE owner_pid=? ORDER BY id').all(6916);
    assert.deepEqual(after.map(row => row.id), before.map(row => row.id));
    assert.deepEqual(after.map(({ id, actual, state }) => ({ id, actual, state })), [
      { id: 'accepted-gemini-2', actual: 190, state: 'settled' },
      { id: 'accepted-openai-1', actual: 230, state: 'settled' },
    ]);
    assert.deepEqual(JSON.parse(db.prepare('SELECT receipt_json FROM requests WHERE id=?').get('accepted-openai-1').receipt_json), openaiReceipt);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM requests WHERE id='new-reservation'").get().n, 0);
    assert.equal(db.prepare('SELECT cap_micro FROM temporary_owner_budget_caps WHERE owner_pid=6916').get().cap_micro, 1);
    assert.equal(db.prepare('SELECT cap_micro FROM temporary_owner_budget_caps WHERE owner_pid=37712').get().cap_micro, 6_000_000);
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('SQLite reservation trigger serializes competing connections at the cap boundary', async () => {
  const { dir, path, db } = setup();
  try {
    installTemporaryOwnerBudgetCaps(db, [{ owner_pid: 303, cap_micro: 1_000_000 }]); db.close();
    const script = `import {DatabaseSync} from 'node:sqlite'; const d=new DatabaseSync(process.argv[1]); d.exec('PRAGMA busy_timeout=10000'); try { d.exec('BEGIN IMMEDIATE'); d.prepare("INSERT INTO requests VALUES(?,?,?,?,?)").run('req-'+process.pid,650000,null,'reserved',303); d.exec('COMMIT'); console.log('reserved'); } catch(e) { try{d.exec('ROLLBACK')}catch{}; console.log(e.message.includes('campaign_budget_exhausted')?'capped':'error:'+e.message); process.exitCode=e.message.includes('campaign_budget_exhausted')?0:1; } finally{d.close()}`;
    const outcomes = await Promise.all([1, 2].map(() => execFileAsync(process.execPath, ['--input-type=module', '-e', script, path])));
    assert.deepEqual(outcomes.map(r => r.stdout.trim()).sort(), ['capped', 'reserved']);
    const check = new DatabaseSync(path);
    try { assert.equal(check.prepare('SELECT COUNT(*) n FROM requests WHERE owner_pid=303').get().n, 1); }
    finally { check.close(); }
  } finally { try { db.close(); } catch {} rmSync(dir, { recursive: true, force: true }); }
});
