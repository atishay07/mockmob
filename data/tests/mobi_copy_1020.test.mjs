// What a credit buys, after C-dec 3 and 3b (20 Oct 2026): Mobi charges for finished jobs, never for talking; every Mobi job
// is 1 credit on every plan; there is no 3-credit "deeper analysis"; Pro does not make Mobi free.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ONE_CREDIT_LINE, MOBI_JOB_CREDITS } from '../../src/lib/creditCopy.mjs';
import { FAQ_ITEMS } from '../../src/lib/helpFaq.mjs';
import { CREDIT_PACKS } from '../../src/services/credits/creditPacks.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
function walk(dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    const p = `${dir}/${name}`;
    if (statSync(join(root, p)).isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs)$/.test(name) && !/\.test\.mjs$/.test(name)) out.push(p);
  }
  return out;
}

test('one credit buys one practice question or one Mobi job; everything from the record is free', () => {
  assert.equal(MOBI_JOB_CREDITS, 1);
  assert.match(ONE_CREDIT_LINE, /^1 credit buys 1 practice question, or one Mobi job: a mistake fixed for good, or a doubt answered and tested on 2 real CUET questions\./);
  assert.match(ONE_CREDIT_LINE, /Everything Mobi reads from your record is free\./);
  for (const pack of CREDIT_PACKS) assert.ok(pack.description.endsWith(ONE_CREDIT_LINE));
  assert.match(FAQ_ITEMS.find((f) => f.id === 'credits').answer.join(' '), /Mobi charges for finished jobs, never for talking\./);
});

test('the 3-credit deeper analysis is gone from every page and price list', () => {
  for (const file of [...walk('src/app'), ...walk('src/components'), ...walk('src/lib')]) {
    const text = read(file);
    assert.doesNotMatch(text, /deeper analysis costs|3 a deeper analysis|3 for deeper analysis/i, file);
  }
  const costs = read('src/services/usage/getDailyUsage.js');
  for (const k of ['deep_mentor_analysis', 'mock_autopsy', 'trap_drill', 'custom_mock_plan', 'admission_path', 'deep_recovery_plan']) {
    assert.match(costs, new RegExp(`${k}: ${MOBI_JOB_CREDITS},`), k);
  }
});

test('Pro does not make Mobi free (C-dec 3b): no page or route says so', () => {
  for (const file of [...walk('src/app'), ...walk('src/components'), ...walk('src/lib'), ...walk('src/services')]) {
    // Comments may name what is banned (to say it is banned); the words a student can read may not.
    const text = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(text, /Included in Pro|fair use|no credits on Pro|Mobi jobs? (?:are )?free on Pro/i, file);
  }
});
