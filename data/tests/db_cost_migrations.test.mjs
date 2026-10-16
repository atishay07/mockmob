import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const fnBody = sql => sql.slice(sql.indexOf('create or replace function public.mm_ai_consume_credits'), sql.lastIndexOf('$function$;'));
const squash = s => s.replace(/\s+/g, ' ').trim();

test('credit fast path keeps every guard, the one wallet lock, one wallet update and one ledger insert', () => {
  const up = read('supabase/migrations/20261016160000_credit_consume_fast_path.sql');
  const down = read('supabase/undo/20261016160000_credit_consume_fast_path.undo.sql');
  const fast = squash(fnBody(up));
  const old = squash(fnBody(down));
  for (const text of [fast, old]) {
    assert.match(text, /'missing_user'/);
    assert.match(text, /'invalid_amount'/);
    assert.match(text, /'insufficient_ai_credits'/);
    assert.match(text, /'wallet_not_found'/);
    assert.equal((text.match(/insert into public\.ai_credit_ledger/g) || []).length, 1);
    assert.equal((text.match(/update public\.ai_credit_wallets/g) || []).length, 2, 'rollover update and spend update');
    assert.match(text, /for update/);
  }
  // Same signature and return contract in both directions.
  const head = t => t.slice(0, t.indexOf('begin'));
  assert.equal(head(fast), head(old));
  // The idempotency check stays first, before any wallet read or write.
  assert.ok(fast.indexOf('ai_credit_ledger where idempotency_key') < fast.indexOf('ai_credit_wallets where user_id'));
  // The fast path locks the wallet before it ever tries to insert one.
  assert.ok(fast.indexOf('ai_credit_wallets where user_id') < fast.indexOf('insert into public.ai_credit_wallets'));
  assert.match(fast, /on conflict \(user_id\) do nothing/);
  // Undo recreates the dropped indexes.
  assert.match(down, /ai_credit_ledger_reference_idx/);
  assert.match(down, /ai_credit_wallets_reset_idx/);
});

test('leaderboard function is service-role only and the app falls back only when it is missing', () => {
  const sql = read('supabase/migrations/20261016160100_leaderboard_group_by.sql');
  assert.match(sql, /group by a\.user_id, u\.name, u\.image/);
  assert.match(sql, /revoke all on function public\.mm_leaderboard\(\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.mm_leaderboard\(\) to service_role/);
  const db = read('data/db.js');
  const start = db.indexOf('async getLeaderboard()');
  const body = db.slice(start, db.indexOf('\n  },', start));
  assert.match(body, /rpc\('mm_leaderboard'\)/);
  assert.match(body, /if \(!missing\) throw rankedError/);
});

test('the payload trim is its own file, touches only published jobs and says what it deletes', () => {
  const sql = read('supabase/optional/20261016160200_trim_finished_factory_job_payloads.sql');
  const statements = sql.replace(/^--.*$/gm, '').trim().split(';').filter(s => s.trim());
  assert.equal(statements.length, 1);
  assert.match(statements[0], /set generation_brief = null, candidate = null/);
  assert.match(statements[0], /state = 'published'/);
  assert.match(sql, /DESTRUCTIVE/);
});
