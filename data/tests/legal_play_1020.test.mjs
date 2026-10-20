// L-08 (20 Oct 2026): the legal pages describe the product students have now. Source-level checks of the privacy, refund,
// terms and account-deletion pages: no push-token claim (the Android app has no push, only reminders scheduled on the phone),
// Google Play named where money is described, the app-release gate open, no internal jargon, no dashes as punctuation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_STREAM_AND_REPORT_LIVE } from '../../src/lib/appReleaseGates.mjs';
import { PLAY_PRODUCTS, PLAY_SUBSCRIPTION_ID } from '../../src/lib/payments/playProducts.js';
import { DELETION_STEPS } from '../../src/lib/server/accountDeletion.js';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const PAGES = ['src/app/privacy/page.js', 'src/app/refunds/page.js', 'src/app/terms/page.js', 'src/app/account-deletion/page.js', 'src/components/mob/MobLegal.jsx'];
const body = (f) => read(f).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

test('app version 13 is out, so the stream events and the AI reply report are described on /privacy', () => {
  assert.equal(APP_STREAM_AND_REPORT_LIVE, true);
  const page = read('src/app/privacy/page.js');
  assert.match(page, /Question stream activity \(required in the app\)/);
  assert.match(page, /Reporting an AI reply/);
  // The event details match api/questions/[id]/interact: the picked option travels, correctness is worked out on the server,
  // and the time on screen is sent when the app has it (the server requires it only for skip).
  assert.match(page, /we work out from it whether you were right/);
  assert.match(page, /when the app sends it, how long the question was on screen/);
});

test('/privacy and /account-deletion make no push-token claim: the app schedules reminders on the phone and has no push', () => {
  for (const f of ['src/app/privacy/page.js', 'src/app/account-deletion/page.js']) assert.doesNotMatch(body(f), /push (notification )?tokens?/i, f);
  const page = read('src/app/privacy/page.js');
  assert.match(page, /scheduled on your phone by the app/);
  assert.match(page, /does not send push notifications/);
  assert.match(page, /notification preferences and study goal/);
});

test('Google Play is named on /privacy, /refunds and /terms, and the website stays Razorpay', () => {
  for (const f of ['src/app/privacy/page.js', 'src/app/refunds/page.js', 'src/app/terms/page.js']) {
    assert.match(body(f), /Google Play/, f);
    assert.match(body(f), /Razorpay/, f);
  }
  const privacy = read('src/app/privacy/page.js');
  assert.match(privacy, /<b>On the website<\/b>, payments are handled by Razorpay/);
  assert.match(privacy, /<b>In the Android app<\/b>, Pro \(a monthly subscription\) and credit packs are bought with Google Play Billing/);
  assert.match(privacy, /Google holds your payment method/);
  assert.match(privacy, /we first cancel any Pro subscription of yours that Google could still charge/);
  assert.match(privacy, /Cancelling the renewal does not refund the month you already paid for/);
});

test('the Play statements match the code: one monthly subscription, credit packs, refunds taken back, renewal cancelled before deletion', () => {
  // Pro on Play is the monthly subscription, and the packs are consumed products (so "one-time purchases" is true).
  assert.equal(PLAY_PRODUCTS[PLAY_SUBSCRIPTION_ID].kind, 'pro_sub');
  const packs = Object.values(PLAY_PRODUCTS).filter((p) => p.kind === 'ai_credits' && !p.legacy);
  assert.ok(packs.length >= 1 && packs.every((p) => p.finish === 'consume'));
  // A voided (refunded) purchase takes back what it granted.
  assert.match(read('src/lib/payments/playBilling.js'), /voidedPurchaseNotification/);
  // The deletion processor cancels the Play renewal first and keeps a cut-down purchase record.
  assert.match(read('src/lib/server/accountDeletion.js'), /stopPlayRenewals/);
  const kept = DELETION_STEPS.find((s) => s.table === 'play_purchases');
  assert.equal(kept.action, 'anonymise');
  assert.equal(DELETION_STEPS.find((s) => s.table === 'ai_credit_wallets').action, 'delete');
  // The page that says so is the refund page, and it names the Play Store route and Google's refund policy.
  const refunds = read('src/app/refunds/page.js');
  assert.match(refunds, /Payments and subscriptions/);
  assert.match(refunds, /follow Google Play&apos;s refund policy/);
  assert.match(refunds, /Uninstalling the app does not cancel it/);
  assert.match(refunds, /Deleting your account does not refund the month you already paid for/);
  assert.match(read('src/app/terms/page.js'), /Purchases in the Android app are billed by Google Play/);
});

test('no Play price is printed on a legal page (Play shows its own), and the website pages keep theirs', () => {
  for (const f of ['src/app/privacy/page.js', 'src/app/terms/page.js']) assert.doesNotMatch(body(f), /₹\s?\d/, f);
  const refunds = body('src/app/refunds/page.js');
  assert.match(refunds, /Play shows its own price before you buy/);
  // The only rupee amount on /refunds is the website's monthly plan, in the Razorpay section.
  assert.deepEqual([...refunds.matchAll(/₹\d+/g)].map((m) => m[0]).filter((v, i, a) => a.indexOf(v) === i), ['₹99']);
});

test('the Mobi job jargon is gone from /privacy, and the date is 20 October 2026 on the four pages', () => {
  assert.doesNotMatch(body('src/app/privacy/page.js'), /Mobi job/);
  assert.match(read('src/app/privacy/page.js'), /A doubt with its follow-up, or a mistake fixed for good, uses 1 credit/);
  for (const f of ['src/app/privacy/page.js', 'src/app/refunds/page.js', 'src/app/terms/page.js', 'src/app/account-deletion/page.js']) {
    assert.match(read(f), /Last updated: (\{[^}]*\} )?20 October 2026|Last updated: 20 October 2026/, f);
  }
});

test('house style: no em or en dashes in the legal copy', () => {
  for (const f of PAGES) assert.doesNotMatch(body(f), /[–—]/, f);
});
