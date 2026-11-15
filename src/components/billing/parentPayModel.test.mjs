import test from 'node:test';
import assert from 'node:assert/strict';
import { PARENT_PAY_COPY, linkUntil, parentMessage, previewParentReply, sheetStateFor, whatsappHref } from './parentPayModel.mjs';

// 15 Nov 2026, 2:30 pm in India.
const NOW = Date.parse('2026-11-15T09:00:00Z');

test('the sheet\'s one line says only what the code backs, with the offer\'s price', () => {
  const line = PARENT_PAY_COPY.line(99);
  assert.equal(line, 'Send this link to a parent. They pay ₹99 a month on their own phone, and Pro turns on for your account within a few minutes. You can cancel any time in Account.');
  // The parent cannot be promised a cancel we cannot do for them; the student cancels in Account.
  assert.doesNotMatch(line, /They can cancel/);
  for (const text of [line, ...Object.values(PARENT_PAY_COPY).filter((v) => typeof v === 'string')]) {
    assert.doesNotMatch(text, /!|→|->/, text);
  }
});

test('the link\'s end in India time on a 12-hour clock', () => {
  assert.equal(linkUntil('2026-11-15T13:10:00Z', NOW), '6:40 pm today');
  assert.equal(linkUntil('2026-11-16T08:50:00Z', NOW), '2:20 pm tomorrow');
  assert.equal(linkUntil('2026-11-18T03:30:00Z', NOW), '9:00 am on 18 Nov');
  // Just past midnight in India is the next day, though it is still the 15th in UTC.
  assert.equal(linkUntil('2026-11-15T18:40:00Z', NOW), '12:10 am tomorrow');
  assert.equal(linkUntil(null, NOW), null);
  assert.equal(linkUntil('not a date', NOW), null);
});

test('the message to the parent names MockMob, the price and the link, and the student only by a name they gave', () => {
  const url = 'https://rzp.io/i/AbC12';
  const named = parentMessage({ url, firstName: 'Asha', rupees: 99, expiresAt: '2026-11-16T08:50:00Z', nowMs: NOW });
  assert.equal(named, "Hi, it's Asha. Can you pay for my MockMob Pro? It is for CUET practice, ₹99 a month, and I can cancel it any time. This Razorpay link works until 2:20 pm tomorrow: https://rzp.io/i/AbC12");
  const unnamed = parentMessage({ url, firstName: null, rupees: 99, expiresAt: null, nowMs: NOW });
  assert.equal(unnamed, 'Hi, can you pay for my MockMob Pro? It is for CUET practice, ₹99 a month, and I can cancel it any time. Pay on Razorpay here: https://rzp.io/i/AbC12');
  assert.doesNotMatch(named + unnamed, /!/);
});

test('WhatsApp opens with the message written and no number chosen', () => {
  const href = whatsappHref("Hi, it's Asha. ₹99 a month & more: https://rzp.io/i/x?y=1");
  assert.match(href, /^https:\/\/wa\.me\/\?text=/);
  assert.equal(decodeURIComponent(href.split('?text=')[1]), "Hi, it's Asha. ₹99 a month & more: https://rzp.io/i/x?y=1");
  assert.doesNotMatch(href.split('?text=')[1], /[ &#]/, 'every character that could cut the message is encoded');
});

test('each server answer becomes one designed state', () => {
  const ready = sheetStateFor(200, { url: 'https://rzp.io/i/x', expiresAt: '2026-11-16T08:50:00Z', amount: 9900, firstName: 'Asha' });
  assert.deepEqual(ready, { kind: 'ready', url: 'https://rzp.io/i/x', expiresAt: '2026-11-16T08:50:00Z', firstName: 'Asha', rupees: 99 });
  assert.equal(sheetStateFor(200, { url: 'javascript:alert(1)' }).kind, 'failed', 'a link that is not https is never shown');
  assert.equal(sheetStateFor(200, {}).kind, 'failed');
  assert.deepEqual(sheetStateFor(409, { error: 'Pro access is already active on this account.', code: 'already_active' }), { kind: 'pro', message: 'Pro access is already active on this account.' });
  assert.equal(sheetStateFor(409, { error: 'x', code: 'subscription_open' }).kind, 'held');
  assert.deepEqual(sheetStateFor(500, { error: 'We could not make the link. Try again in a minute. Nothing was charged.' }), { kind: 'failed', message: 'We could not make the link. Try again in a minute. Nothing was charged.', retry: true });
  assert.equal(sheetStateFor(429, { error: 'Too many', code: 'rate_limited' }).retry, true);
  for (const code of ['parent_pay_off', 'monthly_not_ready', 'signed_out']) assert.equal(sheetStateFor(409, { error: 'x', code }).retry, false, code);
  // A network failure (no body) still says nothing was charged and offers a retry.
  assert.deepEqual(sheetStateFor(0, null), { kind: 'failed', message: 'We could not make the link. Try again in a minute. Nothing was charged.', retry: true });
});

test('the development previews answer like the route, and "making" never answers', () => {
  assert.equal(previewParentReply('making', NOW), null);
  assert.equal(sheetStateFor(previewParentReply('ready', NOW).status, previewParentReply('ready', NOW).body).kind, 'ready');
  assert.equal(sheetStateFor(previewParentReply('noname', NOW).status, previewParentReply('noname', NOW).body).firstName, null);
  for (const [kind, want] of [['fail', 'failed'], ['pro', 'pro'], ['held', 'held'], ['off', 'failed']]) {
    const reply = previewParentReply(kind, NOW);
    assert.equal(sheetStateFor(reply.status, reply.body).kind, want, kind);
  }
});
