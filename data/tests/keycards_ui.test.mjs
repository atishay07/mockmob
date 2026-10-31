// Key cards web screens (KEYCARDS-BUILD-SPEC.md section 3): the pure words and shapes the screens share, the fixtures'
// match with the API contract of section 2e, the Revise queue's Key card source and the Pro line.
//   node --test data/tests/keycards_ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  KIND_LABELS, PRO_LINE, RATINGS, backLines, chapterRef, chapterRefSpoken, countsLine, endCounts, findChapter, markBlanks, readingRows, slugChapter,
  sourceLine, splitBlanks, splitDeck, stateCue, todayLine,
} from '../../src/components/keycards/kinds.js';
import {
  FIXTURE_DECKS, fixtureChapters, fixtureDeck, fixtureDeckView, fixtureHome, fixtureKeycards, fixtureLine, fixtureReviseKeycards, fixtureTasteIds,
} from '../../src/components/keycards/fixtures.js';
import { filterSource, itemKey, keycardMinutes, kindLine, mergeQueue, mixParts, recordAnswer, startRun, summary } from '../../src/components/revise/reviseQueue.js';
import { PLACEMENTS, TRIGGERS, benefitLines, inlineCopy, sheetHead } from '../../src/lib/proNudge.mjs';

const FORBIDDEN = /mastered|mastery|marks to recover|marks you could recover|!/i;
const CH1 = 'business_studies.nature-and-significance-of-management';

test('kind labels are exactly the content spec labels', () => {
  assert.equal(KIND_LABELS.definition, 'Definition');
  assert.equal(KIND_LABELS.key_line, 'Key line');
  assert.equal(KIND_LABELS.one_word, 'One word');
  for (const label of Object.values(KIND_LABELS)) assert.match(label, /^[A-Z][a-z ]+$/, label);
});

test('blanks: the front splits on ____ and the quote marks the blanked words in order', () => {
  assert.deepEqual(splitBlanks('Poor management is due to both ____ and ____.'), [
    { text: 'Poor management is due to both ' }, { blank: true, n: 1 }, { text: ' and ' }, { blank: true, n: 2 }, { text: '.' },
  ]);
  assert.deepEqual(splitBlanks('No blanks here'), [{ text: 'No blanks here' }]);
  assert.deepEqual(markBlanks('Poor management is due to both inefficiency and ineffectiveness.', ['inefficiency', 'ineffectiveness']), [
    { text: 'Poor management is due to both ' }, { mark: 'inefficiency' }, { text: ' and ' }, { mark: 'ineffectiveness' }, { text: '.' },
  ]);
  // A blank that is not in the quote is not marked, and the text is never lost.
  assert.equal(markBlanks('Coordination binds.', ['garland']).map((p) => p.text || p.mark).join(''), 'Coordination binds.');
});

test('references are the spec\'s own ("Business Studies Part 1, Ch 1, p. 3"), and spoken in full words', () => {
  assert.equal(sourceLine({ kind: 'ncert', book: 'Business Studies Part 1', chapterNo: 1, page: 3 }), 'Business Studies Part 1, Ch 1, p. 3');
  assert.equal(sourceLine({ kind: 'ncert', book: 'Accountancy Part 2', chapterNo: 5, page: null }), 'Accountancy Part 2, Ch 5');
  assert.equal(sourceLine({ kind: 'wordnet' }), 'Meaning from WordNet');
  assert.equal(sourceLine(null), null);
  assert.equal(chapterRef({ book: 'Accountancy Part 2', chapter: 5 }), 'Accountancy Part 2, Ch 5');
  assert.equal(chapterRefSpoken({ book: 'Accountancy Part 2', chapter: 5 }), 'Accountancy Part 2, chapter 5');
  assert.equal(chapterRef({ book: 'Introductory Microeconomics', chapter: null }), 'Introductory Microeconomics');
});

test('Free reading: every locked stub is gathered into one quiet row after the open cards', () => {
  const view = fixtureDeckView(FIXTURE_DECKS[CH1], false);
  const rows = readingRows(view);
  const stubs = rows.filter((r) => r.stub);
  assert.equal(stubs.length, 1);
  assert.equal(stubs[0].stub, view.filter((c) => c.locked).length);
  assert.ok(rows.at(-1).stub, 'the stub row comes last');
  assert.equal(splitDeck(view).open.length, 5);
  // The taste is data/keycards.js tasteIds: the first 5 Must-know cards in book order; the deck itself stays in book order.
  const open = splitDeck(view).open;
  assert.ok(open.every((c) => c.importance === 'must'));
  assert.deepEqual(open.map((c) => c.order), [...open.map((c) => c.order)].sort((a, b) => a - b));
  assert.deepEqual([...fixtureTasteIds(FIXTURE_DECKS[CH1])].sort(), open.map((c) => c.id).sort());
  // The fixtures' rule is the shared one (data/keycards/fixtures/taste.json).
  const shared = JSON.parse(readFileSync(new URL('../keycards/fixtures/taste.json', import.meta.url), 'utf8'));
  for (const [chapterKey, ids] of Object.entries(shared.taste)) {
    assert.deepEqual([...fixtureTasteIds(shared.cards.filter((c) => c.chapterKey === chapterKey))], ids, chapterKey);
  }
  // Pro sees every card whole.
  assert.equal(readingRows(fixtureDeckView(FIXTURE_DECKS[CH1], true)).filter((r) => r.stub).length, 0);
});

test('chapter rows: counts and states in words, no percentage, no forbidden word', () => {
  assert.deepEqual(countsLine({ cards: 38, unlocked: 5, added: 5, due: 2 }, false), { line: '38 cards, 2 due', open: '5 of 38 open' });
  assert.deepEqual(countsLine({ cards: 18, added: 12, due: 6 }, true), { line: '18 cards, 6 due', open: null });
  assert.deepEqual(countsLine({ cards: 18, added: 12, due: 0 }, true), { line: '18 cards, 0 due', open: null });
  assert.deepEqual(countsLine({ cards: 1, added: 0, due: 0 }, true), { line: '1 card', open: null });
  assert.deepEqual(countsLine({ cards: 0 }, true), { line: 'No cards yet', open: null });
  assert.equal(stateCue({ state: 'strong', label: 'Holding', fading: true }).label, 'Holding, fading');
  assert.equal(stateCue(null).label, 'Not started');
  for (const s of ['none', 'thin', 'weak', 'mid', 'strong']) assert.doesNotMatch(stateCue({ state: s }).label, FORBIDDEN);
  assert.equal(todayLine({ due: 14, minutes: 4 }), '14 cards due today, about 4 minutes.');
  assert.equal(todayLine({ due: 1, minutes: 1 }), '1 card due today, about 1 minute.');
  assert.equal(todayLine({ due: 0 }), 'Nothing due today.');
  assert.deepEqual(endCounts({ 1: 2, 3: 5 }), [{ label: 'Missed', n: 2 }, { label: 'Got it', n: 5 }, { label: 'Easy', n: 0 }]);
  assert.deepEqual(RATINGS.map((r) => [r.rating, r.key]), [[1, '1'], [3, '2'], [4, '3']]);
  assert.deepEqual(backLines('a\n\nb\n'), ['a', 'b']);
});

test('a chapter is found by its key, its title or its stored name', () => {
  const home = fixtureHome({ isPro: true });
  assert.equal(slugChapter('business_studies', 'Nature and Significance of Management'), 'business_studies.nature-and-significance-of-management');
  assert.equal(findChapter(home, 'business_studies', 'Nature and Significance of Management')?.cards, FIXTURE_DECKS[CH1].length);
  assert.equal(findChapter(home, 'business_studies', 'No such chapter'), null);
  const named = { subjects: [{ subject: 'accountancy', units: [{ unit: 'U', chapters: [{ key: 'accountancy.x', title: 'X title', name: 'Admission of a Partner', cards: 3 }] }] }] };
  assert.equal(findChapter(named, 'accountancy', 'Admission of a Partner')?.key, 'accountancy.x');
});

test('fixtures match the section 2e shapes', () => {
  const home = fixtureHome({ isPro: false });
  assert.deepEqual(Object.keys(home).sort(), ['enabled', 'isPro', 'subjects', 'today']);
  assert.deepEqual(Object.keys(home.today).sort(), ['due', 'minutes', 'newLeft', 'reviewsLeft']);
  const ch = home.subjects[0].units[0].chapters[0];
  assert.deepEqual(Object.keys(ch).sort(), ['added', 'cards', 'chip', 'due', 'key', 'mustKnow', 'ncert', 'state', 'title', 'unlocked']);
  assert.deepEqual(Object.keys(ch.state).sort(), ['fading', 'label', 'state']);
  const deck = fixtureDeck(CH1, { isPro: false });
  assert.deepEqual(Object.keys(deck).sort(), ['added', 'cards', 'chapter', 'counts']);
  assert.deepEqual(Object.keys(deck.chapter).sort(), ['chip', 'key', 'ncert', 'title', 'unit']);
  assert.deepEqual(Object.keys(deck.counts).sort(), ['locked', 'mustKnow', 'total']);
  const stub = deck.cards.find((c) => c.locked);
  assert.deepEqual(Object.keys(stub).sort(), ['id', 'kind', 'label', 'locked']);
  for (const card of Object.values(FIXTURE_DECKS).flat()) {
    assert.match(card.id, /^kc\.[a-z_]+\.[a-z0-9-]+\.[a-z_]+-[a-z0-9-]+$/, card.id);
    assert.ok(card.quote && (card.back === card.quote || card.quote.includes(card.back) || ['list', 'steps', 'types'].includes(card.kind)), card.id);
    for (const word of card.blanks) assert.ok(card.quote.includes(word), `${card.id} ${word}`);
    if (['term', 'key_line'].includes(card.kind)) assert.equal(card.front.split('____').length - 1, card.blanks.length, card.id);
  }
  assert.ok(['linked', 'matched'].includes(fixtureLine('q1').source));
  assert.deepEqual(fixtureLine('none-q'), { cards: [], source: 'none' });
  // The Pro reason line is data/chapter_state.js reasonLine, word for word.
  const proRow = fixtureChapters('business_studies', { isPro: true }).units[0].chapters[0];
  assert.equal(proRow.reason, '7 of 12 right on the latest try at each question. Cards: 14 of 20 holding');
  assert.deepEqual(Object.keys(fixtureChapters('business_studies', { isPro: true }).units[0].chapters[0]).sort(), ['available', 'fading', 'key', 'label', 'marksLost', 'memory', 'n', 'reason', 'right', 'state', 'title']);
  // Free never sees n, right, reason or memory.
  assert.equal(fixtureChapters('business_studies', { isPro: false }).units[0].chapters[0].reason, undefined);
});

test('fixture routes: off is 404 KEY_CARDS_OFF everywhere, Free over 10 reviews is 402 PRO_REQUIRED', () => {
  const url = (p) => new URL(p, 'http://x');
  assert.deepEqual(fixtureKeycards(url('/api/keycards'), 'GET', null, { variant: 'off' }), { status: 404, body: { error: 'KEY_CARDS_OFF' } });
  assert.equal(fixtureKeycards(url('/api/other'), 'GET', null, {}), null);
  const memory = {};
  let last;
  for (let i = 0; i < 11; i += 1) last = fixtureKeycards(url('/api/keycards/review'), 'POST', { cardId: 'c', rating: 3, mode: 'study' }, { isPro: false, memory });
  assert.deepEqual(last, { status: 402, body: { error: 'PRO_REQUIRED', reason: 'keycard_reviews' } });
  const pro = fixtureKeycards(url('/api/keycards/review'), 'POST', { cardId: 'c', rating: 4, mode: 'revise' }, { isPro: true, memory: {} });
  assert.equal(pro.body.ok, true);
  assert.ok(pro.body.next.due_at && Number.isFinite(pro.body.next.interval_days));
  // Free may add only taste cards one by one (data/keycards.js canAdd); none allowed is 402 with reason keycards.
  const locked = fixtureDeckView(FIXTURE_DECKS[CH1], false).find((c) => c.locked).id;
  assert.deepEqual(fixtureKeycards(url('/api/keycards/add'), 'POST', { cardIds: [locked], from: 'mistake' }, { isPro: false, memory: {} }), { status: 402, body: { error: 'PRO_REQUIRED', reason: 'keycards' } });
  assert.equal(fixtureKeycards(url('/api/keycards/add'), 'POST', { cardIds: [locked] }, { isPro: true, memory: {} }).body.added, 1);
  assert.equal(fixtureKeycards(url('/api/keycards/line?questionId=q1'), 'GET', null, { isPro: false, variant: 'line-limit' }).status, 402);
});

test('Revise plays Key cards after the other sources, in the server item shape, 15 seconds a card', () => {
  const items = fixtureReviseKeycards({ isPro: true });
  assert.equal(items.length, 3);
  // Exactly src/lib/server/keycards.js reviseSource on web/1031-kc-server: { kind: 'keycard', cardId, card }.
  for (const i of items) assert.deepEqual(Object.keys(i).sort(), ['card', 'cardId', 'kind']);
  assert.equal(itemKey(items[0]), `kc:${items[0].cardId}`);
  assert.equal(kindLine(items[0]).title, 'Key card');
  assert.equal(keycardMinutes(3), 1);
  assert.equal(keycardMinutes(0), 0);
  const merged = mergeQueue({ questions: [{ questionId: 'q', dueDay: '2026-10-30' }], keycards: items });
  assert.deepEqual(merged.items.map((i) => i.kind), ['question', 'keycard', 'keycard', 'keycard']);
  assert.equal(merged.counts.keycards, 3);
  assert.deepEqual(mixParts({ back: 0, checks: 0, cards: 0, keycards: 2 }).map((p) => p.text), ['2 Key cards']);
  assert.equal(filterSource(merged, 'keycards').items.length, 3);
  let run = startRun(merged.items);
  run = recordAnswer(run, items[0], { correct: true });
  run = recordAnswer(run, items[1], { correct: false });
  run = recordAnswer(run, items[1], { correct: true }); // a second report changes nothing
  assert.equal(summary(run).keycards, 2);
  assert.equal(Object.values(run.answers).filter((a) => a.kind === 'keycard' && !a.correct).length, 1);
  assert.equal(summary(startRun([])).keycards, undefined);
  // Off: no keycards key at all, so the four-source body reads as before.
  assert.equal('keycards' in mergeQueue({ questions: [] }).counts, false);
});

test('the Pro line is the spec line, with its own reason, and the copy is clean', () => {
  assert.equal(PRO_LINE, 'Pro opens every card in every chapter and keeps them on a schedule.');
  assert.ok(PLACEMENTS.includes('keycards'));
  assert.ok(TRIGGERS.includes('keycards'));
  assert.deepEqual(inlineCopy('keycards'), { text: PRO_LINE, action: 'See Pro', trigger: 'keycards' });
  assert.match(sheetHead('keycards').lede, /every card in every chapter/);
  assert.equal(benefitLines('keycards')[0].id, 'keycards');
  for (const text of [sheetHead('keycards').title, sheetHead('keycards').lede, ...benefitLines('keycards').map((l) => l.text)]) assert.doesNotMatch(text, FORBIDDEN, text);
});
