import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rankCombos, planCombos, mustKeep, DEFAULT_MAX_PAPERS } from '../../src/lib/du/combos.js';
import { evaluateGroup } from '../../src/lib/du/eligibility.js';

const root = path.resolve(import.meta.dirname, '../../public/du/2026');
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
const id = (name) => index.groups.find((g) => g.name === name)?.id;
const L = (x) => ({ kind: 'language', id: x });
const D = (x) => ({ kind: 'domain', id: x });

test('every ranked combination is honest: its counts are exactly what the DU evaluator says', () => {
  const pool = [L('english'), L('hindi'), D('accountancy'), D('business_studies'), D('economics'), D('mathematics'), D('history')];
  const targets = [id('B.Com. (Hons.)'), id('B.A. (Hons.) Economics')].filter(Boolean);
  assert.equal(targets.length, 2);
  const ranked = rankCombos({ groups: index.groups, pool, targets });
  assert.ok(ranked.length > 0);
  for (const r of ranked) {
    assert.ok(r.items.length <= DEFAULT_MAX_PAPERS);
    const eligible = index.groups.filter((g) => evaluateGroup(g, r.selection).eligible);
    assert.equal(r.unlocked, eligible.length);
    assert.deepEqual([...r.met].sort(), eligible.filter((g) => targets.includes(g.id)).map((g) => g.id).sort());
  }
  // Economics (Hons.) needs Mathematics, so the best combination must include it.
  assert.equal(ranked[0].met.length, 2);
  assert.ok(ranked[0].items.some((i) => i.id === 'mathematics'));
  assert.ok(mustKeep(ranked, 2).some((i) => i.id === 'mathematics'));
  const plan = planCombos({ groups: index.groups, pool, targets });
  assert.ok(plan.keep.some((i) => i.id === 'mathematics'), 'keep is computed over every qualifying combination');
  assert.ok(plan.ranked.every((r) => r.met.length === plan.ranked[0].met.length), 'alternatives reach as many targets as the best');
});

test('a target no pooled subject can reach is reported as missed, with the nearest rule', () => {
  const ranked = rankCombos({ groups: index.groups, pool: [L('english'), D('history'), D('political_science')], targets: [id('B.Com. (Hons.)')] });
  assert.equal(ranked[0].met.length, 0);
  assert.equal(ranked[0].missed.length, 1);
  assert.ok(ranked[0].missed[0].nearest?.gaps?.length > 0);
});

test('larger combinations are only listed when they unlock more, and the paper limit holds', () => {
  const pool = [L('english'), D('accountancy'), D('business_studies'), D('economics'), D('mathematics'), D('history'), D('political_science')];
  const ranked = rankCombos({ groups: index.groups, pool, targets: [], maxPapers: 3, limit: 10 });
  for (const r of ranked) assert.ok(r.items.length <= 3);
  for (let i = 1; i < ranked.length; i++) {
    const dominated = ranked.slice(0, i).some((o) => o.unlocked >= ranked[i].unlocked && o.items.length <= ranked[i].items.length);
    assert.equal(dominated, false);
  }
});
