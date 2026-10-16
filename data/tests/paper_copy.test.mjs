// The headline difference, held to the code (owner, 16 Oct 2026): one central bank, a fresh paper every time, no cap
// on papers. Each sentence in src/lib/paperCopy.mjs is checked here against the rule in the code that makes it true,
// so a change to prices, recency or the selector breaks this test before it breaks the copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODE_SPECS, ONBOARDING_LEAD, bankCount, bankPhrase, freshPaperLine, nextPaper, practiceSubjectId,
  pricingBankFaq, pricingBankLine, tileCount,
} from '../../src/lib/paperCopy.mjs';
import { practiceBankSize } from '../../src/lib/practiceBank.mjs';
import { TEST_MODES } from '../test_modes.js';
import { rankCandidates } from '../mock_question_selector.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const STATS = { state: 'available', bankSize: 8197, subjectCounts: { accountancy: 1404, gat: 227, sanskrit: 0 } };

test('a bank count is a number only when the counts are known; unknown is never 0', () => {
  assert.equal(bankCount(STATS, 'accountancy'), 1404);
  assert.equal(bankCount(STATS, 'general_test', 'gat'), 227);
  assert.equal(bankCount(STATS, 'sanskrit'), 0);
  assert.equal(bankCount(STATS, 'not_in_counts'), 0);
  assert.equal(bankCount({ state: 'loading' }, 'accountancy'), null);
  assert.equal(bankCount({ state: 'unavailable' }, 'accountancy'), null);
  assert.equal(bankCount(null, 'accountancy'), null);
  assert.equal(bankPhrase(0, 'Sanskrit'), 'the live question bank');
  assert.equal(bankPhrase(null, 'Accountancy'), 'the live question bank');
  assert.equal(bankPhrase(1404, 'Accountancy'), 'the 1,404 Accountancy questions in the bank');
  assert.equal(tileCount(1404), '1,404 questions');
  assert.equal(tileCount(1), '1 question');
  assert.equal(tileCount(0), null);
  assert.equal(tileCount(null), null);
});

test('Practice says no cap on papers, and on Free that each one uses practice credits', () => {
  const free = freshPaperLine({ count: 1404, subjectName: 'Accountancy', isPremium: false });
  assert.equal(free, 'Every paper is built fresh from the 1,404 Accountancy questions in the bank, questions you have not answered first. There is no cap on how many you take, only the practice credits each one uses.');
  const pro = freshPaperLine({ count: 1404, subjectName: 'Accountancy', isPremium: true });
  assert.match(pro, /There is no cap on how many you take\.$/);
  assert.doesNotMatch(freshPaperLine({ count: null, subjectName: 'Accountancy' }), /\d/);
  // NTA mode's pool is the quality-scored subset, so its line never calls the whole bank its pool.
  assert.equal(freshPaperLine({ count: 1404, subjectName: 'Accountancy', isPremium: true, mode: 'nta' }), 'Each NTA paper is built fresh from the Accountancy questions that meet NTA mode’s quality bar (the full bank holds 1,404), questions you have not answered first. There is no cap on how many you take.');
  assert.match(read('data/nta_engine.js'), /export const NTA_MIN_SCORE = 8;/);
  assert.match(MODE_SPECS.full, /a new paper every time/);
  assert.match(MODE_SPECS.nta, /leaves out your earlier NTA questions while the bank allows/);
});

test('the result page links to Practice with the same subject and mode, and prices honestly by plan', () => {
  const full = nextPaper({ mode: 'full', subject: 'accountancy', subjectName: 'Accountancy', count: 1404, total: 50, isPremium: false, balance: 40 });
  assert.equal(full.title, 'Take another fresh paper');
  assert.equal(full.href, '/dashboard?subject=accountancy&mode=full');
  assert.equal(full.fresh, 'Your next Full mock in Accountancy is built new from the 1,404 questions in the bank, questions you have not answered first.');
  assert.equal(full.price, 'There is no cap on how many papers you take. A Full mock uses 50 practice credits. You have 40.');
  assert.equal(full.action, 'Set up another Full mock');

  const pro = nextPaper({ mode: 'nta', subject: 'gat', subjectName: 'Gat', count: 227, isPremium: true });
  assert.doesNotMatch(pro.fresh, /227/);
  assert.equal(pro.href, '/dashboard?subject=general_test&mode=nta');
  assert.match(pro.fresh, /questions from this paper and your earlier NTA papers stay out while the bank allows, and any repeat is named on the paper/);
  assert.equal(pro.price, 'There is no cap on how many papers you take, and Pro covers every one.');

  const quick = nextPaper({ mode: 'quick', subject: 'economics', subjectName: 'Economics', count: 466, total: 15, isPremium: false, balance: null });
  assert.equal(quick.href, '/dashboard?subject=economics&mode=quick&count=15');
  assert.equal(quick.price, 'There is no cap on how many papers you take. Practice shows the price before it starts.');
  assert.match(nextPaper({ mode: 'quick', subject: 'economics', isPremium: false, balance: 1 }).price, /You have 1 practice credit\.$/);

  const unknown = nextPaper({ mode: undefined, subject: 'english', subjectName: 'English' });
  assert.equal(unknown.href, '/dashboard?subject=english');
  assert.equal(unknown.action, 'Set up another paper');
  assert.equal(practiceSubjectId('gat'), 'general_test');
});

test('pricing says no limit on papers without calling Free unlimited, and names the bank only when counted', () => {
  assert.match(pricingBankLine(8197), /from a live bank of 8,197 questions/);
  assert.match(pricingBankLine(8197), /Pro covers as many as you take; on Free, each one uses practice credits\./);
  assert.doesNotMatch(pricingBankLine(null), /\d/);
  const faq = pricingBankFaq(8197);
  assert.equal(faq.q, 'How many mocks do I get per subject?');
  assert.match(faq.a, /On Free, Quick practice uses 10 practice credits a session and a Full mock uses 50\./);
  assert.match(faq.a, /can bring back questions you have answered before/);
  assert.match(ONBOARDING_LEAD, /^Pick up to 5\./);
});

test('every line is plain: no "never repeats", no "unlimited" for Free, no "!", em dash, middle dot or arrow', () => {
  const lines = [
    ...Object.values(MODE_SPECS), ONBOARDING_LEAD, pricingBankLine(8197), pricingBankLine(null), pricingBankFaq(8197).a,
    freshPaperLine({ count: 3, subjectName: 'X' }), freshPaperLine({ isPremium: true }),
    ...['quick', 'full', 'smart', 'nta', undefined].flatMap((mode) => [false, true].flatMap((isPremium) => {
      const n = nextPaper({ mode, subject: 'english', subjectName: 'English', count: 382, isPremium, balance: 20 });
      return [n.title, n.fresh, n.price, n.action];
    })),
  ];
  for (const line of lines) {
    assert.doesNotMatch(line, /[!—·→]|never repeat|guarantee|unlimited/i, line);
  }
});

// The facts behind the words. If one of these changes, the copy above must change with it.
test('the prices the copy names are the prices the code charges', () => {
  assert.equal(TEST_MODES.quick.creditCost, 10);
  assert.equal(TEST_MODES.full.creditCost, 50);
  assert.equal(TEST_MODES.nta.premium, true);
  assert.equal(TEST_MODES.smart.premium, true);
  assert.equal(TEST_MODES.full.fixedCount, 50);
  assert.equal(TEST_MODES.full.fixedDurationSec, 3600);
  // Pro spends nothing on any mode; Free pays the mode's credit action per paper.
  const sessions = read('src/lib/server/practiceSessions.js');
  assert.match(sessions, /p_credit_action: user\?\.isPremium \? null : mode\.creditAction/);
  assert.match(sessions, /if \(!user\?\.isPremium && mode\.creditAction\)/);
  // No per-day or per-subject count of papers: the only guard on starting is the request rate limit.
  assert.doesNotMatch(sessions, /max(Mocks|Papers)|papersPerDay|mockLimit/i);
  // New accounts start with 100 practice credits, and an approved upload grants 15.
  assert.match(read('data/db.js'), /credit_balance: 100,/);
  assert.match(read('supabase/migrations/0027_enforce_credit_integrity.sql'), /v_amount INTEGER := 15;/);
});

test('ordinary papers put questions the student has not answered first, and leave out recent sessions', () => {
  const rows = [{ id: 'seen', difficulty: 'easy' }, { id: 'fresh', difficulty: 'easy' }];
  const progress = new Map([['seen', { attempt_count: 2, last_attempted_at: '2026-10-01T00:00:00Z' }]]);
  for (const id of ['quick', 'full', 'smart']) {
    assert.deepEqual(rankCandidates(rows, { mode: TEST_MODES[id], progress }).map((row) => row.id), ['fresh', 'seen'], id);
  }
  assert.ok(TEST_MODES.quick.recencyLimit > 0 && TEST_MODES.full.recencyLimit > 0 && TEST_MODES.smart.recencyLimit > 0);
  assert.match(read('data/practice_pick.js'), /recentIds\.has\(row\.id\)/);
});

test('NTA papers build unseen first, keep earlier NTA questions out while they can, and name repeats', () => {
  const engine = read('data/nta_engine.js');
  assert.match(engine, /seenPolicy: 'seen_first'/);
  assert.match(engine, /const fresh = pool\.filter\(\(row\) => !previous\.has\(row\?\.id\)\)/);
  assert.match(engine, /repeat\$\{repeats === 1 \? '' : 's'\}|repeats' : 's repeat'\} from your earlier NTA papers/);
});

test('Pro-only modes never quote practice credits on Free, and the pricing count covers only subjects Practice offers', () => {
  // Smart practice and NTA mode are premium in the code, so a Free student selecting one is told it is part of Pro.
  assert.equal(TEST_MODES.nta.premium, true);
  assert.equal(TEST_MODES.smart.premium, true);
  for (const mode of ['nta', 'smart']) {
    const line = freshPaperLine({ count: 1404, subjectName: 'Accountancy', isPremium: false, mode });
    assert.match(line, /is part of Pro, which has no cap on how many you take\.$/);
    assert.doesNotMatch(line, /practice credits/);
  }
  assert.equal(nextPaper({ mode: 'nta', subject: 'english', isPremium: true }).action, 'Set up another NTA paper');
  // The stored bankSize also holds subjects Practice does not offer (not_offered, retired); the pricing sentence sums
  // only the offered ones (15 Oct 2026: 5,941 of 8,197).
  const counts = { english: 382, accountancy: 1404, gat: 227, hindi: 10, sanskrit: 8, legal_studies: 136, teaching_aptitude: 15 };
  assert.equal(practiceBankSize({ state: 'available', bankSize: 9999, subjectCounts: counts }), 382 + 1404 + 227);
  assert.equal(practiceBankSize({ state: 'unavailable' }), null);
  assert.equal(practiceBankSize(null), null);
  assert.equal(practiceBankSize({ state: 'available', subjectCounts: { hindi: 10 } }), null);
});
