// L1 (15 Nov 2026): a student in distress. The check (src/services/ai/supportCheck.js) on a table of phrases in English,
// Hindi in Devanagari and Hinglish, both system prompts, guest Ask Mobi's support path (no bucket, no model) and the panel's
// wiring. The signed-in route is run in data/tests/mobi_safety_route.test.mjs. Fakes only: no network, no model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { needsSupport, SUPPORT_REPLY, SUPPORT_PROMPT_RULE } from '../../src/services/ai/supportCheck.js';
import { buildFactSheet, buildGuestPrompt, createGuestMobi, signVisitor, PROMPT_BYTE_CAP, GUEST_QUESTIONS, GUEST_SUPPORT_RULE } from '../../src/lib/server/guestMobi.js';
import { planStart } from '../../src/components/ai/startPlan.mjs';
import { sourceOf } from '../../src/components/ai/mentorHistory.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

// [phrase, needs support]
const TABLE = [
  // English: distress
  ['I want to kill myself', true],
  ['no point living anymore', true],
  ["I can't go on", true],
  ['I will die if I fail maths', true], // said lightly or not, a kind reply costs nothing
  ['i wanna die lol', true],
  ['I feel suicidal before every mock', true],
  ['I want to end my life', true],
  ['I just want to disappear', true],
  ['nobody would miss me if I was gone', true],
  ['everyone would be better off without me', true],
  ['I have been cutting myself', true],
  ['I hurt myself when I get low marks', true],
  ['My father beats me when my marks are low', true],
  ["my uncle touches me and I don't like it", true],
  ["I'm being abused at home", true],
  ["I don't want to live anymore", true],
  ["I can't take it anymore", true],
  ["I'm so tired of living", true],
  ['life is not worth living', true],
  ['this test makes me want to kms', true],
  ["I don't feel safe at home", true],
  ['I want to jump off the roof', true],
  ["I'm worthless", true],
  // English: exam talk, not distress
  ['this chapter is killing me', false],
  ["I'm dead tired after the mock", false],
  ['accountancy is killing me lol', false],
  ['how do I kill it in the exam', false],
  ['what is the deadline for CUET registration', false],
  ["I'm dying to know my score", false],
  ['beats me how goodwill is calculated', false],
  ['explain the death of a partner in accountancy', false],
  ['what happens when a partner dies', false],
  ['how do I cut down my time in the full mock', false],
  ['cutting costs is part of controlling, right?', false],
  ['I hate this chapter so much', false],
  ["I'm hopeless at accounts, how do I improve", false],
  ["I can't go on to the next chapter without this", false],
  ['hang on, explain the second option again', false],
  ['I want to end the mock early, is that allowed', false],
  ['a car travels 60 kms in an hour', false],
  // Hinglish: distress
  ['marna chahta hoon', true],
  ['jeena nahi hai', true],
  ['khatam kar lunga', true],
  ['mujhe marna hai', true],
  ['fail hua toh mar jaunga', true],
  ['main khud ko khatam kar lungi', true],
  ['ab jeene ka mann nahi karta', true],
  ['zindagi se tang aa gaya hu', true],
  ['papa mujhe maarte hain', true],
  ['suicide kar lunga', true],
  ['khudkushi kar lunga', true],
  ['sab khatam kar dunga', true],
  // Hinglish: exam talk
  ['main fail ho jaunga kya', false],
  ['marks nahi aa rahe, kya karu', false],
  ['is chapter ne maar dala', false],
  ['aaj chapter khatam kar lunga', false],
  ['syllabus kab tak khatam kar lunga', false],
  ['padhai mein mann nahi lagta', false],
  ['mujhe ratta marna hai kya', false],
  ['concept pehle jaan lena chahiye na', false],
  // Hindi in Devanagari: distress
  ['मैं मरना चाहता हूँ', true],
  ['जीना नहीं है', true],
  ['मैं आत्महत्या कर लूंगा', true],
  ['मुझे जीने का मन नहीं करता', true],
  ['पापा मुझे मारते हैं', true],
  ['मैं ख़ुद को ख़त्म कर लूँगी', true],
  ['ज़िंदगी से तंग आ गई हूं', true],
  ['खत्म कर लूंगा', true],
  // Hindi in Devanagari: exam talk
  ['मुझे अकाउंटेंसी समझ नहीं आती', false],
  ['मैं बहुत थक गया हूं', false],
  ['आज चैप्टर खत्म कर लूंगा', false],
  ['पार्टनर की मृत्यु पर क्या होता है', false],
  ['मॉक टेस्ट कितने देने चाहिए', false],
];

test('the phrase table: at least 30 phrases in three scripts, distress caught and exam talk left alone', () => {
  assert.ok(TABLE.length >= 30);
  const devanagari = TABLE.filter(([p]) => /[ऀ-ॿ]/.test(p));
  assert.ok(devanagari.length >= 8 && TABLE.filter(([p]) => /\b(nahi|marna|jeena|khatam|mujhe|zindagi)\b/.test(p)).length >= 8);
  const wrong = TABLE.filter(([phrase, want]) => needsSupport(phrase) !== want).map(([phrase, want]) => `${want ? 'missed' : 'false alarm'}: ${phrase}`);
  assert.deepEqual(wrong, []);
});

test('the check holds up to case, punctuation, curly apostrophes and empty input', () => {
  assert.equal(needsSupport('I CAN’T GO ON!!!'), true);
  assert.equal(needsSupport('i...want...to...die'), true);
  assert.equal(needsSupport('मैं मरना चाहती हूँ।'), true);
  for (const nothing of ['', '   ', null, undefined, 42, {}]) assert.equal(needsSupport(nothing), false);
});

test('the support reply is the owner\'s exact words, with Tele-MANAS 14416 and 112', () => {
  assert.equal(SUPPORT_REPLY, "This sounds really hard, and I'm glad you told me. I'm a study helper, so I can't give you the support you deserve right now. Please talk to someone you trust today: a parent, a teacher or a friend. You can also call Tele-MANAS on 14416. It is free, open all day and night, and they speak your language. If you are in danger right now, call 112.");
});

test('the signed-in system prompt puts the safety rule first and keeps it above the off-topic rule', () => {
  const src = read('src/services/ai/systemPrompt.js');
  assert.match(src, /return \[SAFETY\.trim\(\), PERSONA\.trim\(\)/, 'SAFETY is the first block of every mentor prompt');
  assert.match(src, /SAFETY FIRST \(this overrides every rule below, including the off-topic rule/);
  assert.match(src, /redirect briefly to CUET prep; do not answer the off-topic question\. Never for distress or safety: SAFETY FIRST applies\./);
  for (const words of ['do not steer back to CUET', '14416', '112', 'Never give methods', 'never diagnose', 'never promise to keep a secret']) {
    assert.ok(SUPPORT_PROMPT_RULE.includes(words), words);
  }
});

test('the guest prompt carries the same rule, stops sending distress to "only CUET prep", and still fits its byte cap', () => {
  const facts = buildFactSheet({ offer: { monthly: { planId: 'pro_monthly_99', rupees: 99, interval: 'month', autoRenews: true, ready: false }, oneTime: { planId: 'pro_cuet_2027', rupees: 99, expires: '31 July 2027', onSale: true }, purchasable: 'one_time' }, keyCards: true });
  const built = buildGuestPrompt({ facts, message: 'x'.repeat(280), sample: { score: 2, total: 5, subject: 'Accountancy', misses: [{ n: 1, chapter: 'A' }, { n: 2, chapter: 'B' }, { n: 3, chapter: 'C' }] } });
  assert.ok(built.systemPrompt.includes(GUEST_SUPPORT_RULE));
  for (const words of ['do not steer back to CUET', 'two or three sentences', '14416', '112', 'Never give methods, never diagnose, never promise secrecy']) {
    assert.ok(GUEST_SUPPORT_RULE.includes(words), words);
  }
  assert.match(built.systemPrompt, /Apart from distress, if it is off-topic, harmful/);
  assert.doesNotMatch(built.systemPrompt, /If it is off-topic, unsafe, asks for personal data/, 'distress is no longer "one polite sentence that you only help with CUET prep"');
  assert.ok(built.bytes <= PROMPT_BYTE_CAP, `${built.bytes} bytes`);
  assert.ok(built.userMessage.endsWith('x'.repeat(280)), 'the whole question still fits');
});

function guestHarness({ state = 'on' } = {}) {
  const calls = { take: [], giveBack: [], model: [], log: [] };
  const guest = createGuestMobi({
    state: () => state, secret: 'test-secret', now: () => Date.UTC(2026, 10, 15, 12), randomId: () => 'visitor000000000000001',
    log: (line) => calls.log.push(line),
    take: async (scope) => { calls.take.push(scope); return { allowed: true }; },
    giveBack: async (scope) => { calls.giveBack.push(scope); return true; },
    callModel: async (args) => { calls.model.push(args); return { ok: true, raw: 'A model reply.', dispatched: true }; },
    facts: [],
  });
  return { guest, calls };
}

test('guest Ask Mobi: a distress message gets the support reply, takes no bucket, uses no question and calls no model', async () => {
  for (const message of ['I want to kill myself', 'marna chahta hoon', 'मैं मरना चाहता हूँ']) {
    const { guest, calls } = guestHarness();
    const res = await guest.handle({ body: { message } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { state: 'answered', reply: SUPPORT_REPLY, left: GUEST_QUESTIONS, support: true });
    assert.equal(res.setCookie, undefined, 'the cookie count is not touched');
    assert.deepEqual([calls.take, calls.model], [[], []]);
    assert.ok(calls.log.every((line) => !line.includes(message)), 'the visitor\'s words are never logged');
  }
  // Even with the guest switch off, and with the three questions used.
  const off = guestHarness({ state: 'off' });
  assert.equal((await off.guest.handle({ body: { message: 'I want to die' } })).body.reply, SUPPORT_REPLY);
  const used = guestHarness();
  const spent = signVisitor({ id: 'A'.repeat(22), count: 3, issuedAt: Date.UTC(2026, 10, 15, 11) }, 'test-secret');
  const r = await used.guest.handle({ body: { message: 'jeena nahi hai' }, cookie: spent });
  assert.deepEqual([r.status, r.body.reply, r.body.left], [200, SUPPORT_REPLY, 0]);
  // Ordinary questions go the normal way.
  const normal = guestHarness();
  assert.equal((await normal.guest.handle({ body: { message: 'this chapter is killing me, how do I revise it?' } })).body.reply, 'A model reply.');
  assert.equal(normal.calls.model.length, 1);
});

test('the panel and the /mentor doors send distress to the support reply before any record, product or paid path', () => {
  const plan = planStart({ initial: { text: 'I want to die' }, status: 'ready', insights: { state: 'empty' }, wallet: null, offline: false, paid: { open: false, why: 'Out of credits' } });
  assert.deepEqual(plan, { kind: 'support', text: 'I want to die' }, 'even with no wallet read and no credits');
  assert.equal(planStart({ initial: { text: 'How do I revise Partnership?', free: true }, status: 'ready', insights: { state: 'empty' }, paid: { open: false } }).kind, 'record-failed');
  const panel = read('src/components/ai/AskMobiPanel.jsx');
  const submit = panel.slice(panel.indexOf('function submit()'), panel.indexOf('async function sendPaid'));
  assert.ok(submit.indexOf('needsSupport(text)') > 0 && submit.indexOf('needsSupport(text)') < submit.indexOf('followUpOpen(doubtThread)'), 'checked first in submit');
  assert.ok(submit.indexOf('needsSupport(text)') < submit.indexOf('productAskFor(text)') && submit.indexOf('needsSupport(text)') < submit.indexOf('answerFromInsights('));
  assert.match(panel, /else if \(plan\.kind === 'support'\) sendSupport\(plan\.text\);/);
  assert.match(panel, /\|\| needsSupport\(input\)\);/, 'the Ask key is open for it with no credits');
  assert.match(panel, /response\.origin === 'status' \|\| response\.origin === 'safety'\) source = null;/, 'no "From your record" line under it');
  assert.match(panel, /if \(sent\.kind === 'support'\) \{ pendingRef\.current = null; setTurns\(\(prev\) => \[\.\.\.prev, supportTurn\(\)\]\); \}/, 'shown even if the server cannot be reached');
  assert.equal(sourceOf({ origin: 'safety', reply: SUPPORT_REPLY }), null);
});
