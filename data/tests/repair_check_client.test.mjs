import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHECK_COPY, CHECK_REQUEST_ID, newCheckRequestId, checkAvailability, safeCheckHref, safeAskHref, poolLine, reviseLine, leadLine, askLabel, askSeesLine, askOffer, optionTag,
  answeredRows, openRows, isShowableCheck, isShowableResult, requestCheck, submitCheck, planCheckLoad, planCheckAnswer,
} from '../repair_check_client.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const contract = JSON.parse(read('data/tests/fixtures/repair4/contract_check_v1.json'));

const options = [0, 1, 2, 3].map((index) => ({ index, text: `Option ${index}` }));
const openCheck = { checkQuestionId: 'q_fresh_1', question: 'A stem', options, basisLine: 'Same topic: Goodwill', pool: { unseen: 7, ofChapter: 41 } };
const result = {
  right: false, checkQuestionId: 'q_fresh_1', pick: 2, key: { index: 1, text: 'Option 1' }, picked: { index: 2, text: 'Option 2' }, explanation: 'Because.', ruleLine: 'The rule.',
  line: 'Missed on a new question from the same topic.',
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
  assert.equal(poolLine({ unseen: 7, ofChapter: 41 }), 'Of the 41 questions in this chapter, 7 are new to you and can be used for a check.');
  assert.equal(poolLine({ unseen: 1, ofChapter: 41 }), 'Of the 41 questions in this chapter, 1 is new to you and can be used for a check.');
  for (const bad of [null, {}, { unseen: 7 }, { ofChapter: 41 }, { unseen: 9, ofChapter: 4 }, { unseen: -1, ofChapter: 4 }, { unseen: 0, ofChapter: 0 }, { unseen: '7', ofChapter: '41' }]) assert.equal(poolLine(bad), null, JSON.stringify(bad));
});

test('the Revise line says only what was written: nothing when Revise is unavailable, never a forecast', () => {
  assert.equal(reviseLine(null, true), null);
  assert.equal(reviseLine({ scheduled: false, reason: 'unavailable', nextAt: null }, false), null);
  assert.equal(reviseLine({ scheduled: true, whenLabel: 'tomorrow', cards: 1 }, true), 'will bring this mistake back tomorrow.');
  assert.equal(reviseLine({ scheduled: true, whenLabel: 'Fri 17 Oct', cards: 1 }, true), 'will bring this mistake back on Fri 17 Oct.');
  assert.equal(reviseLine({ scheduled: true, whenLabel: 'tomorrow', cards: 2 }, false), 'will bring both back tomorrow: this mistake and the question you just missed.');
  assert.equal(reviseLine({ scheduled: true, whenLabel: 'today', cards: 1 }, true), 'will bring this mistake back today.');
  // The day is worked out again from the due day when the screen opens, so a stored answer never says "tomorrow" about a day that has gone.
  const at = Date.parse('2026-10-16T20:00:00Z'); // 17 Oct, 01:30 IST
  assert.equal(reviseLine({ scheduled: true, dueDay: '2026-10-18', whenLabel: 'tomorrow', cards: 1 }, true, at), 'will bring this mistake back tomorrow.');
  assert.equal(reviseLine({ scheduled: true, dueDay: '2026-10-18', whenLabel: 'tomorrow', cards: 1 }, true, Date.parse('2026-10-20T06:00:00Z')), 'will bring this mistake back today.');
  assert.equal(reviseLine({ scheduled: true, dueDay: '2026-10-21', whenLabel: 'tomorrow', cards: 2 }, false, at), 'will bring both back on Wed 21 Oct: this mistake and the question you just missed.');
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
  assert.equal(changed.refetch, true); assert.equal(changed.canRetry, false); assert.match(changed.message, /withdrawn before it was marked\. Nothing was recorded\./);
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
  assert.doesNotMatch(component, /askHref|\/mentor/, 'the Ask follow-up is not part of the check: it belongs to the mistake');
  const ask = read('src/components/recovery/RepairAsk.jsx');
  assert.match(ask, /safeAskHref/, 'the Ask follow-up is a link, the student leaves on purpose');
  assert.match(ask, /usesLine\(\{ what: CHECK_COPY\.askCost, cost: 1, pool: 'ai'/, "Ask Mobi's own cost is shown before the student leaves");
  assert.doesNotMatch(ask, /reserve|commit|release|wallet\/charge|openai|anthropic|gpt-|claude-/i);
});

test('the screen is wired in after the explanation, behind the check field, with every state and a reduced-motion path', () => {
  const repair = read('src/components/recovery/MistakeRepair.jsx');
  assert.match(repair, /import RepairCheck from '\.\/RepairCheck';/);
  assert.match(repair, /const showCheck = !!\(state\.check && attemptId && questionId\);/);
  assert.match(repair, /showCheck \? <RepairCheck attemptId=\{attemptId\} questionId=\{questionId\} check=\{state\.check\}/);
  assert.ok(repair.indexOf('<RepairCheck') > repair.indexOf('<RuleCard'), 'after the rule');
  assert.match(repair, /showCheck \? <RepairAsk attemptId=\{attemptId\} questionId=\{questionId\} number=\{number\}/, 'Ask Mobi names the mistake by its number');
  assert.ok(repair.indexOf('<RepairAsk') > repair.indexOf('<RuleCard') && repair.indexOf('<RepairAsk') < repair.indexOf('<RepairCheck'), 'Ask Mobi (about the mistake) follows the explanation and comes before the check');
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

test('Ask Mobi is about the mistake and says so: its number is in the label and in what Mobi sees, never the check question', () => {
  assert.equal(askLabel(3), 'Ask Mobi about Q3');
  assert.equal(askLabel(null), 'Ask Mobi about this mistake');
  assert.equal(askLabel(0), 'Ask Mobi about this mistake');
  assert.equal(askSeesLine(3), 'Mobi sees Q3, your pick, the key and your rule, and nothing else about you.');
  assert.doesNotMatch(askSeesLine(null), /Q\d|undefined|null/);
});

test("the repair promises Ask Mobi's credit only while written replies can be bought; paused, empty or unreadable says nothing is charged and offers no link", () => {
  const price = 'One written reply uses 1 credit. You have 68.';
  assert.deepEqual(askOffer({ state: 'available', known: true, total: 68 }, price), { ask: true, line: price });
  assert.deepEqual(askOffer(null, price), { ask: false, pending: true, line: null }, 'before the wallet is read there is neither a link nor a price, so nothing appears and is then taken back');
  assert.deepEqual(askOffer(undefined, price), { ask: false, pending: true, line: null });
  const paused = askOffer({ state: 'paused', known: true, total: 68 }, price);
  assert.equal(paused.ask, false); assert.equal(paused.line, 'Written replies are paused right now. Nothing is charged.');
  const empty = askOffer({ state: 'empty', known: true, total: 0 }, price);
  assert.equal(empty.ask, false); assert.match(empty.line, /no credits left/); assert.match(empty.line, /Nothing is charged\.$/);
  const unreadable = askOffer({ state: 'error', known: false, total: null }, price);
  assert.equal(unreadable.ask, false); assert.match(unreadable.line, /could not be read/); assert.match(unreadable.line, /Nothing is charged\.$/);
  for (const w of [paused, empty, unreadable]) assert.doesNotMatch(w.line, /1 credit|free/i, 'no price and no promise of free asking');
});

test('the lead names what the question is tied to only when the server said so', () => {
  assert.match(leadLine('concept'), /^One new question on the same idea that you have not seen\./);
  assert.match(leadLine('topic'), /on the same topic/);
  assert.match(leadLine('chapter'), /from the same chapter/);
  assert.doesNotMatch(leadLine(undefined), /same (idea|topic|chapter)/);
  assert.match(leadLine('chapter'), /no extra credit\.$/);
});

// Ask Mobi's panel (ASK-MOBI-1018) replaced the four-tab Ask screen; these hold the same promises on the panel.
test('the Ask panel: a handed-over question with written replies unavailable says so, charges nothing and never offers free asking about it', async () => {
  const { paidState } = await import('../../src/components/ai/askSuggestions.mjs');
  for (const state of ['paused', 'empty']) {
    const out = paidState({ known: true, state, total: 0, includedMonthlyCredits: 10 });
    assert.equal(out.open, false, state);
    assert.match(out.why, /Nothing is charged from here\./, state);
    assert.match(out.why, /Questions about your record stay free\./, state);
  }
  assert.equal(paidState({ known: false, state: 'error' }).open, false, 'credits that cannot be read are never treated as open');
  const panel = read('src/components/ai/AskMobiPanel.jsx');
  assert.match(panel, /const questionTyping = withQuestion && \(!wallet \|\| paid\.open\);/, 'a typed ask is about the question only while written replies are open');
  assert.match(panel, /const placeholder = questionTyping \? `Ask about \$\{qName\}` :/, 'when they are not, the composer asks the record, not the question');
  assert.match(panel, /if \(!isRetry && !paid\.open\) return;/, 'no paid call is made');
  assert.match(panel, /<button type="button" className="amb-btn amb-btn--line" onClick=\{dropQuestion\}>Ask about my record<\/button>/, 'the way out drops the question');
  assert.match(panel, /disabled=\{off\}/, 'the written asks are disabled, not hidden');
});

test('the Ask panel with a handed-over question: no record claim, no Focus select, the price on every ask', () => {
  const panel = read('src/components/ai/AskMobiPanel.jsx');
  assert.doesNotMatch(panel, /Focus|Listbox|FOCUS_OPTIONS/, 'no Focus select');
  assert.match(panel, /<figure className="amb-quote" aria-label=\{`\$\{qName\}, the question you are asking about`\}>/, 'the question sits in its own quote, with the pick and the key');
  assert.match(panel, /The key is being re-checked, so Mobi will not name an answer\./, 'a key under re-check is never named');
  assert.match(panel, /ask\.price === 'free' \? 'Free' : creditCount\(1\)/, 'the cost shows on every ask before it is sent');
  assert.doesNotMatch(panel, /verified answer key|Your record is the context/, 'no record claim about a written reply');
});

test('UI details: no first-answer note on a withdrawn question, the skeleton keeps the phone actions row, no Ask link before the wallet is read, no stripes or arrow', () => {
  const check = read('src/components/recovery/RepairCheck.jsx');
  assert.match(check, /\{view\.refetch \? null : <span className="mr-chk__fine">/, 'a withdrawn question has no first answer to count');
  const css = read('src/components/recovery/repair-check.css');
  assert.match(css, /@media \(max-width: 480px\) \{ \.mr-chk__skel u \{ margin-bottom: 26px; \} \}/, 'the 70 px actions row is held at phone width');
  const ask = read('src/components/recovery/RepairAsk.jsx');
  assert.match(ask, /if \(offer\.pending\) return <div className="mr-block mr-askq" data-pending aria-hidden="true"/);
  assert.ok(ask.indexOf('offer.pending') < ask.indexOf('<Link'), 'the pending state is decided before any link is built');
  const repairCss = read('src/components/recovery/mistake-repair.css');
  assert.doesNotMatch(repairCss, /\.mr-contrast \{[^}]*border-left/, 'no quote stripe on the repair panel');
  const hubCss = read('src/components/ai/prepos.css');
  assert.doesNotMatch(hubCss, /\.pp-ask__service \{[^}]*border-left/, 'no accent stripe on the written-reply notice');
  assert.doesNotMatch(read('src/components/recovery/result.css'), /.rp-q[data-verdict[^}]*border-left/, 'no side stripe on the question card that holds the repair');
  const repair = read('src/components/recovery/MistakeRepair.jsx');
  assert.doesNotMatch(repair, /ArrowRight/, 'no arrow on Next mistake');
  assert.match(repair, /Next mistake: Q\{next\.number\}<\/button>/);
});
