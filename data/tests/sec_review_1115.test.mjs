// The independent review of the 15 Nov 2026 security release found these; each is locked here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nameBlocked } from '../../src/lib/mob/model.mjs';
import { mobNameBlocklist } from '../../src/lib/mob/nameTerms.mjs';
import { needsSupport } from '../../src/services/ai/supportCheck.js';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const LIST = mobNameBlocklist(JSON.parse(read('data/mob_name_blocklist.json')));

test('names: an ordinary double letter is a name, a stretched letter is not', () => {
  for (const name of ['Poornima', 'Poorna', 'Lavdeep', 'Kaminee', 'Kute', 'Shital', 'Kshitij', 'Haramohan', 'Kuttan', 'Aarav', 'Sneha Reddy', 'Deepika']) {
    assert.equal(nameBlocked(name, LIST), false, `${name} is allowed`);
  }
  for (const name of ['pooorn', 'fuuuck', 'Harami', 'Kutta', 'kutteee', 'lavde', 'chutiya']) {
    assert.equal(nameBlocked(name, LIST), true, `${name} is refused`);
  }
});

test('distress: the plain phrases the first list missed get the support reply', () => {
  for (const said of ['I feel like ending it all', 'i feel like dying', "I don't want to be here anymore", 'I wish I could die', 'kms', 'wish i was dead']) {
    assert.equal(needsSupport(said), true, said);
  }
  for (const said of ['how do I end this chapter fast', 'what is the kms unit in physics', 'I wish I could finish the syllabus', 'explain dying declaration in evidence law']) {
    assert.equal(needsSupport(said), false, said);
  }
});

test('sign-in emails: 60 an hour a network, so a school lab is not locked out', () => {
  assert.match(read('src/lib/server/emailLoginPolicy.js'), /route: '\/api\/auth\/email-login#ip', limit: 60, windowMs: HOUR_MS/);
});

test('cancel: a subscription id Razorpay does not know is not counted as unknown', () => {
  const route = read('src/app/api/billing/cancel/route.js');
  assert.match(route, /if \(status !== 400 && status !== 404\) unknown \+= 1;/);
});

test('practice restart: a rebuilt paper that differs keeps the first clock and is not refused', () => {
  const src = read('src/lib/server/practiceSessions.js');
  assert.doesNotMatch(src, /first\.paper !== paper\) throw/);
  assert.match(src, /if \(first\) created = first\.at;/);
});
