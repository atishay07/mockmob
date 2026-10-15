import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHECK_COPY, CHECK_REQUEST_ID, newCheckRequestId, checkAvailability, safeCheckHref, safeAskHref, poolLine, reviseLine, optionTag,
  answeredRows, openRows, isShowableCheck, isShowableResult, requestCheck, submitCheck, planCheckLoad, planCheckAnswer,
} from '../repair_check_client.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const contract = JSON.parse(read('data/tests/fixtures/repair4/contract_check_v1.json'));

const options = [0, 1, 2, 3].map((index) => ({ index, text: `Option ${index}` }));
const openCheck = { checkQuestionId: 'q_fresh_1', question: 'A stem', options, basisLine: 'Same topic: Goodwill', pool: { unseen: 7, ofChapter: 41 } };
const result = {
  right: false, checkQuestionId: 'q_fresh_1', pick: 2, key: { index: 1, text: 'Option 1' }, picked: { index: 2, text: 'Option 2' }, explanation: 'Because.', ruleLine: 'The rule.',
  line: 'Missed on a new question from the same topic. It is in Revise tomorrow.',
  options: options.map((o) => ({ ...o, isKey: o.index === 1, isPick: o.index === 2 })), revise: { scheduled: true, whenLabel: 'tomorrow', cards: 2 },
};
const response = (status, body) => ({ kind: 'response', res: { ok: status >= 200 && status < 300, status }, body });

test('the repair response check field decides what the screen does, from the contract examples', () => {
  const { examples } = contract.repairResponseGains;
  assert.deepEqual(checkAvailability(examples.ready), { show: true, mode: 'load' });
  assert.deepEqual(checkAvailability(examples.answered), { show: true, mode: 'load' });
  const none = checkAvailability(examples.none);
  assert.equal(none.mode, 'message'); assert.equal(none.message, 'No unseen question on this idea yet.'); assert.equal(none.canRetry, false);
  const unchecked = checkAvailability(examples.unchecked);
  assert.equal(unchecked.mode, 'message'); assert.equal(unchecked.canRetry, true, 'an unavailable check may come back');
  for (const missing of [undefined, null, 'ready', 7, { status: 'something_new' }]) assert.deepEqual(checkAvailability(missing), { show: false }, 'no field, no block');
});

test('every reason the contract lists reads in plain words and only the retryable ones offer a retry', () => {
  for (const [reason, message] of Object.entries(contract.reasons)) {
    const plan = checkAvailability({ status: 'none', reason, message });
    assert.equal(plan.message, message);
    assert.equal(plan.canRetry, reason === 'lookup_failed' || reason === 'check_unavailable', reason);
  }
  assert.match(checkAvailability({ status: 'none', reason: 'x', message: null }).message, /Nothing was charged/);
});

test('links from the server are used only when they point at our own routes', () => {
  assert.equal(safeCheckHref('/api/recovery/check?attemptId=a&questionId=b', 'a', 'b'), '/api/recovery/check?attemptId=a&questionId=b');
  assert.equal(safeCheckHref('https://example.test/steal', 'a b', 'c'), '/api/recovery/check?attemptId=a%20b&questionId=c');
  assert.equal(safeAskHref('/mentor?tab=ask&q=att_1:q_1', 'att_1', 'q_1'), '/mentor?tab=ask&q=att_1:q_1');
  assert.equal(safeAskHref('//evil.test', 'att_1', 'q_1'), '/mentor?tab=ask&q=att_1:q_1');
});

test('request ids match the route pattern and are never empty or short', () => {
  assert.match(newCheckRequestId(), CHECK_REQUEST_ID);
  assert.match(newCheckRequestId(() => '', null), CHECK_REQUEST_ID);
  assert.match(newCheckRequestId(() => 'x', () => 'aa-bb'), CHECK_REQUEST_ID);
  assert.notEqual(newCheckRequestId(), newCheckRequestId());
});

test('every count carries its denominator, and no total means no line', () => {
  assert.equal(poolLine({ unseen: 7, ofChapter: 41 }), '7 of the 41 questions in this chapter are new to you.');
  assert.equal(poolLine({ unseen: 1, ofChapter: 41 }), '1 of the 41 questions in this chapter is new to you.');
  for (const bad of [null, {}, { unseen: 7 }, { ofChapter: 41 }, { unseen: 9, ofChapter: 4 }, { unseen: -1, ofChapter: 4 }, { unseen: 0, ofChapter: 0 }, { unseen: '7', ofChapter: '41' }]) assert.equal(poolLine(bad), null, JSON.stringify(bad));
});

test('the Revise line says only what was written: nothing when Revise is unavailable, never a forecast', () => {
  assert.equal(reviseLine(null, true), null);
  assert.equal(reviseLine({ scheduled: false, reason: 'unavailable', nextAt: null }, false), null);
  assert.equal(reviseLine({ scheduled: true, whenLabel: 'tomorrow', cards: 1 }, true), 'This mistake comes back tomorrow.');
  assert.equal(reviseLine({ scheduled: true, whenLabel: 'Fri 17 Oct', cards: 1 }, true), 'This mistake comes back on Fri 17 Oct.');
  assert.equal(reviseLine({ scheduled: true, whenLabel: 'tomorrow', cards: 2 }, false), 'This mistake and the question you just missed both come back.');
  assert.doesNotMatch(reviseLine({ scheduled: true, whenLabel: 'tomorrow', cards: 1 }, true), /will (improve|learn|remember)|marks|score/i);
});

test('answered rows follow the order shown, tag the key and the pick in words, and never colour alone', () => {
  const rows = answeredRows(openCheck, result);
  assert.deepEqual(rows.map((r) => r.letter), ['A', 'B', 'C', 'D']);
  assert.deepEqual(rows.map((r) => r.state), [null, 'key', 'mine', null]);
  assert.deepEqual(rows.map((r) => r.tag), [null, 'Key', 'Your pick', null]);
  const right = answeredRows(openCheck, { ...result, right: true, pick: 1, options: options.map((o) => ({ ...o, isKey: o.index === 1, isPick: o.index === 1 })) });
  assert.equal(right[1].tag, 'Your pick and the key');
  assert.equal(optionTag({ isKey: false, isPick: false }), null);
  // Without the result's own options the rows are rebuilt from the check and the key and pick indexes.
  const rebuilt = answeredRows(openCheck, { key: { index: 3 }, pick: 0 });
  assert.deepEqual(rebuilt.map((r) => r.state), ['mine', null, null, 'key']);
});

test('open rows carry no key: the option objects the server sends before the answer have only an index and text', () => {
  const rows = openRows(openCheck);
  assert.equal(rows.length, 4);
  for (const row of rows) assert.deepEqual(Object.keys(row).sort(), ['index', 'letter', 'text']);
});

test('half a question or half an answer is never shown', () => {
  assert.equal(isShowableCheck(openCheck), true);
  assert.equal(isShowableCheck({ ...openCheck, options: options.slice(0, 3) }), false);
  assert.equal(isShowableCheck({ ...openCheck, question: ' ' }), false);
  assert.equal(isShowableCheck({ ...openCheck, options: options.map((o, i) => (i === 2 ? { index: 2, text: '' } : o)) }), false);
  assert.equal(isShowableResult(result), true);
  assert.equal(isShowableResult({ ...result, right: 'yes' }), false);
  assert.equal(isShowableResult({ ...result, key: null }), false);
  assert.equal(isShowableResult({ ...result, options: [] }), false);
});

test('GET: a question, the stored answer, a plain reason, or an error that can be retried', () => {
  assert.equal(planCheckLoad(response(200, { ok: true, status: 'ready', check: openCheck })).state, 'ready');
  const stored = planCheckLoad(response(200, { ok: true, status: 'answered', check: openCheck, result }));
  assert.equal(stored.state, 'answered'); assert.equal(stored.replayed, true);
  const none = planCheckLoad(response(200, { ok: true, status: 'none', reason: 'no_unseen', message: 'No unseen question on this idea yet.', pool: { unseen: 0, ofChapter: 41 } }));
  assert.equal(none.state, 'none'); assert.equal(none.canRetry, false);
  const lookup = planCheckLoad(response(503, contract.get.errors['503 lookup_failed']));
  assert.equal(lookup.state, 'none'); assert.equal(lookup.reason, 'lookup_failed'); assert.equal(lookup.canRetry, true);
  assert.equal(planCheckLoad(response(409, contract.get.errors['409 repair_first'])).state, 'none');
  assert.equal(planCheckLoad(response(409, contract.get.errors['409 repair_first'])).canRetry, false);
  const limited = planCheckLoad(response(429, contract.get.errors['429']));
  assert.equal(limited.state, 'error'); assert.equal(limited.canRetry, true);
  for (const outcome of [{ kind: 'timeout' }, { kind: 'network' }, response(500, null), response(200, { ok: true, status: 'ready', check: { ...openCheck, options: [] } }), response(200, { ok: true, status: 'mystery' })]) {
    const plan = planCheckLoad(outcome);
    assert.equal(plan.state, 'error'); assert.equal(plan.canRetry, true); assert.match(plan.message, /Nothing was charged|wait a moment/);
  }
});

test('POST: the stored result, or a failure that keeps the question and the pick on screen', () => {
  const ok = planCheckAnswer(response(200, { ok: true, status: 'answered', replayed: false, charged: 0, result }));
  assert.equal(ok.state, 'answered'); assert.equal(ok.replayed, false);
  assert.equal(planCheckAnswer(response(200, { ok: true, status: 'answered', replayed: true, charged: 0, result })).replayed, true);
  const changed = planCheckAnswer(response(409, contract.post.errors['409 check_changed']));
  assert.equal(changed.refetch, true); assert.equal(changed.canRetry, false); assert.match(changed.message, /no longer available/);
  const pick = planCheckAnswer(response(422, contract.post.errors['422 invalid_pick']));
  assert.equal(pick.canRetry, true); assert.equal(pick.refetch, false);
  assert.equal(planCheckAnswer(response(409, contract.post.errors['409 repair_first'])).canRetry, false);
  assert.equal(planCheckAnswer(response(429, { ok: false, error: 'rate_limited', message: 'Please wait a moment before the next check.' })).canRetry, true);
  for (const outcome of [{ kind: 'timeout' }, { kind: 'network' }]) {
    const plan = planCheckAnswer(outcome);
    assert.equal(plan.state, 'error'); assert.equal(plan.canRetry, true); assert.equal(plan.message, CHECK_COPY.markFailed);
  }
  assert.equal(planCheckAnswer(response(200, { ok: true, status: 'answered', result: { right: true } })).state, 'error', 'a result without a key and options is not shown');
});

test('requests: GET is uncached, POST carries the one request id, and a hung call ends as a timeout', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
  await requestCheck(fetchImpl, '/api/recovery/check?attemptId=a&questionId=b');
  assert.equal(seen[0].init.method, 'GET'); assert.equal(seen[0].init.cache, 'no-store');
  await submitCheck(fetchImpl, { attemptId: 'a', questionId: 'b', checkQuestionId: 'c', pick: 1, requestId: 'req_0123456789abcdef' });
  assert.equal(seen[1].url, '/api/recovery/check'); assert.equal(seen[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(seen[1].init.body), { attemptId: 'a', questionId: 'b', checkQuestionId: 'c', pick: 1, requestId: 'req_0123456789abcdef' });
  const hung = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  assert.deepEqual(await requestCheck(hung, '/x', { timeoutMs: 5 }), { kind: 'timeout' });
  assert.deepEqual(await submitCheck(hung, {}, { timeoutMs: 5 }), { kind: 'timeout' });
  assert.deepEqual(await requestCheck(async () => { throw new Error('offline'); }, '/x'), { kind: 'network' });
});

test('the check never touches credits or a model: the client files name neither', () => {
  for (const file of ['data/repair_check_client.mjs', 'src/components/recovery/RepairCheck.jsx']) {
    const source = read(file);
    assert.doesNotMatch(source, /reserve|commit|release|wallet\/charge|openai|anthropic|gpt-|claude-/i, file);
  }
  const component = read('src/components/recovery/RepairCheck.jsx');
  assert.match(component, /\/mentor|askHref/, 'the Ask follow-up is a link, the student leaves on purpose');
  assert.match(component, /usesLine\(\{ what: CHECK_COPY\.askCost, cost: 1, pool: 'ai'/, "Ask Mobi's own cost is shown before the student leaves");
});

test('the screen is wired in after the explanation, behind the check field, with every state and a reduced-motion path', () => {
  const repair = read('src/components/recovery/MistakeRepair.jsx');
  assert.match(repair, /import RepairCheck from '\.\/RepairCheck';/);
  assert.match(repair, /const showCheck = !!\(state\.check && attemptId && questionId\);/);
  assert.match(repair, /showCheck \? <RepairCheck attemptId=\{attemptId\} questionId=\{questionId\} check=\{state\.check\}/);
  assert.ok(repair.indexOf('<RepairCheck') > repair.indexOf('<RuleCard'), 'after the rule');
  assert.ok(repair.indexOf('<RepairCheck') < repair.indexOf('mr-record'), 'before "From your record"');
  const component = read('src/components/recovery/RepairCheck.jsx');
  for (const phase of ["'loading'", "'ready'", "'sending'", "'answered'", "'none'", "'loadError'"]) assert.ok(component.includes(phase), phase);
  assert.match(component, /role="radiogroup"/); assert.match(component, /type="radio"/);
  const css = read('src/components/recovery/repair-check.css');
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.match(css, /data-motion='reduced'/);
  assert.doesNotMatch(css, /transition: all|ease-in[^-]|scale\(0\)|text-transform: uppercase|gradient|box-shadow: 0 0/);
});

test('user-facing words: sentence case, no exclamation marks, no em dash, no middle dot, no arrows', () => {
  for (const value of Object.values(CHECK_COPY)) {
    assert.doesNotMatch(value, /[!—·→]/, value);
    assert.doesNotMatch(value, /^[A-Z ]{4,}$/, value);
  }
  for (const line of [reviseLine({ scheduled: true, whenLabel: 'tomorrow' }, true), reviseLine({ scheduled: true, whenLabel: 'tomorrow' }, false), poolLine({ unseen: 7, ofChapter: 41 })]) assert.doesNotMatch(line, /[!—·→]/);
});
