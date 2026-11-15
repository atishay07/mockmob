// L7 and L10 (15 Nov 2026), decision 5: every /api/ai and /api/mobi route, Today and Learn answer their rate limit before any
// database read; mentor/local stores a mode from the known set only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENTOR_MODES, savedModeOf, AI_ROUTE_LIMITS, aiLimit } from '../../src/services/ai/mentorModes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const routesUnder = (dir) => readdirSync(path.join(ROOT, dir)).flatMap((name) => {
  const rel = `${dir}/${name}`;
  return statSync(path.join(ROOT, rel)).isDirectory() ? routesUnder(rel) : name === 'route.js' ? [rel] : [];
});

test('L10: mentor/local stores only a known mode; the set is the chat route\'s plus the panel\'s "guide"', () => {
  const chat = read('src/app/api/ai/mentor/chat/route.js');
  const chatModes = JSON.parse(/const VALID_MODES = new Set\((\[[^\]]+\])\)/.exec(chat)[1].replace(/'/g, '"'));
  assert.deepEqual([...MENTOR_MODES].sort(), chatModes.sort());
  assert.equal(savedModeOf('guide'), 'guide');
  assert.equal(savedModeOf('autopsy'), 'autopsy');
  for (const bad of [undefined, null, '', 'x'.repeat(5000), { evil: 1 }, ['mentor'], 42]) assert.equal(savedModeOf(bad), 'guide');
  const local = read('src/app/api/ai/mentor/local/route.js');
  assert.doesNotMatch(local, /body\.mode \|\|/);
  assert.equal((local.match(/savedModeOf\(body\.mode\)/g) || []).length, 2);
  assert.deepEqual(aiLimit('local', 'u1'), { route: '/api/ai/mentor/local', limit: 20, keyParts: ['u1'], fallback: 'memory' });
  assert.equal(AI_ROUTE_LIMITS.sessionNew.limit, 20, 'the chat route\'s 20 a minute');
});

test('decision 5: every route under /api/ai and /api/mobi checks a rate limit after auth and before any database read', () => {
  const routes = [...routesUnder('src/app/api/ai'), ...routesUnder('src/app/api/mobi')];
  assert.ok(routes.length >= 16);
  const firstRead = /Database\.|supabaseAdmin\(\)|getStudentAIContext\(|readStanding\(|createAIRivalBattle\(|scoreRivalBattle\(|handleReportPost\(|guest\.handle\(|readAIWallet\(/;
  for (const rel of routes) {
    const src = read(rel);
    // Rival answers 404 before anything while it is off; the guest route's limits are its three buckets inside guest.handle.
    const limit = src.search(/checkPersistentRateLimit\(|rivalEnabled\(\)|handleReportPost\(/);
    assert.ok(limit > 0, `${rel} has a limit`);
    const body = src.slice(src.search(/export (async )?(function|const) (GET|POST|PUT|PATCH|DELETE)/));
    const read1 = body.search(firstRead);
    const lim1 = body.search(/checkPersistentRateLimit\(|rivalEnabled\(\)|handleReportPost\(|signedIn\(|guest\.handle\(/);
    assert.ok(read1 < 0 || (lim1 >= 0 && lim1 <= read1), `${rel}: the limit comes before the first read`);
  }
});

test('L7: Learn answers its limit before any read, a pure read too', () => {
  const src = read('src/lib/server/learnHttp.js');
  const fn = src.slice(src.indexOf('export async function learnHttp'));
  const limit = fn.indexOf('const limited = await checkPersistentRateLimit(');
  assert.ok(limit > 0);
  assert.ok(fn.indexOf('if (!limited.allowed) return') > limit);
  assert.ok(fn.indexOf('learnService()') > fn.indexOf('if (!limited.allowed) return'), 'no service read starts beside the limit');
  assert.doesNotMatch(fn, /pure && !write/);
});
