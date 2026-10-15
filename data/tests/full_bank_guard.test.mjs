import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertFullBankRead, fullBankReadAllowed, fullBankReadBlockedLine, FullBankReadBlocked, isFullBankReadBlocked,
} from '../full_bank_guard.js';

test('whole-bank reads are allowed only on Vercel production', () => {
  assert.equal(fullBankReadAllowed({ VERCEL_ENV: 'production' }), true);
  for (const env of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }, {}, { VERCEL_ENV: 'Production' }, { NODE_ENV: 'production' }, { VERCEL: '1' }]) {
    assert.equal(fullBankReadAllowed(env), false, JSON.stringify(env));
  }
});

test('production passes silently; anywhere else logs one clear line and throws before any read', () => {
  const lines = [];
  const log = line => lines.push(line);
  assert.equal(assertFullBankRead('the inventory refresh', { env: { VERCEL_ENV: 'production' }, log }), undefined);
  assert.equal(lines.length, 0);

  for (const [env, shown] of [[{ VERCEL_ENV: 'preview' }, 'preview'], [{ VERCEL_ENV: 'development' }, 'development'], [{}, 'unset']]) {
    lines.length = 0;
    let thrown;
    try { assertFullBankRead('the inventory refresh', { env, log }); } catch (error) { thrown = error; }
    assert.ok(thrown instanceof FullBankReadBlocked);
    assert.equal(thrown.code, 'FULL_BANK_READ_BLOCKED');
    assert.equal(thrown.purpose, 'the inventory refresh');
    assert.equal(isFullBankReadBlocked(thrown), true);
    assert.equal(lines.length, 1);
    assert.equal(lines[0], fullBankReadBlockedLine('the inventory refresh', env));
    assert.match(lines[0], new RegExp(`^\\[full-bank-read\\] blocked: the inventory refresh .*VERCEL_ENV=${shown}\\). Serving the stored counts instead\\.$`));
  }
  assert.equal(isFullBankReadBlocked(new Error('INVENTORY_UNAVAILABLE')), false);
  assert.equal(isFullBankReadBlocked(null), false);
});

test('the guard defaults to the real environment, as the server uses it', () => {
  const saved = process.env.VERCEL_ENV;
  try {
    delete process.env.VERCEL_ENV;
    assert.throws(() => assertFullBankRead('a test read', { log: () => {} }), FullBankReadBlocked);
    process.env.VERCEL_ENV = 'production';
    assert.doesNotThrow(() => assertFullBankRead('a test read', { log: () => {} }));
  } finally {
    if (saved === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = saved;
  }
});

test('the unfiltered Database.getAllQuestions read is guarded too', () => {
  const db = readFileSync(new URL('../db.js', import.meta.url), 'utf8');
  const start = db.indexOf('async getAllQuestions()');
  const method = db.slice(start, db.indexOf('async getPendingQuestions()'));
  assert.ok(start >= 0);
  assert.ok(method.indexOf("assertFullBankRead('Database.getAllQuestions')") < method.indexOf(".from('questions')"));
});
