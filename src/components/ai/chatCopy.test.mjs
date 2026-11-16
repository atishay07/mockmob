// Ask Mobi as a chat (16 Nov 2026): the chat's own words and the small rules behind them (chatCopy.mjs, chatProse.mjs).
// node --test src/components/ai/chatCopy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHAT_COPY, MISTAKE_WAIT_SECONDS, canAfford, chargedOf, contextLine, doubtBuys, hello, mistakeAsText, mistakePriceTag, refusalParts,
  savedCost, sendCost, sendLine, starterTiles, turnAsText, usedWords, waitCeiling, waitLine, waysForward,
} from './chatCopy.mjs';
import { inlineParts, proseBlocks } from './chatProse.mjs';
import { MOBI_JOB_CREDITS, creditCount } from '../../lib/creditCopy.mjs';
import { MISTAKE_COPY, MISTAKE_CREDITS, MISTAKE_PHOTO_CREDITS, MISTAKE_TIMEOUT_MS, mistakeOutcome } from '../../services/mobi/bringMistake.mjs';
import { REPORT_REASONS } from '../../lib/server/aiReplyReport.js';
import { JOB_COPY } from './mobiJobs.mjs';
import { exchangesFrom } from './mentorHistory.mjs';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const code = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const WALLET = { known: true, state: 'available', total: 108, includedMonthlyCredits: 50, resetAt: '2026-11-30T18:30:00.000Z' };
const BANNED = /!|→|->|—|\bAI service\b|OpenAI|Anthropic|GPT|Claude|\bLLM\b/;

test('every price comes from the constants the product charges by, never a typed number', () => {
  assert.equal(sendCost({ kind: 'doubt' }), MOBI_JOB_CREDITS);
  assert.equal(sendCost({ kind: 'mistake' }), MISTAKE_CREDITS);
  assert.equal(sendCost({ kind: 'mistake', photo: true }), MISTAKE_PHOTO_CREDITS);
  const tiles = starterTiles({ when: 'tonight', photoOn: true });
  assert.deepEqual(tiles.map((t) => t.id), ['doubt', 'mistake', 'losing', 'tonight']);
  assert.equal(tiles[0].price, creditCount(MOBI_JOB_CREDITS));
  assert.equal(tiles[1].price, MISTAKE_CREDITS === MISTAKE_PHOTO_CREDITS ? creditCount(MISTAKE_CREDITS) : `${MISTAKE_CREDITS} or ${creditCount(MISTAKE_PHOTO_CREDITS)}`);
  assert.equal(mistakePriceTag({ photoOn: false }), creditCount(MISTAKE_CREDITS), 'with photos off the tile says the typed price alone');
  assert.equal(starterTiles({ photoOn: false })[1].sub, 'Typed or pasted');
  assert.deepEqual([tiles[2].price, tiles[3].price], ['Free', 'Free']);
  assert.equal(tiles[3].title, 'What should I revise tonight?');
  assert.equal(starterTiles({ when: 'today' })[3].title, 'What should I revise today?');
  // What a credit buys is the product's own sentence, with the price read from the constant.
  if (MOBI_JOB_CREDITS === 1) assert.equal(doubtBuys(), JOB_COPY.creditBuys);
  assert.ok(doubtBuys().startsWith(creditCount(MOBI_JOB_CREDITS)));
  const src = code(read('./chatCopy.mjs'));
  assert.doesNotMatch(src, /\b[1-9] credits?\b/, 'no price is typed into the chat copy');
});

test('the line under the composer is true before a send: what it uses and what is left', () => {
  assert.deepEqual(sendLine({ kind: 'doubt', wallet: WALLET }), { text: `This doubt uses ${creditCount(MOBI_JOB_CREDITS)}. You have 108.`, tone: 'cost', credits: false });
  assert.equal(sendLine({ kind: 'mistake', wallet: WALLET }).text, `This question uses ${creditCount(MISTAKE_CREDITS)}. You have 108.`);
  assert.equal(sendLine({ kind: 'mistake', photo: true, wallet: WALLET }).text, `This photo uses ${creditCount(MISTAKE_PHOTO_CREDITS)}. You have 108.`);
  assert.equal(sendLine({ kind: 'doubt', question: true, wallet: WALLET }).text, `This reply uses ${creditCount(MOBI_JOB_CREDITS)}. You have 108.`);
  assert.deepEqual(sendLine({ kind: 'doubt', price: 'free', wallet: WALLET }), { text: 'Free, from your record.', tone: 'free', credits: false });
  assert.equal(sendLine({ kind: 'doubt', price: 'free', wallet: null }).tone, 'free', 'a record answer never waits for the wallet');
  assert.equal(sendLine({ kind: 'doubt', followUp: true, wallet: WALLET }).tone, 'free');
  assert.match(sendLine({ kind: 'doubt', followUp: true, wallet: WALLET }).text, /follow-up comes with your doubt/);
  assert.equal(sendLine({ kind: 'mistake', followUp: false, photo: true, wallet: WALLET }).tone, 'cost');
  assert.equal(sendLine({ support: true, wallet: null }).text, 'This one is free.');
  assert.equal(sendLine({ wallet: null }).text, 'Reading your credits.');
  assert.equal(sendLine({ wallet: { known: false, state: 'paused' } }).tone, 'stop');
  assert.match(sendLine({ wallet: { known: false, state: 'paused' } }).text, /paused/);
  const none = sendLine({ wallet: { ...WALLET, total: 0 } });
  assert.match(none.text, /^You have no credits left\. Your free credits refill on 1 Dec\./);
  assert.equal(none.credits, true, 'no credits offers the way to the credits page');
  assert.match(sendLine({ wallet: { known: false, state: 'error' } }).text, /could not be read/, 'an unknown balance is never written as 0');
  // Offline: nothing that needs the network is sent; a record answer already on the device still works.
  assert.match(sendLine({ offline: true, wallet: WALLET }).text, /^You are offline\. Nothing is sent and nothing is used\./);
  assert.equal(sendLine({ offline: true, price: 'free', wallet: WALLET }).text, 'Free, from your record.');
  assert.match(sendLine({ offline: true, price: 'free', needsNet: true, wallet: WALLET }).text, /^You are offline/, 'tonight\'s set is read by the server');
  assert.match(sendLine({ kind: 'mistake', stopped: true, wallet: WALLET }).text, /limit is reached/);
});

test('a send the balance cannot pay for never leaves, and the line says why', () => {
  assert.equal(canAfford({ kind: 'doubt', wallet: WALLET }), true);
  assert.equal(canAfford({ kind: 'doubt', wallet: null }), false);
  assert.equal(canAfford({ kind: 'doubt', wallet: { ...WALLET, state: 'paused' } }), false);
  const short = { ...WALLET, total: MISTAKE_PHOTO_CREDITS - 1 };
  if (short.total > 0) {
    assert.equal(canAfford({ kind: 'mistake', photo: true, wallet: short }), false);
    assert.match(sendLine({ kind: 'mistake', photo: true, wallet: short }).text, /That is not enough\.$/);
  }
});

test('waiting names the one real step, and states a ceiling only where the product has one', () => {
  assert.equal(waitLine({ kind: 'mistake', photo: true }), 'Reading your photo');
  assert.equal(waitLine({ kind: 'mistake', photo: false }), 'Reading your question');
  assert.equal(waitLine({ kind: 'paid', question: true }, { qName: 'Q7' }), 'Reading Q7, your pick and the key');
  assert.equal(waitLine({ kind: 'tonight' }), 'Reading your record for tonight');
  assert.equal(waitLine({ kind: 'paid' }), 'Working it out');
  assert.equal(waitLine(null), null);
  assert.equal(MISTAKE_WAIT_SECONDS, Math.round(MISTAKE_TIMEOUT_MS / 1000));
  assert.equal(waitCeiling({ kind: 'mistake', photo: true }), `This can take up to ${MISTAKE_WAIT_SECONDS} seconds.`);
  assert.equal(waitCeiling({ kind: 'paid' }), null, 'no ceiling is claimed for a reply whose route states none');
  const thread = read('./ChatThread.jsx');
  assert.doesNotMatch(thread, /setInterval|typewriter|charAt\(/, 'nothing is faked as streaming or progress');
});

test('what a turn used is written from the amount the server said: 0, 1 or more', () => {
  assert.equal(usedWords(0), 'No credits used.');
  assert.equal(usedWords(1), '1 credit used.');
  assert.equal(usedWords(2), '2 credits used.');
  assert.equal(usedWords(undefined), 'No credits used.');
  assert.equal(chargedOf({ charge: { amount: 2 } }), 2);
  assert.equal(chargedOf({ charged: 1 }), 1);
  assert.equal(chargedOf({ response: { charge: { amount: 1 } } }), 1);
  assert.equal(chargedOf({ charged: 0, charge: { amount: 0 } }), 0);
  assert.equal(chargedOf(null), 0);
});

test('a refusal or a failure is a turn: what happened, what it used, and the way forward', () => {
  // Nothing used: the server's "nothing was charged" is said once, by the amount.
  assert.deepEqual(refusalParts(MISTAKE_COPY.unreadable, 0), { said: 'Mobi could not read a question in that photo. Try a sharper, closer photo, or type it.', used: 'No credits used.' });
  // A credit used (another lane's server, 16 Nov): the words follow the amount, and never say nothing was charged.
  const one = refusalParts(MISTAKE_COPY.unreadable, 1);
  assert.equal(one.used, '1 credit used.');
  assert.doesNotMatch(one.said, /Nothing was charged|No credits/);
  assert.deepEqual(refusalParts('It broke. No credits were used.', 2), { said: 'It broke.', used: '2 credits used.' });
  // Held credits are information, not a zero: the sentence stays.
  assert.match(refusalParts('The photo did not fit. Your credits are held briefly and return automatically.', 0).said, /held briefly and return automatically\.$/);
  assert.equal(refusalParts('', 0).said, '');
  for (const state of ['refused', 'failed', 'over', 'blocked', 'paused', 'duplicate']) {
    const plan = mistakeOutcome({ kind: 'response', res: { ok: state === 'refused', status: state === 'refused' ? 200 : state === 'over' ? 429 : state === 'blocked' ? 402 : state === 'paused' ? 503 : state === 'duplicate' ? 409 : 502 }, body: state === 'refused' ? { ok: true, kind: 'refused', reply: MISTAKE_COPY.notStudy } : { ok: false, error: state === 'over' ? 'user_limit_reached' : state === 'duplicate' ? 'duplicate' : 'x', status: state === 'paused' ? 'paused' : 'failed', message: 'It did not work.' } });
    assert.equal(plan.state, state);
    assert.ok(refusalParts(plan.message, 0).said.length > 0, state);
  }
  assert.deepEqual(waysForward({ state: 'refused', photo: true }).map((w) => w.id), ['retake', 'type']);
  assert.deepEqual(waysForward({ state: 'refused', photo: false }), []);
  assert.deepEqual(waysForward({ state: 'failed' }).map((w) => w.id), ['retry'], 'a failed reply: Try again is a NEW request');
  assert.deepEqual(waysForward({ state: 'unknown' }).map((w) => w.id), ['retry-same'], 'an unknown outcome: Try again is the SAME request');
  assert.deepEqual(waysForward({ state: 'photo_over', photo: true }).map((w) => w.id), ['type']);
  assert.deepEqual(waysForward({ state: 'blocked', noCredits: true }).map((w) => w.id), ['credits']);
  assert.deepEqual(waysForward({ state: 'over' }), []);
});

test('the engine keeps the money rules: one request id per send, the same one after an unknown outcome, a new one after a failure', () => {
  const panel = code(read('./AskMobiPanel.jsx'));
  assert.match(panel, /mistakeRef\.current = \{ id: newRequestId\(\), payload, credits: mistakeCredits\(payload\), photo: Boolean\(photo\) \};/, 'one request id per send');
  assert.match(panel, /if \(plan\.state === 'unknown'\) \{ setMistakeHold\(\{ message: plan\.message \}\); return; \}/, 'an unknown outcome keeps the request');
  assert.match(panel, /onWay=\{\(\) => deliverMistake\(\)\}/, 'and Try again sends that same request');
  assert.match(panel, /mistakeRef\.current = \{ id: newRequestId\(\), \.\.\.turn\.again \};/, 'a failed reply is sent again as a new request');
  assert.match(panel, /if \(!distress && \(!paid\.open \|\| offline\)\) return false;/, 'offline or out of credits sends nothing');
  assert.match(panel, /if \(distress && offline\) \{ setTurns\(\(prev\) => \[\.\.\.prev, userTurn, supportTurn\(\)\]\); return true; \}/, 'the support reply never waits on a connection');
  assert.match(panel, /if \(photo\) payload\.photo = \{ mime: 'image\/jpeg', data: photo\.data \};/, 'the prepared JPEG only');
  assert.match(panel, /charged = outcome\.kind === 'response' \? chargedOf\(outcome\.body\) : 0;/, 'what a refusal used is read from the response');
  assert.match(panel, /readWallet\(\);\s*\}\s*const push =/, 'the wallet is read again after every outcome');
  const composer = code(read('./ChatComposer.jsx'));
  assert.match(composer, /const canSendMistake = asked && value\.length <= boxMax && !preparing && !busy && !opening && !stopped\s*&& \(distress \|\| \(paid\?\.open && affordable && !offline\)\);/);
  assert.match(composer, /const boxMax = mistake \? \(photo \? MISTAKE_PHOTO_LIMITS\.note : MISTAKE_LIMITS\.question\) : TEXT_MAX;/, 'the old form\'s limits');
  assert.match(composer, /await preparePhoto\(file\)/, 'the photo is made ready in the browser; the original is never sent');
  assert.match(composer, /data-page-primary/, 'the send key is the view\'s one volt');
});

test('the composer: a labelled Photo key, camera or gallery, drop and paste, and no provider named', () => {
  const composer = read('./ChatComposer.jsx');
  assert.match(composer, /<Camera size=\{19\} strokeWidth=\{2\.1\} aria-hidden="true" \/><span>\{CHAT_COPY\.photoKey\}<\/span>/, 'a camera mark and the word');
  assert.equal(CHAT_COPY.photoKey, 'Photo');
  assert.match(composer, /capture="environment"/, 'Take a photo');
  assert.match(composer, /data-photo-input="choose"/, 'Choose a photo');
  assert.match(composer, /onPaste=\{onPaste\}/);
  assert.match(composer, /onDrop: \(event\) =>/);
  assert.equal(CHAT_COPY.field, 'Ask a doubt, or add a photo of a question');
  assert.equal(CHAT_COPY.fieldPhoto, 'Add what you marked, if you like');
  assert.equal(CHAT_COPY.photoPrivacy, 'Keep your name and roll number out of the photo. MockMob does not keep it.');
  assert.equal(CHAT_COPY.aiNote, 'Mobi is AI and can be wrong.');
  const lines = Object.values(CHAT_COPY).map((v) => (typeof v === 'function' ? v('Goodwill', 'Accountancy') : v));
  for (const line of [...lines, doubtBuys(), hello('Riya'), contextLine({ sessions: 3, range: { low: '150', high: '175', max: '250' } })]) assert.doesNotMatch(String(line), BANNED, String(line));
  for (const file of ['./ChatComposer.jsx', './ChatThread.jsx', './ChatEmpty.jsx', './ChatHistory.jsx', './AskMobiPanel.jsx', './MentorRecordPage.jsx']) {
    assert.doesNotMatch(code(read(file)), /MISTAKE_COPY\.photoPrivacy|priceLine\(|An AI service|OpenAI/, `${file} draws no line that names the provider`);
  }
});

test('the start of a chat: the greeting, one line of real context, and the fresh account said plainly', () => {
  assert.equal(hello('Riya'), 'Hi Riya.');
  assert.equal(hello(''), 'Hi.');
  assert.equal(CHAT_COPY.headline, 'What do you want to work on?');
  assert.equal(contextLine({ sessions: 3, range: { low: '150', high: '175', max: '250' } }), 'Mobi has your 3 papers: 150 to 175 out of 250 from your practice.');
  assert.equal(contextLine({ sessions: 1, range: null }), 'Mobi has your first paper and answers from it.');
  assert.equal(contextLine({ sessions: 12 }), 'Mobi has your 12 papers and answers from them.');
  const start = read('./ChatEmpty.jsx');
  assert.match(start, /<span>\{DOOR_COPY\.emptySay\} <Link href=\{FIRST_SET_HREF\} className="ace-inline">\{DOOR_COPY\.emptyKey\}<\/Link><\/span>/, 'a fresh account: the honest line and the one first-set key');
  assert.match(read('./MentorRecordPage.jsx'), /<p className="ace-fresh__body">\{DOOR_COPY\.emptyBody\}<\/p>\s*<Link href=\{FIRST_SET_HREF\} className="ach-key">\{DOOR_COPY\.emptyKey\}<\/Link>\s*<p className="mrp-quiet">\{DOOR_COPY\.emptyAfter\}<\/p>/, 'Your record says the rest, with the same key');
  assert.match(start, /contextLine\(\{ sessions: insights\.sessions, range \}\)/, 'the context line is the record\'s own figures');
  assert.match(start, /const range = view && \(view\.kind === 'ready' \|\| view\.kind === 'partial'\) \? view\.range : null;/, 'the range is Where you stand\'s, never worked out a second way');
});

test('copying an answer gives plain text; a saved exchange keeps its whole reply', () => {
  assert.equal(turnAsText({ response: { reply: '  A reply.  ' } }), 'A reply.');
  const mistake = { tests: 'Ratios.', answer: { sure: true, text: '(a) 12:8:5' }, why: 'Because.', slip: 'You added.' };
  const text = mistakeAsText(mistake, MISTAKE_COPY);
  assert.ok(text.includes(MISTAKE_COPY.tests) && text.includes('(a) 12:8:5') && text.includes('You added.'));
  assert.ok(mistakeAsText({ ...mistake, answer: { sure: false, text: null }, slip: null }, MISTAKE_COPY).includes(MISTAKE_COPY.notSure));
  assert.equal(turnAsText({ mistake: { mistake } }, MISTAKE_COPY), text);
  const rows = exchangesFrom([{ id: 'u', role: 'user', text: 'Explain goodwill' }, { id: 'a', role: 'assistant', response: { reply: 'word '.repeat(80), origin: 'model', charge: { amount: 1 } } }]);
  assert.ok(rows[0].reply.endsWith('…'), 'the list row is cut');
  assert.equal(rows[0].replyFull, 'word '.repeat(80).trim(), 'the opened exchange is read as it was');
  assert.equal(savedCost(rows[0]), '1 credit used.');
  assert.equal(savedCost({ origin: 'model', charged: 0 }), 'A written answer.', 'a saved reply that cost nothing claims no cost');
  assert.equal(savedCost({ origin: 'record' }), 'Free, from your record.');
  assert.equal(savedCost({ origin: null }), null);
});

test('the report key offers the four reasons the report route takes', () => {
  const thread = read('./ChatThread.jsx');
  for (const label of Object.values(REPORT_REASONS)) assert.ok(thread.includes(`'${label}'`), label);
  assert.match(thread, /fetch\('\/api\/ai\/mentor\/report'/, 'the product\'s own route for reporting a reply');
  assert.match(code(read('./AskMobiPanel.jsx')), /const report = response\.origin === 'model' && response\.charged > 0 && requestId \? \{ requestId, sessionId \} : null;/, 'only a written reply the student was charged for can be reported');
});

test('a written answer is laid out for reading: headings, steps on their own lines, a sum kept on its lines', () => {
  const blocks = proseBlocks('The idea:\n\nWork it out in three steps:\n1. Write the old share.\n2. Write the new share.\n\nA gave up 3/5 − 12/25 = 3/25.\nB gave up 2/5 − 8/25 = 2/25.\n\n- one\n- two');
  assert.deepEqual(blocks.map((b) => b.type), ['h', 'p', 'ol', 'p', 'ul']);
  assert.deepEqual(blocks[2], { type: 'ol', start: 1, items: ['Write the old share.', 'Write the new share.'] });
  assert.deepEqual(blocks[3].lines, ['A gave up 3/5 − 12/25 = 3/25.', 'B gave up 2/5 − 8/25 = 2/25.']);
  assert.deepEqual(proseBlocks('**What it tests**')[0], { type: 'h', text: 'What it tests' });
  assert.deepEqual(proseBlocks('A full sentence that ends with a colon after quite a lot of words, more than sixty characters:')[0].type, 'p');
  assert.deepEqual(inlineParts('Take **care** here'), [{ text: 'Take ', bold: false }, { text: 'care', bold: true }, { text: ' here', bold: false }]);
  assert.deepEqual(inlineParts('2 ** 3'), [{ text: '2 ** 3', bold: false }], 'unpaired stars stay as typed');
  assert.deepEqual(proseBlocks(''), []);
  assert.doesNotMatch(read('./ChatThread.jsx'), /dangerouslySetInnerHTML/, 'a reply is never drawn as markup');
});

test('the chat sheet: two volts only, targets of 44 px, and motion that stops when asked', () => {
  const css = read('./ask-chat.css');
  assert.match(css, /\.ach-photokey \{[^}]*min-height: 44px;/);
  assert.match(css, /\.ach-send \{[^}]*width: 44px; height: 44px;/);
  assert.match(css, /\.ach-headkey \{[^}]*min-height: 44px;/);
  assert.match(css, /\.ace-tile \{[^}]*min-height: 96px;/, 'big tiles');
  assert.match(css, /\.ach \.ach-field \{[^}]*font-size: 16px;/, 'a phone never zooms the page on focus');
  assert.match(css, /\.ach\[data-form='page'\]\[data-keyboard\] \.ach-foot \{ bottom: calc\(var\(--ach-kb, 0px\) \+ 8px\); \}/, 'the composer sits on the keyboard');
  assert.match(css, /html\[data-motion='reduced'\] \.ach-wait__bar::after \{ animation: none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /transition: all|backdrop-filter|text-shadow/);
});
