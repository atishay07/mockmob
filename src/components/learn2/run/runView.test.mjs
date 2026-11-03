// node --test src/components/learn2/run/runView.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_END_LINE, checkpointLines, endHeadline, endNumbers, endProgress, pileFrontSize, reachedPlace, reviseLabel, stopSheetLine } from '../stage/endModel.mjs';
import { answerTally, endLines, endTitle, freeEndLines, frontStep, itemHeld, itemsFinished, leadView, movedParts, placeReinsert, positionWords, reviseSummary, rightLine, runPiles, stageTag, stateKeyOf } from './runView.mjs';

const card = (id, cardId = id, extra = {}) => ({ id, type: 'card', card: { id: cardId }, ...extra });
const q = (id, origin = 'chapter') => ({ id, type: 'question', origin, question: { id: `q-${id}` } });

test('frontStep follows the length steps of R3 L1: 60, 140, longer', () => {
  assert.equal(frontStep('What is partnership?'), 's');
  assert.equal(frontStep('x'.repeat(60)), 's');
  assert.equal(frontStep('x'.repeat(61)), 'm');
  assert.equal(frontStep('x'.repeat(140)), 'm');
  assert.equal(frontStep('x'.repeat(141)), 'l');
});

test('stageTag says why a card is here, and nothing in a recap', () => {
  assert.equal(stageTag({ stage: 'due' }), 'Due today');
  assert.equal(stageTag({ reason: 'line' }), 'The line you needed');
  assert.equal(stageTag({ reason: 'earlier' }), 'Back from earlier');
  assert.equal(stageTag({ stage: 'again', again: true }), 'Back from earlier');
  assert.equal(stageTag({ stage: 'due' }, { recap: true }), null);
  assert.equal(stageTag({ stage: 'new' }), null);
});

test('runPiles counts distinct cards, marks the current pile, and says "left" on a resumed run', () => {
  const items = [card('i1', 'c1'), card('i2', 'c2'), q('i3'), card('i4', 'c1', { again: true }), q('i5', 'mistake')];
  const piles = runPiles(items, 3, { at: 3 });
  assert.deepEqual(piles.map((p) => [p.id, p.label, p.value, p.current]), [['cards', 'Key cards', '2 of 2', true], ['questions', 'Questions', '1 of 1', false], ['mistakes', '1 open mistake', '', false]]);
  const resumed = runPiles(items, 0, { resumed: true });
  assert.equal(resumed[0].value, '2 left');
  // R2 screens 10: before anything is done, the rail reads totals, never a column of zeros.
  const fresh = runPiles([...items, card('i6', 'c3')], 0, { at: 0 });
  assert.deepEqual(fresh.map((p) => p.label), ['3 Key cards', '1 question', '1 open mistake']);
  for (const p of fresh) assert.doesNotMatch(`${p.label} ${p.value}`, /(^|\s)0( |$)/);
});

test('answerTally keeps plain questions and old mistakes apart, with the streak', () => {
  const items = [q('a'), q('b'), q('c'), q('m', 'mistake')];
  const answers = { a: { result: { correct: true } }, b: { result: { correct: true } }, c: { result: { correct: true } }, m: { result: { correct: false } } };
  const t = answerTally(items, answers);
  assert.deepEqual(t, { answered: 3, right: 3, tried: 1, fixed: 0, streak: 0 });
  assert.equal(answerTally(items.slice(0, 3), answers).streak, 3);
  assert.equal(rightLine(3), 'Right. 3 in a row.');
  assert.equal(rightLine(2), 'Right.');
});

test('positionWords names the item for the live region', () => {
  assert.equal(positionWords({ type: 'card' }, 3, 21), 'Card 3 of 21');
  assert.equal(positionWords({ type: 'question' }, 4, 21), 'Question 4 of 21');
});

test('placeReinsert moves a card already ahead (never a copy) and puts a new one 3 later, after a resume too (A8 F9, F11)', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
  const moved = placeReinsert(list, { itemId: 'f', at: 3, moved: true }, { current: 0 });
  assert.deepEqual(moved.map((x) => x.id), ['a', 'b', 'c', 'f', 'd', 'e']);
  assert.equal(moved.length, list.length);
  const copy = placeReinsert(list, { itemId: 'r1', at: 4, item: { type: 'card' } }, { current: 1 });
  assert.deepEqual(copy.map((x) => x.id), ['a', 'b', 'c', 'd', 'r1', 'e', 'f']);
  const twice = placeReinsert(copy, { itemId: 'r1', at: 4, item: { type: 'card' } }, { current: 1 });
  assert.equal(twice, copy);
  // A resumed run holds only the items after `offset`; the server's place is in the whole list.
  const resumed = placeReinsert(list, { itemId: 'r2', at: 12, item: {} }, { current: 0, offset: 10 });
  assert.deepEqual(resumed.map((x) => x.id), ['a', 'b', 'r2', 'c', 'd', 'e', 'f']);
  // Never before the item on screen.
  const early = placeReinsert(list, { itemId: 'r3', at: 0, item: {} }, { current: 2 });
  assert.equal(early.findIndex((x) => x.id === 'r3'), 3);
});

test('the end reads lines, not repeated numbers (A4 3.4.2)', () => {
  const d = {
    numbers: { cards: 16, questions: 3, fixed: 1, mistakes: 2, detail: { cards: '16 got it' } },
    lines: [{ label: 'Cards', text: '16 got it' }, { label: 'Questions', text: '3 of 3 right' }, { label: 'Mistakes', text: '1 of 2 fixed, 1 still open' }],
  };
  assert.deepEqual(endLines(d), [
    { label: 'Key cards', value: '16 rated, all got it' },
    { label: 'Questions', value: '3 of 3 right' },
    { label: 'Open mistakes', value: '1 of 2 fixed, 1 still open' },
  ]);
  const mixed = endLines({ numbers: { cards: 4, mistakes: 0, detail: { cards: '2 got it, 1 easy, 1 missed' } }, lines: [{ label: 'Cards', text: '2 got it, 1 easy, 1 missed, 2 looked at' }, { label: 'Mistakes', text: '0 of 2 fixed, 2 still open' }] });
  assert.deepEqual(mixed, [{ label: 'Key cards', value: '4 rated: 2 got it, 1 easy, 1 missed, 2 looked at' }]);
});

test('the Revise summary, the moved line and the state keys', () => {
  assert.deepEqual(reviseSummary([{ label: 'back on Wed', count: 14 }, { label: 'back in 20 days', count: 2 }]), { total: 16, line: '14 back Wed, 2 back in 20 days' });
  assert.deepEqual(movedParts('Admission of a Partner moved from Getting there to Holding.'), { from: 'Getting there', to: 'Holding' });
  assert.equal(movedParts(null), null);
  assert.equal(stateKeyOf('Getting there'), 'getting_there');
});

test('the lead names its length on a run and its own verb otherwise; Free splits its line', () => {
  assert.deepEqual(leadView({ kind: 'next', title: 'Next: Goodwill', minutes: 10, evidence: 'The next chapter in your book.', run: { kind: 'mix', minutes: 10 } }), { heading: 'Next: Goodwill', reason: 'The next chapter in your book.', key: 'Start · 10 min' });
  assert.deepEqual(leadView({ kind: 'revise', title: 'Revise 12 due cards', minutes: 3, href: '/review/revise' }), { heading: null, reason: null, key: 'Revise 12 due cards' });
  assert.deepEqual(freeEndLines({ line: 'Your free Learn session for today is done. Explore questions stay free. Pro has as many as you like.' }), { head: 'Your free Learn session for today is done.', rest: 'Explore questions stay free. Pro has as many as you like.' });
  assert.deepEqual(endTitle('10 minutes on Goodwill'), { lead: '10 minutes on', name: 'Goodwill' });
  assert.deepEqual(endTitle('Quick recap of Goodwill', { kind: 'recap' }), { lead: 'Quick recap of', name: 'Goodwill' });
});

test('itemsFinished counts the item on screen once the server has it, so the stop sheet matches the end screen', () => {
  const c = card('c1');
  const question = q('q1');
  // Before the card is rated: only the items before it.
  assert.equal(itemsFinished({ phase: 'play', at: 3, length: 10, item: c }), 3);
  // Rated and confirmed, still flying away: the server already counts it, so the sheet does too.
  assert.equal(itemsFinished({ phase: 'play', at: 3, length: 10, item: c, acted: true }), 4);
  // A question counts once answered, not before.
  assert.equal(itemsFinished({ phase: 'play', at: 5, length: 10, item: question }), 5);
  assert.equal(itemsFinished({ phase: 'play', at: 5, length: 10, item: question, answered: true }), 6);
  // An unanswered card is never counted by "answered" alone.
  assert.equal(itemsFinished({ phase: 'play', at: 2, length: 10, item: c, answered: true }), 2);
  // Off the play screen every item of the list is finished.
  assert.equal(itemsFinished({ phase: 'end', at: 2, length: 10, item: null }), 10);
});

// ---------------------------------------------------------------- R2 ruling 5: the end formula, never a zero

test('R3 L5 end formula: the headline says how far, never a zero; " in N min" only from 2 min', () => {
  assert.equal(endHeadline({ reached: 20, of: 20, minutes: 9 }), '20 done in 9 min');
  assert.equal(endHeadline({ reached: 18, of: 18, minutes: 2 }), '18 done in 2 min');
  assert.equal(endHeadline({ reached: 18, of: 18, minutes: 1 }), '18 done', 'not "in 1 min"');
  assert.equal(endHeadline({ reached: 20, of: 20 }), '20 done');
  assert.equal(endHeadline({ reached: 7, of: 20, minutes: 3 }), '7 of 20 done');
  assert.equal(endHeadline({ reached: 5, of: 20, stopped: true }), '5 of 20 done');
  assert.equal(endHeadline({ reached: 20, of: 20, stopped: true }), '20 of 20 done');
  assert.equal(endHeadline({ reached: 0, of: 20 }), null, 'nothing done leads with the chapter, not "0"');
  assert.equal(endHeadline({ reached: 3, of: 0 }), null);
});

test('R3 L5 end formula: up to 3 numbers with one set of labels, every zero dropped, no "cards seen", no "mistakes tried"', () => {
  assert.deepEqual(endNumbers({ revise: 14, reviseText: reviseLabel([{ label: 'back on Wed', count: 14 }]), answered: 2, right: 1, mistakes: 2, fixed: 2 }), [
    { value: '14', n: 14, label: 'in Revise, back Wed' },
    { value: '1 of 2', n: 1, label: 'questions right' },
    { value: '2', n: 2, label: 'open mistakes fixed' },
  ]);
  assert.deepEqual(endNumbers({ revise: 0, seen: 12, answered: 3, right: 3 }).map((x) => [x.value, x.label]), [['3 of 3', 'questions right']], 'the bar carries cards seen');
  assert.deepEqual(endNumbers({ answered: 2, right: 0, mistakes: 1, fixed: 0 }).map((x) => [x.value, x.label]), [['2', 'questions tried']], 'no fixed mistake: no number');
  assert.deepEqual(endNumbers({ fixed: 1, mistakes: 2 }).map((x) => [x.value, x.label]), [['1', 'open mistake fixed']]);
  for (const x of endNumbers({ revise: 3, answered: 4, right: 1, mistakes: 3, fixed: 2 })) assert.doesNotMatch(x.label, /tried|missed|old|seen/);
  assert.deepEqual(endNumbers({}), []);
  const all = [endNumbers({ revise: 0, seen: 0, answered: 0, mistakes: 0 }), endNumbers({ revise: 3, seen: 5, answered: 4, right: 0, mistakes: 2, fixed: 0 }), endNumbers({ answered: 1, right: 1 })].flat();
  for (const x of all) assert.ok(x.n > 0 && !/^0( |$)/.test(x.value), `no zero: ${x.value}`);
  assert.ok(endNumbers({ revise: 1, answered: 1, right: 1, mistakes: 1, fixed: 1, seen: 9 }).length <= 3);
  assert.equal(reviseLabel([]), 'in Revise');
});

// Walk I2: one group keeps "back <when>"; groups that differ say "the first back <when>".
test('I2: the Revise line says "the first back" when the cards come back at different times', () => {
  assert.equal(reviseLabel([{ label: 'back tomorrow', count: 3 }]), 'in Revise, back tomorrow');
  assert.equal(reviseLabel([{ label: 'back on Wed', count: 3 }]), 'in Revise, back Wed');
  assert.equal(reviseLabel([{ label: 'back tomorrow', count: 2 }, { label: 'back on Fri', count: 1 }]), 'in Revise, the first back tomorrow');
  assert.equal(reviseLabel([{ label: 'back on Wed', count: 2 }, { label: 'back in 12 days', count: 1 }]), 'in Revise, the first back Wed');
  assert.equal(reviseLabel([{ label: 'later today', count: 1 }, { label: 'back tomorrow', count: 1 }]), 'in Revise, the first back later today');
  assert.equal(reviseLabel([{ label: 'due now', count: 1 }, { label: 'back tomorrow', count: 1 }]), 'in Revise, the first due now');
  assert.equal(reviseLabel([{ label: 'back tomorrow', count: 0 }, { label: 'back on Fri', count: 2 }]), 'in Revise, back Fri', 'an empty group is not a group');
  assert.equal(endNumbers({ revise: 3, reviseText: reviseLabel([{ label: 'back tomorrow', count: 2 }, { label: 'back on Fri', count: 1 }]) })[0].label, 'in Revise, the first back tomorrow');
});

test('R2 end formula: the progress bar grows from before to now, and is absent when nothing is seen', () => {
  assert.deepEqual(endProgress({ of: 46, seen: 31, before: 15 }), { from: 15 / 46, to: 31 / 46, label: '31 of 46 cards seen' });
  assert.equal(endProgress({ of: 46, seen: 0, before: 0 }), null);
  assert.equal(endProgress(null), null);
  assert.equal(endProgress({ of: 10, seen: 12, before: 30 }).to, 1);
});

test('R2: the stop sheet, the checkpoint and the Free line say it once, with no zero', () => {
  assert.equal(stopSheetLine(5, 20), '5 of 20 done. It\u2019s all saved.');
  assert.equal(checkpointLines({ answered: 1, right: 1 }, { done: 8, of: 17, left: 'About 6 min left' }).line, '8 of 17 done, about 6 min left.');
  assert.equal(FREE_END_LINE, "That was today's free session. Questions come back tomorrow.", 'R3 F: FREE_DONE_HEADLINE + " Questions come back tomorrow."');
  assert.equal(pileFrontSize('The Partnership Act does not require'), 13);
  assert.equal(pileFrontSize('Interest on capital is a charge, appropriation'), 12);
});

// ---------------------------------------------------------------- R3-SPEC ruling F: the feed refusal's Or rows

test('R3 F: the refusal is See Pro, then at most 2 Or rows in order: Continue, Revise due cards, Answer single questions', async () => {
  const { freeUsedRows } = await import('../stage/endModel.mjs');
  const revise = { kind: 'revise', label: 'Revise 3 due cards · 1 min', run: { kind: 'cards', chapterKey: 'a.b', cardIds: ['c1', 'c2', 'c3'], minutes: 1 } };
  const explore = { kind: 'explore', label: 'Answer single questions', href: '/explore?subject=a', go: 'explore' };
  const resume = { id: 'lr_1', kind: 'feed', chapterKey: 'a.b', done: 4, of: 12, minutesLeft: 5.4 };
  assert.deepEqual(freeUsedRows({ resume, options: [revise, explore] }).map((r) => r.label), ['Continue · 6 min', 'Revise 3 due cards · 1 min']);
  assert.deepEqual(freeUsedRows({ resume: null, options: [revise, explore] }).map((r) => r.label), ['Revise 3 due cards · 1 min', 'Answer single questions']);
  assert.deepEqual(freeUsedRows({ resume: { ...resume, done: 12 }, options: [explore] }).map((r) => r.label), ['Answer single questions'], 'a finished run is not continued');
  assert.deepEqual(freeUsedRows({}).map((r) => r.id), ['singles']);
  for (const r of freeUsedRows({ resume, options: [revise, explore] })) assert.doesNotMatch(r.label, /Pick up|opens again tomorrow|, \d+ min/);
});

test('R3 W and F: the run, the feed, the ends and the refusal never carry a retired word', async () => {
  const { readFileSync } = await import('node:fs');
  const root = new URL('../', import.meta.url);
  const files = ['run/RunPlayer.jsx', 'run/RunParts.jsx', 'run/RunEnd.jsx', 'feed/ChapterFeed.jsx', 'stage/Stage.jsx', 'stage/CardFace.jsx', 'stage/EndForm.jsx', 'stage/FreeUsed.jsx', 'stage/Sheet.jsx', 'stage/endModel.mjs', '../../../data/learn/suggest.js'];
  const banned = [/Show answer/, /Tap the card to turn it(?! over)/, /Tap the answer/, /Pick up where you stopped/, /Pick up, /, /Another \d+ minutes/, /Another \$\{/, /new cards left here,/, /[Oo]ld mistakes?/, /mistakes? tried/, /Learn opens again tomorrow/, /Find your level/, /free session is used/, /Pro has no daily limit/, /'Keep'/];
  for (const f of files) {
    const text = readFileSync(new URL(f, root), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    for (const re of banned) assert.doesNotMatch(text, re, `${f}: ${re}`);
  }
  const words = (await import('../../../../data/learn/words.js')).WORDS;
  assert.deepEqual([words.turnOver, words.turnCue, words.pickHint, words.reviseLater, words.inRevise, words.seePro, words.singles], ['Turn over', 'Tap the card to turn it over', 'Pick the answer you think is right.', 'Revise later', 'In Revise', 'See Pro', 'Answer single questions']);
});

// ---------------------------------------------------------------- R4-run
import { progressLabel, miniFront, FREE_REST_PRO } from '../stage/endModel.mjs';
import { runAddressParams, feedAddressParams, sameAddress } from './address.mjs';
import { chapterPlace } from '../../../../data/learn/words.js';

const source = async (f) => (await import('node:fs')).readFileSync(new URL(f, new URL('../', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

test('R4 first-timer#4: a Free bar says the rest open with Pro once the free cards are all seen', () => {
  assert.equal(FREE_REST_PRO, 'The rest open with Pro.');
  assert.equal(progressLabel({ seen: 5, of: 45, open: 5 }), '5 of 45 cards seen. The rest open with Pro.');
  assert.equal(progressLabel({ seen: 3, of: 45, open: 5 }), '3 of 45 cards seen', 'free cards still to see');
  assert.equal(progressLabel({ seen: 20, of: 45 }), '20 of 45 cards seen', 'Pro sends no open count');
  assert.equal(progressLabel({ seen: 45, of: 45, open: 45 }), '45 of 45 cards seen', 'a chapter Free opens whole');
  assert.equal(endProgress({ of: 45, seen: 5, before: 0, open: 5 }).label, '5 of 45 cards seen. The rest open with Pro.');
  assert.equal(endProgress({ of: 45, seen: 20, before: 14 }).label, '20 of 45 cards seen');
});

test('R4 owner-eye#14: a fan mini is cut at a word boundary, never mid-word', async () => {
  assert.equal(miniFront('A partnership firm has no separate legal entity from its partners at all'), 'A partnership firm has no separate legal entity from…');
  assert.equal(miniFront('The sacrifice by a partner.'), 'The sacrifice by a partner.');
  assert.equal(miniFront('Name the 6 essential features of a partnership as given in the Act'), 'Name the 6 essential features of a partnership as…');
  assert.equal(miniFront('Persons are called ________ and ________'), 'Persons are called ____ and ____');
  for (const t of ['Persons who have entered into partnership with one another are individually called ____', 'Explain, with reasons, the meaning of goodwill and the sacrificing ratio']) {
    const m = miniFront(t);
    assert.ok(m.endsWith('…') && m.length <= 55, m);
    const kept = m.slice(0, -1);
    assert.ok(t.startsWith(kept) && /[\s,;:.]/.test(t[kept.length]), `whole words only: ${m}`);
  }
  const css = await source('stage/stage.css');
  assert.match(css, /\.st-pile__f \{[^}]*text-wrap: pretty;/, 'pretty, not balance (no orphan first word)');
  assert.match(css, /\.st-pile__fan\[data-small\] \.st-pile__f \{ -webkit-line-clamp: 3; font-size: 10\.5px;/);
  assert.match(await source('stage/EndForm.jsx'), /miniFront\(cardFace\(c\)\.front \|\| c\.front \|\| '', small \? 54 : 72\)/);
});

test('R4 client-code#1: a run started in place writes ?run=<new id>, never end=1 or fresh', async () => {
  const to = runAddressParams({ id: 'run-new', kind: 'mix', chapter: { key: 'accountancy.goodwill' } }, { chapterKey: 'accountancy.goodwill', minutes: 10, kind: 'mistakes', fresh: true, openEnd: true, leaveOut: ['lesson'], cardIds: ['c1'] });
  assert.deepEqual(to, { chapterKey: 'accountancy.goodwill', minutes: 10, kind: 'mix', runId: 'run-new' }, 'the new run by its id; no end, fresh, leave-outs or cards');
  assert.equal(runAddressParams({}, {}), null, 'no id from the server: no address');
  assert.deepEqual(feedAddressParams({ id: 'feed-2', chapter: { key: 'accountancy.goodwill' } }, { minutes: 10 }), ['accountancy.goodwill', 10, { runId: 'feed-2' }]);
  assert.equal(sameAddress('/learn/run?run=x&chapter=a', '/learn/run?chapter=a&run=x'), true);
  assert.equal(sameAddress('/learn/run?run=x&end=1', '/learn/run?run=x'), false, 'an end=1 address is rewritten');
  // The player writes the address the moment the server answers a start or a resume, and only for the current start.
  const player = await source('run/RunPlayer.jsx');
  assert.match(player, /if \(!current\(\)\) return;\n\s+starting\.current = false;\n\s+writeAddress\(data, p\);/);
  assert.match(player, /const href = links\.run\(to\);/);
  assert.match(player, /window\.history\.replaceState\(null, '', href\)/);
  assert.match(player, /const token = \+\+beginToken\.current;/, 'client-code#10: a start carries a token');
  assert.match(player, /if \(starting\.current\) return;\n\s+starting\.current = true;/, 'one start at a time from the end keys');
  const feed = await source('feed/ChapterFeed.jsx');
  assert.match(feed, /const href = to \? links\.feed\(\.\.\.to\) : null;/);
  assert.match(feed, /if \(token === startToken\.current\) adopt\(r\);/, 'Continue resumes and writes the address');
  assert.match(feed, /if \(token === startToken\.current\) adopt\(r, \{ fresh: true \}\);/, 'Keep going starts and writes the address');
  const links = await source('links.js');
  assert.match(links, /\['fresh', fresh \? '1' : ''\]/, 'links.run takes a fresh option (production)');
  assert.match(links, /end: end \? '1' : '', fresh: fresh \? '1' : '' \}\)/, 'and in the preview');
});

test('R4 ruling N: the run and feed rails name the chapter by its place, and draw nothing without one', async () => {
  assert.equal(chapterPlace({ n: 5, of: 14 }), 'Chapter 5 of 14');
  assert.equal(chapterPlace(undefined), '');
  const player = await source('run/RunPlayer.jsx');
  assert.match(player, /const placeLine = chapterPlace\(chapter\.place\) \|\| null;/);
  assert.doesNotMatch(player, /partShort|refLine/, 'no "Part 1, Ch 1" in the run rail');
  const feed = await source('feed/ChapterFeed.jsx');
  assert.match(feed, /const book = chapterPlace\(run\?\.chapter\?\.place\) \|\| null;/);
  assert.doesNotMatch(feed, /chapterRef\(/, 'no "Ch 2, Part 1" in the feed rail');
});

test('R4 ui-correctness#14, client-code#4 and #11: the desktop pile reads "4 to revise", named for a screen reader', async () => {
  const parts = await source('run/RunParts.jsx');
  const code = parts.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  assert.match(code, /export const pileName = \(pile\) => \(pile > 0 \? \{ role: 'img', 'aria-label': `\$\{pile\} \$\{pile === 1 \? 'card' : 'cards'\} to revise later` \}/);
  assert.match(code, /<span className="lr-panel__pile" \{\.\.\.pileName\(pile\)\}>/);
  assert.match(code, /\{pile \? pileLabel\(pile\) : ''\}<\/b>\n\s+<\/span>\n\s+<p className="lr-panel__stamp"/, 'the panel draws pileLabel');
  assert.doesNotMatch(code, /lr-panel__rl">In Revise/, '"In Revise" stays for a card the server confirmed');
  assert.doesNotMatch(code, /role="status"/, 'the tip is not a live region; the player says it');
  const player = await source('run/RunPlayer.jsx');
  assert.match(player, /sayFirst\.current = `\$\{WORDS\.inRevise\}\. `;/);
});

test('R4 owner-eye#15 and ui-correctness#20: the hint once per student above the options; the back\'s source at the foot', async () => {
  const player = await source('run/RunPlayer.jsx');
  assert.match(player, /export const coachKeyOf = \(userId\) => `mm:learn2:coach:v2:\$\{userId \|\| 'anon'\}`;/);
  assert.match(player, /useCoach\(coachKey, 'pick', phase === 'play' && !hasHistory && at === firstQuestion && !answered\)/);
  assert.doesNotMatch(player, /coachPick && item\?\.type === 'question' && !answered \? \{ text: WORDS\.pickHint \}/, 'no longer in the status line under Skip');
  const parts = await source('run/RunParts.jsx');
  assert.match(parts, /<div className="lr-stemwrap"><Stem text=\{q\.body\} \/><\/div>\n\s+\{hint && !result \? <p className="lr-q__hint">\{hint\}<\/p> : null\}\n\s+<div className="lr-opts"/);
  assert.match(parts, /<InShort card=\{card\} \/>\n\s+<\/div>\n[^\n]*\n\s+\{src \? <p className="lr-src lr-src--back">/, 'the source sits after the back block, at the foot');
});

// ---------------------------------------------------------------- R5 LK45 fix 2: one count of "done"

test('R5 LK45 fix 2: the stop sheet counts as the end does: the place of the last item the server holds an event for', () => {
  const items = [card('i1'), card('i2'), q('i3'), card('i4'), q('i5'), card('i6')];
  const count = (at, answers = {}, actedId = null, offset = 0) => reachedPlace(items, (item, index) => itemHeld({ item, index, at, answers, actedId }), offset);
  assert.equal(count(0), 0, 'nothing done: Close leaves');
  assert.equal(count(0, {}, 'i1'), 1, 'the card on screen counts once its rating is in the servers hands');
  assert.equal(count(3), 2, 'a question passed with no answer holds no event: the last held place is the second card');
  const answered = { i3: { result: { correct: true } } };
  assert.equal(count(3, answered), 3);
  // A skipped question writes nothing, so the end would not count it as the last place reached.
  const skipped = { i5: { status: 'skipped' } };
  assert.equal(count(5, skipped), 4, 'passed items i1..i4: i3 unanswered, i4 a card: place 4');
  assert.equal(count(5, skipped, null), 4);
  assert.equal(count(4, { i5: { status: 'skipped' } }), 4);
  assert.equal(count(2, { i3: { result: { correct: false } } }, null, 5), 8, 'a resumed run: the prefix is the offset');
  assert.equal(count(0, {}, null, 5), 5, 'nothing new this session: where the first one stopped');
});

test('R5 LK45 fix 2: a question skipped as the latest item is not "done" (the server holds no event for it)', () => {
  const items = [card('a'), q('b')];
  const held = (answers) => reachedPlace(items, (item, index) => itemHeld({ item, index, at: 1, answers }), 0);
  assert.equal(held({ b: { status: 'skipped' } }), 1);
  assert.equal(held({ b: { status: 'done', result: { correct: true } } }), 2);
});

test('R5 LK45 fix 2: the stop sheet line carries the same number', () => {
  assert.equal(stopSheetLine(reachedPlace([card('x'), card('y')], (_, i) => i === 1, 0), 18), '2 of 18 done. It’s all saved.');
});

// ---------------------------------------------------------------- R5 LK38: a moved card takes the fresh words

test('R5 LK38: a card moved closer by a wrong answer takes the fresh `returns` (its one second showing is used)', () => {
  const list = [card('a'), card('b'), card('c'), card('d', 'dc', { returns: { missed: 'in this session, then tomorrow', got: 'in 3 days', easy: 'in 8 days' } })];
  const fresh = { missed: 'tomorrow', got: 'in 3 days', easy: 'in 8 days' };
  const out = placeReinsert(list, { itemId: 'd', at: 2, moved: true, item: { id: 'd', returns: fresh } }, { current: 0 });
  assert.deepEqual(out.map((x) => x.id), ['a', 'b', 'd', 'c']);
  assert.deepEqual(out[2].returns, fresh);
  const same = placeReinsert(list, { itemId: 'd', at: 2, moved: true }, { current: 0 });
  assert.equal(same[2].returns.missed, 'in this session, then tomorrow', 'no fresh words sent: kept');
});
