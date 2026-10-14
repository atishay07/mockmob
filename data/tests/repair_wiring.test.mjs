import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseExpiredAiCredits } from '../../src/services/credits/releaseExpired.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('the daily sweep asks the database to release up to 100 expired AI reservations and never throws', async () => {
  const seen = [];
  const db = { rpc: async (name, args) => { seen.push([name, args]); return { data: 3, error: null }; } };
  assert.deepEqual(await releaseExpiredAiCredits(db, 100), { ok: true, released: 3 });
  assert.deepEqual(seen, [['mm_ai_release_expired', { p_limit: 100 }]]);
  assert.deepEqual(await releaseExpiredAiCredits({ rpc: async () => ({ data: null, error: { message: 'no such function' } }) }), { ok: false, released: 0 });
  assert.deepEqual(await releaseExpiredAiCredits({ rpc: async () => { throw new Error('network'); } }), { ok: false, released: 0 });
  assert.deepEqual(await releaseExpiredAiCredits({ rpc: async () => ({ data: 0, error: null }) }), { ok: true, released: 0 });
});

test('the repair route allows 90 s (owner decision D1: Hobby with Fluid compute) and passes its start time on', () => {
  const route = read('src/app/api/recovery/repair/route.js');
  assert.match(route, /^export const maxDuration = 90;$/m);
  assert.match(route, /D1/);
  assert.match(route, /const startedAt = Date\.now\(\);/);
  assert.match(route, /repairMistake\(\{[^}]*startedAt \}\)/);
});

test('the existing daily cron route sweeps expired AI credits first, in its own guard, and reports the count', () => {
  const route = read('src/app/api/internal/finalise-sessions/route.js');
  assert.match(route, /import \{ releaseExpiredAiCredits \} from '@\/services\/credits\/releaseExpired';/);
  assert.match(route, /releaseExpiredAiCredits\(supabaseAdmin\(\), 100\)/);
  assert.ok(route.indexOf('releaseExpiredAiCredits(supabaseAdmin()') < route.indexOf('finaliseExpiredSessions('), 'the sweep runs before the finalisation, so a slow finalisation cannot starve it');
  assert.match(route, /aiCreditsReleased/);
  const cron = JSON.parse(read('vercel.json')).crons.map((c) => c.path);
  assert.ok(cron.includes('/api/internal/finalise-sessions'), 'the route is on a Vercel cron');
});

test('the OpenAI clients have a finite default timeout and every call passes the SDK `timeout` option', () => {
  const providers = read('src/services/ai/providers.js');
  assert.match(providers, /new OpenAI\(\{ apiKey, maxRetries: 0, timeout: DEFAULT_TIMEOUT_MS \}\)/);
  assert.match(providers, /DEFAULT_TIMEOUT_MS = [^;]*45_000/);
  const core = read('src/services/ai/providerCore.js');
  assert.match(core, /client\.chat\.completions\.create\(body, timeoutMs \? \{ timeout: timeoutMs \} : undefined\)/);
  assert.match(core, /client\.messages\.create\(body, timeoutMs \? \{ timeout: timeoutMs \} : undefined\)/);
});

test('Mistake Repair is wired to Luna first and Haiku 5.5 as the one fallback, with no model-routing change', () => {
  const service = read('src/services/recovery/mistakeRepair.js');
  assert.match(service, /REPAIR_ROUTE = Object\.freeze\(\{ provider: 'openai', model: process\.env\.AI_REPAIR_MODEL \|\| 'gpt-6-luna' \}\)/);
  assert.match(service, /REPAIR_EFFORT = Object\.freeze\(\{ repair: 'low', secondOpinion: 'high' \}\)/);
  assert.match(service, /provider: 'anthropic', model: process\.env\.AI_REPAIR_FALLBACK_MODEL \|\| 'claude-haiku-5-5', reasoningEffort: 'low'/);
  assert.match(service, /fallbackRoute: REPAIR_FALLBACK_ROUTE/);
  assert.doesNotMatch(service, /temperature/);
});

test('the migration for the Haiku price row is saved, not applied, and prices it at 0.10 / 0.50', () => {
  const sql = read('supabase/migrations/20261014120000_runtime_ai_price_claude_haiku_5_5.sql');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /\('anthropic','claude-haiku-5-5',0\.10,0\.50,/);
});
