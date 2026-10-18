// The one credit name and the one spend line (audit findings 12 and 13; one credits balance, D78, 18 Oct 2026).
// One name: "credits", for practice and AI alike. Every spend line names its price and the one total.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_CREDITS, PRACTICE_CREDITS, balanceLabel, creditCount, haveLine, usedLine, usesLine } from '../../src/lib/creditCopy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

test('the spend line names its pool and its total', () => {
  assert.equal(usesLine({ what: 'This repair', cost: 3, pool: 'ai', balance: 9 }), 'This repair uses 3 credits. You have 9.');
  assert.equal(usesLine({ what: 'This repair', cost: 1, pool: 'ai', balance: 9 }), 'This repair uses 1 credit. You have 9.');
  assert.equal(usesLine({ what: 'These 3 repairs', verb: 'use', cost: 3, pool: 'ai', balance: 9 }), 'These 3 repairs use 3 credits. You have 9.');
  assert.equal(usesLine({ what: 'A Quick practice', cost: 10, pool: 'practice', balance: 40 }), 'A Quick practice uses 10 credits. You have 40.');
  assert.equal(usedLine({ cost: 1, pool: 'ai', balance: 43 }), '1 credit used. You have 43.');
});

test('an unknown balance writes no number, and 0 is a real number', () => {
  assert.equal(usesLine({ what: 'This repair', cost: 1, pool: 'ai', balance: null }), 'This repair uses 1 credit.');
  assert.equal(usesLine({ what: 'This repair', cost: 1, pool: 'ai', balance: undefined }), 'This repair uses 1 credit.');
  assert.equal(usesLine({ what: 'This repair', cost: 1, pool: 'ai', balance: 0 }), 'This repair uses 1 credit. You have 0.');
  assert.equal(haveLine(null), null);
  assert.equal(haveLine(''), null);
  assert.equal(usedLine({ cost: 1, pool: 'ai' }), '1 credit used.');
  assert.equal(balanceLabel(null, 'ai'), 'Credits unavailable');
  assert.equal(balanceLabel(12, 'practice'), 'Credits: 12');
  assert.equal(creditCount(null, 'ai'), 'credits');
  assert.equal(creditCount(1200, 'practice'), '1,200 credits');
});

test('the lines are plain: no "!", no em dash, no middle dot', () => {
  const lines = [usesLine({ cost: 3, balance: 9 }), usedLine({ cost: 1, balance: 8 }), balanceLabel(4), PRACTICE_CREDITS, AI_CREDITS];
  for (const l of lines) assert.doesNotMatch(l, /[!—·]/, l);
});

// The website's student-facing files may say "PrepOS" as a product, but never as a credit name, and the old
// credit names are gone from every spend line (audit finding 12).
const WEBSITE_FILES = [
  'src/components/recovery/MistakeRepair.jsx', 'src/components/ScoreRecoveryLab.jsx', 'src/components/study/StudyHelp.jsx',
  'src/components/ai/AskMobiPanel.jsx', 'src/components/ai/MentorRecordPage.jsx', 'src/components/ai/AIRivalArena.jsx', 'src/components/ai/assistantKnowledge.js',
  'src/components/ui/Glyph.jsx', 'src/components/profile/accountModel.mjs', 'src/components/profile/CreditsSection.jsx',
  'src/components/profile/creditsModel.mjs', 'src/components/billing/PlanCard.jsx', 'src/components/billing/PrepOSCreditPurchaseButton.jsx',
  'src/app/(app)/AppLayoutClient.jsx', 'src/app/pricing/page.js', 'src/app/pricing/ai-credits/page.js', 'src/app/refunds/page.js',
  'src/services/prepos/modelReply.js', 'src/services/recovery/repairFlow.js', 'src/services/credits/aiWalletState.js',
  'src/services/ai-rival/createAIRivalBattle.js', 'src/app/api/ai/actions/execute/route.js',
];

test('no website file names a credit "PrepOS credit", "PrepOS wallet", "explanation credit" or "AI cr"', () => {
  for (const file of WEBSITE_FILES) {
    const src = read(file);
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(code, /PrepOS credit|PrepOS wallet|explanation credit|AI cr\b|credit\(s\)/i, file);
  }
});

test('a repair, a lesson explanation, a written reply and a benchmark each say their pool and total', () => {
  assert.match(read('src/components/recovery/MistakeRepair.jsx'), /usesLine\(\{ what: 'This repair', cost: 1, pool: 'ai'/);
  assert.match(read('src/components/recovery/MistakeRepair.jsx'), /usedLine\(\{ cost: /);
  assert.match(read('src/components/ScoreRecoveryLab.jsx'), /usesLine\(\{ what, verb: .*cost: remaining, pool: 'ai'/);
  assert.match(read('src/components/study/StudyHelp.jsx'), /usesLine\(\{ what: 'This explanation', cost: 1, pool: 'ai'/);
  // Ask Mobi's panel: the price of a written reply names its pool before the call, and the reply names the credit used and the balance after.
  assert.match(read('src/components/ai/AskMobiPanel.jsx'), /usesLine\(\{ what: 'This reply', cost: 1, pool: 'ai' \}\)/);
  assert.match(read('src/components/ai/AskMobiPanel.jsx'), /usedLine\(\{ cost: response\.charged, pool: 'ai', balance: wallet\?\.known \? wallet\.total : null \}\)/);
  assert.match(read('src/components/ai/AIRivalArena.jsx'), /usesLine\(\{ what: 'This benchmark'/);
  assert.match(read('src/services/recovery/repairFlow.js'), /usesLine\(\{ what: 'This repair', cost: REPAIR_CREDIT_COST/);
  assert.match(read('src/services/prepos/modelReply.js'), /usesLine\(\{ what: 'This reply'/);
});
