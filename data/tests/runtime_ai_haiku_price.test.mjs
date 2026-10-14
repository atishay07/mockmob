import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { classifyGuardMessage } from '../../src/services/ai/providerCore.js';

// The Haiku 5.5 price row (owner decision D2) and the guard's real exception text, on an in-memory copy of the
// migrations. Nothing here touches production.
const migration = (name) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

test('the runtime guard refuses claude-haiku-5-5 until its price row is applied, then prices it at 0.10 / 0.50', async () => {
  const db = new PGlite();
  const q = (sql, params) => db.query(sql, params).then((r) => r.rows);
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int, reason text, feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(), wallet_source text, balance_after int, idempotency_key text);`);
    for (const file of ['20261002121000_runtime_ai_guard.sql', '20261004120000_runtime_ai_monthly_cap.sql']) await db.exec(migration(file));
    const reserve = (key, model = 'claude-haiku-5-5', input = 4000, output = 3450) => q('select reserve_runtime_ai($1,$2,$3,$4,$5) v', [key, 'anthropic', model, input, output]);

    // Before the row exists the guard stops the call, and the stop is classified as a price gap (not a quota or cap).
    await assert.rejects(reserve('key_haiku_before'), (error) => { assert.equal(classifyGuardMessage(error.message), 'price'); return true; });

    await db.exec(migration('20261014120000_runtime_ai_price_claude_haiku_5_5.sql'));
    const prices = await q("select input_per_million::float8 i, output_per_million::float8 o from runtime_ai_prices where provider='anthropic' and model='claude-haiku-5-5'");
    assert.deepEqual(prices, [{ i: 0.1, o: 0.5 }]);
    await q("update runtime_ai_budget set funded_usd = 1 where id = 'student_ai'");
    const first = (await reserve('key_haiku_after'))[0].v;
    assert.equal(first.dispatch, true);
    assert.ok(Math.abs(first.reserved - (4000 * 0.1 + 3450 * 0.5) / 1_000_000) < 1e-12, 'booked at the Haiku 5.5 rate');
    assert.equal((await reserve('key_haiku_after'))[0].v.dispatch, false, 'a retried key never dispatches twice');
    // Haiku 4.5 keeps its own, dearer row.
    assert.equal(Number((await q("select input_per_million from runtime_ai_prices where model='claude-haiku-4-5'"))[0].input_per_million), 1);

    // The other two guard stops, as the real SQL words them.
    await q("update runtime_ai_budget set monthly_cap_usd = 0.0000001 where id = 'student_ai'");
    await assert.rejects(reserve('key_haiku_cap'), (error) => { assert.equal(classifyGuardMessage(error.message), 'budget'); return true; });
    await q("update runtime_ai_budget set paused = true where id = 'student_ai'");
    await assert.rejects(reserve('key_haiku_paused'), (error) => { assert.equal(classifyGuardMessage(error.message), 'guard_paused'); return true; });
  } finally { await db.close(); }
});
