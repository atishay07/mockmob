// L6, L9 (15 Nov 2026): Rival is off unless RIVAL_ENABLED=true; its question pick uses Practice's publication checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rivalEnabled } from '../../src/services/ai-rival/rivalGate.js';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

test('Rival is on only with RIVAL_ENABLED exactly "true"', () => {
  assert.equal(rivalEnabled({}), false, 'unset in production: off');
  for (const value of ['false', '1', 'TRUE', 'yes', '']) assert.equal(rivalEnabled({ RIVAL_ENABLED: value }), false, value);
  assert.equal(rivalEnabled({ RIVAL_ENABLED: 'true' }), true);
});

test('off: /rival sends the student to /dashboard, and both API routes answer 404 before any read or model call', () => {
  const page = read('src/app/(app)/rival/page.js');
  assert.match(page, /if \(!rivalEnabled\(\)\) redirect\('\/dashboard'\);\r?\n\s+return <AIRivalArena \/>;/);
  for (const rel of ['src/app/api/ai/rival/start/route.js', 'src/app/api/ai/rival/submit/route.js']) {
    const src = read(rel);
    const body = src.slice(src.indexOf('export async function POST'));
    const gate = body.indexOf("if (!rivalEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 });");
    assert.ok(gate > 0, rel);
    for (const later of ['request.json()', 'auth()', 'Database.', 'generateAIResponse(', 'scoreRivalBattle(', 'createAIRivalBattle(']) {
      const at = body.indexOf(later);
      assert.ok(at < 0 || at > gate, `${rel}: ${later} comes after the gate`);
    }
  }
});

test('the pick serves only what Practice may serve: the visible filter and readablePracticeQuestions, never a withdrawn question', () => {
  const src = read('src/services/ai-rival/createAIRivalBattle.js');
  const pick = src.slice(src.indexOf('async function selectRivalQuestions'), src.indexOf('function simulateRivalBenchmark'));
  assert.doesNotMatch(pick, /status\.eq\.live,verification_state\.eq\.verified/, 'the old filter served pulled questions');
  assert.equal((pick.match(/\.or\(INVENTORY_VISIBLE_FILTER\)/g) || []).length, 2, 'the slim read and the full read');
  assert.match(pick, /\.order\('id'\)/, 'an ordered read, so the seeded pick is over the whole subject');
  assert.match(pick, /await readablePracticeQuestions\(\(full \|\| \[\]\)\.filter\(\(row\) => !isPassageLinkedQuestion\(row\)\), sb\)/);
  assert.match(read('data/inventory_count.js'), /INVENTORY_VISIBLE_FILTER = 'status\.eq\.live,and\(verification_state\.eq\.verified,exploration_state\.eq\.active\)'/);
});
