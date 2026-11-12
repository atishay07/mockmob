// Ask Mobi for guests (src/lib/server/guestMobi.js): validation, the kill switch, the three buckets in order, the give-back
// rule, the signed visitor cookie, the prompt builder and the reply sanitizer. Fakes only: no network, no database, no model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUEST_QUESTIONS, MAX_OUTPUT_TOKENS, PROMPT_BYTE_CAP, REPLY_MAX, VISITOR_WINDOW_MS, COOKIE_NAME,
  parseGuestBody, signVisitor, readVisitor, visitorCookieHeader, buildFactSheet, buildGuestPrompt, sanitizeReply,
  createGuestMobi, limitOptions,
} from '../../src/lib/server/guestMobi.js';
import { buildFaqs, PLAN_HOME, VALUE_COPY, COMPASS_HEAD, DU_HEAD } from '../../src/components/landing/homeCopy.mjs';
import { MODE_SPECS } from '../../src/lib/paperCopy.mjs';
import { SUBJECT_CLAIM } from '../subject_claim.js';

const SECRET = 'test-secret';
const OFFER = Object.freeze({
  monthly: { planId: 'pro_monthly_99', rupees: 99, interval: 'month', autoRenews: true, ready: false },
  oneTime: { planId: 'pro_cuet_2027', rupees: 99, expires: '31 July 2027', onSale: true },
  purchasable: 'one_time',
});
const FACTS = buildFactSheet({ offer: OFFER, keyCards: true });
const NOW = Date.UTC(2026, 10, 13, 12);
const SAMPLE = { score: 3, total: 5, subject: 'Accountancy', misses: [{ n: 2, chapter: 'Partnership accounts' }, { n: 4, chapter: 'Cash flow statement' }] };

function harness({ state = 'on', refuse = null, model = null } = {}) {
  const calls = { take: [], giveBack: [], model: [] };
  let ids = 0;
  const guest = createGuestMobi({
    state: () => state,
    secret: SECRET,
    now: () => NOW,
    randomId: () => `visitor${String(++ids).padStart(15, '0')}`,
    log: () => {},
    take: async (scope, id) => { calls.take.push([scope, id]); return { allowed: scope !== refuse }; },
    giveBack: async (scope, id) => { calls.giveBack.push([scope, id]); return true; },
    callModel: async (args) => { calls.model.push(args); return model ? model(args) : { ok: true, raw: 'Take one full mock tonight. It shows where your marks go.', dispatched: true }; },
    facts: FACTS,
  });
  return { guest, calls };
}
const cookieValue = (header) => header.split(';')[0].slice(COOKIE_NAME.length + 1);

test('validation: message 1..280, history at most 4 well-formed lines, sample strict, everything rebuilt from a whitelist', () => {
  assert.equal(parseGuestBody(null).ok, false);
  assert.equal(parseGuestBody([]).ok, false);
  assert.equal(parseGuestBody({ message: '   ' }).ok, false);
  assert.equal(parseGuestBody({ message: 'x'.repeat(281) }).ok, false);
  assert.equal(parseGuestBody({ message: 42 }).ok, false);
  assert.equal(parseGuestBody({ message: 'x'.repeat(280) }).ok, true);
  const ok = parseGuestBody({ message: '  Which subjects for B.Com?  ', extra: 'dropped' });
  assert.deepEqual(ok, { ok: true, message: 'Which subjects for B.Com?', history: [], sample: null });

  assert.equal(parseGuestBody({ message: 'hi', history: Array.from({ length: 5 }, () => ({ role: 'user', text: 'a' })) }).ok, false);
  assert.equal(parseGuestBody({ message: 'hi', history: [{ role: 'system', text: 'a' }] }).ok, false);
  assert.equal(parseGuestBody({ message: 'hi', history: [{ role: 'user', text: '' }] }).ok, false);
  const long = parseGuestBody({ message: 'hi', history: [{ role: 'mobi', text: 'b'.repeat(900), secret: 'x' }] });
  assert.equal(long.history[0].text.length, 400);
  assert.deepEqual(Object.keys(long.history[0]), ['role', 'text']);

  const bad = [
    { score: 6, total: 5, misses: [] }, { score: 3, total: 10, misses: [{ chapter: 'a' }] }, { score: 3, total: 5, misses: [] },
    { score: 5, total: 5, misses: [{ chapter: 'a' }] }, { score: 3, total: 5, misses: [{ n: 0, chapter: 'a' }] },
    { score: 3, total: 5, misses: [{ n: 2, chapter: 'a' }, { n: 2, chapter: 'b' }] }, { score: 3, total: 5, misses: [{ n: 1, chapter: 'c'.repeat(81) }] },
    { score: 3, total: 5, subject: 's'.repeat(41), misses: [{ chapter: 'a' }] }, { score: 0, total: 5, misses: Array.from({ length: 6 }, (_, i) => ({ chapter: `c${i}` })) },
    { score: '3', total: 5, misses: [{ chapter: 'a' }] }, 'a string', [1, 2],
  ];
  for (const sample of bad) assert.equal(parseGuestBody({ message: 'hi', sample }).ok, false, JSON.stringify(sample));
  const good = parseGuestBody({ message: 'hi', sample: { ...SAMPLE, evil: 'drop me', misses: [{ n: 2, chapter: 'Partnership <b>accounts</b>', x: 1 }] } });
  assert.deepEqual(good.sample, { score: 3, total: 5, subject: 'Accountancy', misses: [{ n: 2, chapter: 'Partnership baccounts/b' }] });
  // The note kept in the browser names chapters only (sampleCarry.mjs): no question number is fine.
  assert.equal(parseGuestBody({ message: 'hi', sample: { score: 4, total: 5, misses: [{ chapter: 'Ratios' }] } }).ok, true);
});

test('invalid input is refused before anything else, and the kill switch before any bucket or model', async () => {
  const bad = harness();
  const res = await bad.guest.handle({ body: { message: '' } });
  assert.equal(res.status, 400);
  assert.equal(bad.calls.take.length + bad.calls.model.length, 0);

  const off = harness({ state: 'off' });
  const r = await off.guest.handle({ body: { message: 'hi' } });
  assert.deepEqual([r.status, r.body], [503, { state: 'off' }]);
  assert.equal(off.calls.take.length + off.calls.model.length, 0);
});

test('an answer takes site, network, visitor in that order, then calls the model once with the caps', async () => {
  const { guest, calls } = harness();
  const res = await guest.handle({ body: { message: 'What should I do tonight?', sample: SAMPLE } });
  assert.equal(res.status, 200);
  assert.equal(res.body.state, 'answered');
  assert.equal(res.body.left, GUEST_QUESTIONS - 1);
  assert.deepEqual(calls.take.map(([s]) => s), ['site', 'network', 'visitor']);
  assert.equal(calls.model.length, 1);
  assert.equal(calls.model[0].maxTokens, MAX_OUTPUT_TOKENS);
  assert.match(calls.model[0].requestKey, /^[a-zA-Z0-9_:-]{12,180}$/);
  assert.match(res.setCookie, /^mm_gm=v1\.[^;]+; Path=\/api\/mobi\/guest; Max-Age=\d+; HttpOnly; SameSite=Lax; Secure$/);
  assert.equal(readVisitor(cookieValue(res.setCookie), SECRET, NOW).count, 1);
});

for (const [scope, takenBefore] of [['site', []], ['network', ['site']], ['visitor', ['site', 'network']]]) {
  test(`the ${scope} limit refuses with 429, takes nothing after it, gives back what it took and never calls the model`, async () => {
    const { guest, calls } = harness({ refuse: scope });
    const res = await guest.handle({ body: { message: 'hi' } });
    assert.deepEqual([res.status, res.body], [429, { state: 'limit', scope, left: 0 }]);
    assert.deepEqual(calls.take.map(([s]) => s), [...takenBefore, scope]);
    assert.deepEqual(calls.giveBack.map(([s]) => s), takenBefore);
    assert.equal(calls.model.length, 0);
  });
}

test('the visitor bucket is keyed by the signed id, identity only, over a window take_rate_limit can hold', () => {
  const v = limitOptions('visitor', { visitorId: 'abc' });
  assert.deepEqual([v.limit, v.identityOnly, v.keyParts], [GUEST_QUESTIONS, true, ['abc']]);
  assert.ok(VISITOR_WINDOW_MS <= 2_147_483_647, 'p_window_ms is an int4');
  assert.deepEqual([limitOptions('network').limit, limitOptions('network').identityOnly], [12, undefined]);
  assert.equal(limitOptions('site', { siteLimit: 1000 }).identityOnly, true);
});

test('a cookie that says three were used is refused with no bucket touched; a cleared count does not get past the bucket', async () => {
  const { guest, calls } = harness();
  const spent = signVisitor({ id: 'A'.repeat(22), count: 3, issuedAt: NOW - 1000 }, SECRET);
  const res = await guest.handle({ body: { message: 'hi' }, cookie: spent });
  assert.deepEqual([res.status, res.body.scope], [429, 'visitor']);
  assert.equal(calls.take.length, 0);
  // An old cookie for the same id with count 0 (replayed): the server-side bucket for that id refuses.
  const replay = harness({ refuse: 'visitor' });
  const r = await replay.guest.handle({ body: { message: 'hi' }, cookie: signVisitor({ id: 'A'.repeat(22), count: 0, issuedAt: NOW - 1000 }, SECRET) });
  assert.equal(r.body.scope, 'visitor');
  assert.equal(replay.calls.take.at(-1)[1], 'A'.repeat(22));
  assert.equal(readVisitor(cookieValue(r.setCookie), SECRET, NOW).count, 3);
});

test('cookie signature: a tampered count or id, a foreign secret or an expired cookie is rejected and replaced by a new id', async () => {
  const good = signVisitor({ id: 'B'.repeat(22), count: 2, issuedAt: NOW - 5000 }, SECRET);
  assert.deepEqual(readVisitor(good, SECRET, NOW), { id: 'B'.repeat(22), count: 2, issuedAt: NOW - 5000 });
  const parts = good.split('.');
  const tamperedCount = [parts[0], parts[1], '0', parts[3], parts[4]].join('.');
  const tamperedId = [parts[0], 'C'.repeat(22), parts[2], parts[3], parts[4]].join('.');
  assert.equal(readVisitor(tamperedCount, SECRET, NOW), null);
  assert.equal(readVisitor(tamperedId, SECRET, NOW), null);
  assert.equal(readVisitor(good, 'other-secret', NOW), null);
  assert.equal(readVisitor(good, SECRET, NOW + 31 * 86_400_000), null);
  assert.equal(readVisitor('garbage', SECRET, NOW), null);
  assert.equal(readVisitor(signVisitor({ id: 'B'.repeat(22), count: 9, issuedAt: NOW }, SECRET), SECRET, NOW), null);

  const { guest, calls } = harness();
  const res = await guest.handle({ body: { message: 'hi' }, cookie: tamperedCount });
  const fresh = readVisitor(cookieValue(res.setCookie), SECRET, NOW);
  assert.notEqual(fresh.id, 'B'.repeat(22));
  assert.equal(fresh.count, 1);
  assert.equal(calls.take.find(([s]) => s === 'visitor')[1], fresh.id);
  // The cookie's age is kept from its first issue: re-setting it never extends the 30 days.
  const header = visitorCookieHeader({ id: 'D'.repeat(22), count: 1, issuedAt: NOW - 86_400_000 }, SECRET, { now: NOW, secure: false });
  assert.match(header, /Max-Age=2505600; HttpOnly; SameSite=Lax$/);
});

test('give-back: an unbilled failure returns the three counts; a dispatched failure or an empty reply keeps them (failures count)', async () => {
  const unbilled = harness({ model: () => ({ ok: false, errorKind: 'guard_paused' }) });
  const a = await unbilled.guest.handle({ body: { message: 'hi' } });
  assert.deepEqual([a.status, a.body], [503, { state: 'unavailable', left: 3 }]);
  assert.deepEqual(unbilled.calls.giveBack.map(([s]) => s).sort(), ['network', 'site', 'visitor']);

  for (const model of [() => ({ ok: false, errorKind: 'timeout', dispatched: true }), () => ({ ok: true, raw: '  ** ##  ', dispatched: true }), () => { throw new Error('boom'); }]) {
    const billed = harness({ model });
    const b = await billed.guest.handle({ body: { message: 'hi' } });
    assert.deepEqual([b.status, b.body], [503, { state: 'unavailable', left: 2 }]);
    assert.equal(billed.calls.giveBack.length, 0);
    assert.equal(billed.calls.model.length, 1, 'one attempt, no retry');
  }
});

test('the fact sheet: every line is a string the home page already shows', () => {
  const faqs = buildFaqs({ offer: OFFER });
  const answer = (q) => faqs.find((f) => f.question.startsWith(q)).answer;
  const sources = [SUBJECT_CLAIM.long, MODE_SPECS.full, answer('Can I try it'), answer('What is the Mistake Lab'), PLAN_HOME.free.replace(/^Or start on Free:\s*/, ''),
    VALUE_COPY.proLine({ keyCards: true }), answer('What does Pro cost'), COMPASS_HEAD.sub, DU_HEAD.sub];
  assert.equal(FACTS.length, sources.length);
  for (const [i, line] of FACTS.entries()) assert.ok(line.includes(sources[i]), line);
  assert.ok(PLAN_HOME.free.includes('50 credits a month'), 'the Free line still names its credits');
  assert.ok(!buildFactSheet({ offer: OFFER, keyCards: false }).join(' ').includes('Key cards'));
});

test('the prompt: sample facts in when given, no client object keys, inside the byte cap for maximal inputs', () => {
  const p = buildGuestPrompt({ facts: FACTS, message: 'What should I do tonight?', history: [], sample: parseGuestBody({ message: 'x', sample: SAMPLE }).sample });
  assert.match(p.userMessage, /VISITOR RESULT \(data\): 3 of 5 right in Accountancy\. Missed: Q2 Partnership accounts; Q4 Cash flow statement\./);
  assert.match(p.systemPrompt, /ONE clear step/);
  assert.doesNotMatch(buildGuestPrompt({ facts: FACTS, message: 'hi' }).systemPrompt, /VISITOR RESULT is/);
  assert.match(p.systemPrompt, /untrusted text/);
  assert.match(p.systemPrompt, /Under 90 words/);

  const body = parseGuestBody({ message: 'x', sample: { ...SAMPLE, evil: 'EVIL_VALUE', misses: [{ n: 2, chapter: 'Ratios', evilKey: 'EVIL_TWO' }] }, history: [{ role: 'user', text: 'hello', evil: 'EVIL_THREE' }] });
  const q = buildGuestPrompt({ facts: FACTS, ...body });
  const all = q.systemPrompt + q.userMessage;
  for (const leak of ['EVIL_VALUE', 'EVIL_TWO', 'EVIL_THREE', 'evil', '"misses"', '"chapter"', '"score"', '"role"', '{', '}']) assert.ok(!all.includes(leak), leak);

  const maximal = (ch) => parseGuestBody({
    message: ch.repeat(280),
    history: ['user', 'mobi', 'user', 'mobi'].map((role) => ({ role, text: ch.repeat(400) })),
    sample: { score: 0, total: 5, subject: ch.repeat(40), misses: [1, 2, 3, 4, 5].map((n) => ({ n, chapter: ch.repeat(80) })) },
  });
  for (const ch of ['x', 'अ', '😀']) {
    const input = maximal(ch);
    const m = buildGuestPrompt({ facts: FACTS, ...input });
    assert.ok(m.bytes <= PROMPT_BYTE_CAP, `${ch}: ${m.bytes} bytes`);
    assert.equal(m.bytes, Buffer.byteLength(m.systemPrompt) + Buffer.byteLength(m.userMessage));
  }
  // A short exchange keeps the earlier lines, newest last.
  const h = buildGuestPrompt({ facts: FACTS, message: 'And after that?', history: [{ role: 'user', text: 'Q one' }, { role: 'mobi', text: 'A one' }] });
  assert.match(h.userMessage, /EARLIER \(data\):\nVisitor: Q one\nMobi: A one\nQUESTION/);
});

test('the reply sanitizer: markdown out, whitespace collapsed, at most 700 characters ending on a sentence', () => {
  assert.equal(sanitizeReply('## Plan\n**Do** this:\n- one\n- two\n\n\n`code` and _soft_ words'), 'Plan\nDo this:\none\ntwo\ncode and soft words');
  assert.equal(sanitizeReply('See [the NTA site](https://example.com).   Done.'), 'See the NTA site. Done.');
  assert.equal(sanitizeReply('1. Read it.\n2. Practise ten.'), '1. Read it.\n2. Practise ten.');
  assert.equal(sanitizeReply(null), '');
  const long = sanitizeReply(`${'Practise one chapter properly tonight. '.repeat(30)}`);
  assert.ok(long.length <= REPLY_MAX, String(long.length));
  assert.ok(long.endsWith('.'));
});
