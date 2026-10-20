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
  assert.match(ONE_CREDIT_LINE, /^1 credit buys 1 practice question, or one Mobi job: a mistake fixed for good, or a doubt answered and tested on 2 new CUET-style questions\./);
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

test('the wallet price list has no deeper-analysis row, and every name taken from creditCopy exists', async () => {
  const { priceRows } = await import('../../src/components/wallet/walletModel.mjs');
  const rows = priceRows({ plan: { name: 'Pro' } }, { question: 1, fullMock: 50, reply: 1, repair: 1, firstMockFree: true });
  assert.deepEqual(rows.map((r) => r.key), ['reply', 'repair', 'question', 'mock']);
  assert.equal(rows.find((r) => r.key === 'reply').cost, '1 credit', 'Pro does not make a Mobi job free');
  assert.equal(rows.find((r) => r.key === 'repair').cost, '1 credit', 'Pro does not make a Mobi job free');
  assert.doesNotMatch(read('src/components/wallet/walletModel.mjs'), /Deeper analysis/);
  const creditCopy = await import('../../src/lib/creditCopy.mjs');
  for (const file of [...walk('src/app'), ...walk('src/components'), ...walk('src/lib'), ...walk('src/services')]) {
    for (const m of read(file).matchAll(/import\s*\{([^}]*)\}\s*from\s*'(?:@\/lib\/|(?:\.\.?\/)+(?:lib\/)?)creditCopy\.mjs'/g)) {
      for (const name of m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        assert.ok(name in creditCopy, `${file} imports ${name}, which creditCopy.mjs does not export`);
      }
    }
  }
});

test('no Mobi job is priced by plan: the credit amount never reads Pro, and the models stay the two allowed', () => {
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const file of ['src/services/mobi/doubtThread.js', 'src/services/mobi/doubtThreadDeps.js', 'src/services/mobi/standing.js', 'src/services/mobi/tonight.js', 'src/services/mobi/threadStore.js', 'src/app/api/mobi/standing/route.js', 'src/app/api/mobi/thread/route.js']) {
    assert.doesNotMatch(strip(read(file)), /isPaidUser|isPremium|premiumUntil|planName/, `${file} does not price or gate by plan`);
    assert.doesNotMatch(read(file), /gpt-(?!6-luna)|claude-(?!haiku-5-5)[a-z]+-\d/, `${file} names no model outside the two allowed`);
  }
  const chat = strip(read('src/app/api/ai/mentor/chat/route.js'));
  assert.doesNotMatch(chat, /creditCost:\s*isPaid|isPaidUser\(dbUser\)\s*\?\s*0/, 'the chat route never makes a paid reply free on Pro');
  assert.equal([...chat.matchAll(/creditCost\s*=\s*1\b|creditCost:\s*1\b|creditCost\s*:\s*THREAD_CREDIT_COST/g)].length >= 1, true);
  assert.match(read('src/services/mobi/doubtThread.js'), /export const THREAD_CREDIT_COST = 1;/);
});

// L-02 (20 Oct): the bank is original CUET-style practice written for MockMob, not past papers, so nothing a student reads
// (or the model is told) may call the 2 questions of a doubt "real CUET questions".
test('L-02 no student-facing source calls the bank "real CUET questions"', () => {
  const offenders = walk('src').filter((f) => /\.(m?js|jsx)$/.test(f)).filter((f) => /real CUET question/i.test(read(f)));
  assert.deepEqual(offenders, []);
  assert.match(ONE_CREDIT_LINE, /tested on 2 new CUET-style questions/);
});
