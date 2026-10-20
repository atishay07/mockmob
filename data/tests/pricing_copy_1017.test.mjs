// The owner's website ledger, items W-093 to W-099 (17 Oct 2026): no disclaimer filler, the fresh-from-one-bank line, the subject
// claim on the landing, no repeated records. Source-level, so no server is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ONBOARDING_LEAD } from '../../src/lib/paperCopy.mjs';
import { SUBJECT_CLAIM } from '../subject_claim.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('W-093: the non-affiliation sentence lives in Terms only', () => {
  for (const rel of ['src/components/MarketingFooter.jsx', 'src/app/about/page.js', 'src/app/coming-soon/page.js', 'src/app/cuet-subject-combination/page.js', 'src/app/page.js']) {
    assert.doesNotMatch(read(rel), /not affiliated|independent of NTA|independent exam preparation|independent CUET/i, rel);
  }
  assert.match(read('src/app/terms/page.js'), /not affiliated with NTA, DU, CUET/);
});

test('W-093: signed-in pages carry no hedge or privacy filler lines', () => {
  const lines = [
    ['src/app/(app)/admission-compass/AdmissionCompassPageClient.jsx', /stay on this device|not a prediction/],
    ['src/components/ai/AIRivalArena.jsx', /not a student or a CUET rank prediction/],
    ['src/components/ai/AskMobiPanel.jsx', /not a diagnosis/],
    ['src/components/ai/MentorRecordPage.jsx', /not a diagnosis/],
    ['src/components/ai/RecordView.jsx', /not a verdict/],
    ['src/app/(app)/analytics/AnalyticsPageClient.jsx', /rough guide/],
    ['src/app/api/recovery/route.js', /causal score gain/],
    ['src/components/du/CompassPro.jsx', /not a prediction/],
  ];
  for (const [rel, bad] of lines) assert.doesNotMatch(read(rel), bad, rel);
});

test('W-094: onboarding says every mock is fresh from one live bank with no cap, and the landing line names no rival numbers', () => {
  // Release 9: "no cap" is Pro's, and the same breath says Free pays credits for each mock.
  assert.match(ONBOARDING_LEAD, /^Pick up to 5\. Every mock is built fresh from one live question bank, and your first full mock in each subject is free\. After that, each one uses credits on Free; on Pro there is no cap\./);
  const line = read('src/components/landing/QuestionBankLine.jsx');
  assert.doesNotMatch(line, /10 or 30|never runs out/);
  assert.match(line, /no fixed set to run out of/);
});

test('W-095: the landing hero carries the subject claim, and the footer, shelf and FAQ say the same thing', () => {
  assert.match(read('src/components/landing/QuestionBankLine.jsx'), /SUBJECT_CLAIM\.long/);
  assert.match(read('src/components/MarketingFooter.jsx'), /SUBJECT_CLAIM\.short/);
  const home = read('src/app/page.js');
  assert.match(home, /SUBJECT_CLAIM\.long/);
  assert.doesNotMatch(home, /Built first for/);
  assert.equal(SUBJECT_CLAIM.long, 'Full NTA-pattern mocks for the 15 subjects behind 19 of every 20 CUET papers');
});

test('W-097: pricing leads with Rs 99 a month and gives each plan its renewal, credits and credits', () => {
  const pricing = read('src/app/pricing/page.js');
  // Release 9: the Pro tag is what is charged today (priceTag: 'a month' once monthly billing opens, 'once' until then).
  assert.match(pricing, /\.\.\.priceTag\(offer\),/);
  // v16 (owner, 20 Oct 11:20 pm): /pricing is rebuilt as the app's Pro page; the Free card keeps its terms; Pro's renewal is the plan card's one line.
  assert.equal((pricing.match(/\['Renewal'/g) || []).length, 1);
  assert.equal((pricing.match(/\['Credits'/g) || []).length, 1);
  assert.match(pricing, /<p className="pro-plan__renew">\{terms\.renew\}<\/p>/);
  assert.match(pricing, /mm-plans__fold/, 'phones get How Free works as a folded block');
  assert.doesNotMatch(pricing, /originalPrice|<s>|countdown|only \d+ left/i);
});

test('W-099: the top-chapter finding and the next-step key each have one home', () => {
  // Review is review/ReviewPage.jsx since the Learn and Review packet (P-LR1); it has its own next move and never the Today key.
  for (const file of ['ReviewPage', 'PapersView', 'ChapterRows', 'ReviewNextMove']) assert.doesNotMatch(read(`src/components/review/${file}.jsx`), /LearningNextAction/, `Review: ${file}`);
  assert.doesNotMatch(read('src/app/(app)/analytics/AnalyticsPageClient.jsx'), /LearningNextAction/, 'Weak chapters');
  assert.match(read('src/components/RecoveryOverview.jsx'), /<ReviewPage /, 'Review is its own page; Progress keeps the overview');
  for (const rel of ['src/components/ai/AskMobiPanel.jsx', 'src/components/ai/MentorRecordPage.jsx']) {
    assert.doesNotMatch(read(rel), /findings\[0\]\.headline/, `${rel}: Ask Mobi links to the finding instead of repeating it`);
  }
  const rhythm = read('src/components/RhythmCard.jsx');
  assert.match(rhythm, /compact \? \(\s*<div className="rc__top">/, 'only Today’s compact card draws the ring and seven days');
});
