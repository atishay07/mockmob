// Release 10 verifier findings (19 Oct 2026), each locked by a test. The SQL halves (M1 Play Pro refund evidence, M4 the bought
// credit cap lift) run on the real migrations in data/tests/play_billing.test.mjs and data/tests/one_credits_balance.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walletLine } from '../../src/components/ai/askSuggestions.mjs';
import { creditTiles } from '../../src/components/profile/creditsModel.mjs';
import { ONE_CREDIT_LINE, DEEP_AI_CREDITS } from '../../src/lib/creditCopy.mjs';
import { CREDIT_PACKS } from '../../src/services/credits/creditPacks.mjs';
import { FAQ_ITEMS } from '../../src/lib/helpFaq.mjs';
import { WALLET_COPY, balanceTile } from '../../src/components/wallet/walletModel.mjs';
import { HEADLINE_OPTIONS } from '../../src/lib/proNudge.mjs';
import { aiCreditsBreakdown, aiCreditsFaqs, aiCreditsStatusLine } from '../../src/app/pricing/ai-credits/aiCreditsCopy.mjs';
import { readAttemptListSummary, resetSummaryRpcState, rpcIsMissing } from '../../src/lib/server/attemptListSummary.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('H1: Ask Mobi never says the whole balance resets; only the free part goes back', () => {
  const w = { known: true, state: 'available', total: 138, includedRemaining: 38, includedMonthlyCredits: 50, bonusCredits: 0, balanceCredits: 100, heldCredits: 100, resetAt: '2026-10-31T18:30:00.000Z' };
  const line = walletLine(w);
  assert.deepEqual(line, { count: 138, rest: 'credits left', reset: '38 free, back to 50 on 1 Nov' });
  assert.doesNotMatch(JSON.stringify(line), /resets/);
});

test('H2: free credits go BACK TO 50 on the reset date, never "50 more"', () => {
  const [tile] = creditTiles({ total: { balance: 138, freeLeft: 38, freeAllowance: 50, held: 100, renewsOn: '2026-11-01' }, plan: { name: 'Free' } });
  assert.ok(tile.lines.includes('Your free credits go back to 50 on 1 November.'));
  assert.ok(!tile.lines.some((l) => /more on/.test(l)));
});

test('M3: one true sentence for what a credit buys; deeper analysis is 3 and matches the server price list', () => {
  // New contract (copy pass, 19 Oct): full sentences, and the first full mock in each subject is free (C-dec 1).
  assert.equal(ONE_CREDIT_LINE, '1 credit buys 1 practice question or 1 chat reply. A full mock costs 50 credits, and your first one in each subject is free. Deeper analysis costs 3 credits. The cost shows before you start.');
  const costs = read('src/services/usage/getDailyUsage.js');
  for (const k of ['deep_mentor_analysis', 'mock_autopsy', 'trap_drill', 'custom_mock_plan', 'rival_weakness', 'deep_recovery_plan']) {
    assert.match(costs, new RegExp(`${k}: ${DEEP_AI_CREDITS},`), k);
  }
  for (const pack of CREDIT_PACKS) assert.ok(pack.description.endsWith(ONE_CREDIT_LINE));
  assert.match(FAQ_ITEMS.find((f) => f.id === 'credits').answer.join(' '), /deeper analysis, like a mock autopsy or a trap drill, costs 3/);
  assert.match(read('src/lib/server/wallet.js'), /return ONE_CREDIT_LINE;/);
  assert.match(read('src/app/privacy/page.js'), /1 credit for a chat reply or 3 for deeper analysis/);
  for (const f of ['src/app/pricing/page.js', 'src/app/pricing/ai-credits/page.js']) assert.match(read(f), /\{ONE_CREDIT_LINE\}/, f);
  // The false sentence is gone from every place a student reads.
  for (const f of ['src/lib/creditCopy.mjs', 'src/lib/server/wallet.js', 'src/services/credits/creditPacks.mjs', 'src/lib/helpFaq.mjs', 'src/app/pricing/page.js',
    'src/app/pricing/ai-credits/page.js', 'src/app/privacy/page.js', 'src/app/preview/arena/previewWallet.js', 'src/components/ai/assistantKnowledge.js']) {
    const s = stripComments(read(f));
    assert.doesNotMatch(s, /1 credit = 1 question|1 credit a question, 1 credit a reply|1 credit a question or a (written )?reply|it uses 1 credit and/, f);
  }
});

test('M5: out of credits offers a top-up only while selling is open, and never tells a Pro student to top up to practise', () => {
  const body = (o) => ({ credits: { total: 0, freeLeft: 0, freeAllowance: 50, held: 0, resetAt: '2026-10-31T18:30:00.000Z', renewsOn: '2026-11-01', buys: ONE_CREDIT_LINE }, plan: { name: 'Free', until: null }, commerce: { open: false }, ...o });
  assert.equal(balanceTile(body()).lines[0], 'You are out of credits. Your free credits come back on 1 November.');
  assert.equal(balanceTile(body({ commerce: { open: true } })).lines[0], 'You are out of credits. Top up to keep practising, or wait: Your free credits come back on 1 November.');
  for (const open of [false, true]) {
    const pro = balanceTile(body({ plan: { name: 'Pro', until: '2027-07-31' }, commerce: { open } })).lines[0];
    assert.doesNotMatch(pro, /practising|Top up to keep/);
    assert.match(pro, /practice needs no credits with Pro/);
    assert.equal(/top up/i.test(pro), open, 'a Pro top-up line, for replies, only while selling is open');
  }
  const client = read('src/app/(app)/wallet/WalletPageClient.jsx');
  assert.match(client, /data\.commerce\.open \? WALLET_COPY\.packsHeading : WALLET_COPY\.packsHeadingClosed/);
  const mob = read('src/components/mob/MobPage.jsx');
  assert.doesNotMatch(mob, /Get credits to sit it|\/pricing\?reason=credits/);
  assert.match(mob, /href="\/wallet" data-pro-direct="">See your credits<\/Link>/);
  const policy = read('src/services/ai/actionPolicy.js');
  assert.match(policy, /label: walletCommerceOpen\(\) \? \(safe\.label \|\| 'Buy credits'\) : 'See your credits'/);
  const route = read('src/app/api/ai/actions/execute/route.js');
  assert.match(route, /message: walletCommerceOpen\(\) \?/);
  assert.doesNotMatch(route, /aiCommerceOpen/);
});

test('M6: only a missing function falls back to the table; a timeout returns an error and the route answers 503', async () => {
  assert.equal(rpcIsMissing({ code: 'PGRST202' }), true);
  assert.equal(rpcIsMissing({ code: '42883' }), true);
  assert.equal(rpcIsMissing({ code: '57014', message: 'canceling statement due to statement timeout' }), false);
  assert.equal(rpcIsMissing({ code: '42P01', message: 'relation "x" does not exist' }), false, 'L6: "does not exist" in a message is not a missing function');
  resetSummaryRpcState();
  let tableReads = 0;
  const db = {
    rpc: () => { const q = { order: () => q, range: () => q, then: (res, rej) => Promise.resolve({ data: null, error: { code: '57014', message: 'timeout' } }).then(res, rej) }; return q; },
    from: () => { tableReads += 1; throw new Error('the table must not be read'); },
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    await assert.rejects(readAttemptListSummary(db, 'u1'), (e) => e.code === 'attempts_summary_unavailable');
  } finally { console.warn = warn; resetSummaryRpcState(); }
  assert.equal(tableReads, 0);
  const route = read('src/app/api/attempts/route.js');
  assert.match(route, /e\?\.code === SUMMARY_UNAVAILABLE/);
  assert.match(route, /status: 503, headers: \{ 'Retry-After': '5' \}/);
});

test('M7: the credits page breakdown adds up to the balance shown, and its open or paused words follow walletCommerceOpen', () => {
  const wallet = { known: true, total: 138, includedRemaining: 38, includedMonthlyCredits: 50, bonusCredits: 30, balanceCredits: 70, heldCredits: 100 };
  const rows = aiCreditsBreakdown(wallet);
  assert.deepEqual(rows.map((r) => [r.label, r.figure]), [['Your balance', 138], ['Free this month', 38], ['Held credits', 100]]);
  assert.equal(rows[1].figure + rows[2].figure, rows[0].figure);
  assert.equal(aiCreditsBreakdown({ known: false }), null);
  assert.equal(aiCreditsStatusLine({ checkoutOpen: true, repliesOpen: true, packsHere: false }), 'You can buy more on your wallet.');
  assert.match(aiCreditsFaqs(false).at(-1).a, /paused/);
  assert.doesNotMatch(aiCreditsFaqs(true).map((f) => f.a).join(' '), /paused/);
  for (const f of aiCreditsFaqs(false)) assert.doesNotMatch(f.a, /expire\b(?! )|reset every month, but/);
  const page = read('src/app/pricing/ai-credits/page.js');
  assert.match(page, /const checkoutOpen = walletCommerceOpen\(\);/);
  assert.match(page, /const packsHere = checkoutOpen && aiCommerceOpen\(\);/);
  assert.match(page, /\{packsHere \? \(/);
  assert.match(page, /breakdown\.map/);
  assert.doesNotMatch(page, /<dt>Purchased<\/dt>/);
});

test('L1: /pricing holds no stale AI pack list (10/20/50 for 50/150/400)', () => {
  const page = read('src/app/pricing/page.js');
  assert.doesNotMatch(page, /AI_PACKS|₹20'|150 credits'|400 credits'|Power Pack|Prep Pack/);
});

test('L5: practice-only claims, true wallet lines, sentence case', () => {
  assert.ok(HEADLINE_OPTIONS.includes('Unlimited mocks. No credits needed for practice.'));
  assert.ok(!HEADLINE_OPTIONS.includes('Unlimited mocks. No credits needed.'));
  assert.doesNotMatch(WALLET_COPY.lede, /Credits you buy never expire/);
  assert.match(WALLET_COPY.lede, /Credits you hold stay until you use them\./);
  assert.doesNotMatch(read('src/app/(app)/wallet/page.js'), /how to top up/);
  assert.doesNotMatch(read('src/components/review/ChapterRows.jsx'), /'Credit'\)/);
});
