// Key cards web screens (KEYCARDS-BUILD-SPEC.md section 3): the pure words and shapes the screens share, the fixtures'
// match with the API contract of section 2e, the Revise queue's Key card source and the Pro line.
//   node --test data/tests/keycards_ui.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KIND_LABELS, PRO_LINE, RATINGS, backLines, chapterRef, countsLine, endCounts, findChapter, markBlanks, readingRows, slugChapter, sourceLine,
  splitBlanks, splitDeck, stateCue, todayLine,
} from '../../src/components/keycards/kinds.js';
import { FIXTURE_DECKS, fixtureChapters, fixtureDeck, fixtureDeckView, fixtureHome, fixtureKeycards, fixtureLine, fixtureReviseKeycards } from '../../src/components/keycards/fixtures.js';
import { estimateMinutes, filterSource, headLine, itemKey, kindLine, mixParts, recordAnswer, startRun, summary } from '../../src/components/revise/reviseQueue.js';
import { PLACEMENTS, TRIGGERS, benefitLines, inlineCopy, sheetHead } from '../../src/lib/proNudge.mjs';

const FORBIDDEN = /mastered|mastery|marks to recover|marks you could recover|!|·/i;

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

test('references say the book, chapter and page in words, never a middle dot', () => {
  assert.equal(sourceLine({ kind: 'ncert', book: 'Business Studies Part 1', chapterNo: 1, page: 3 }), 'Business Studies Part 1, chapter 1, page 3');
  assert.equal(sourceLine({ kind: 'wordnet' }), 'Meaning from WordNet');
  assert.equal(sourceLine(null), null);
  assert.equal(chapterRef({ book: 'Accountancy Part 2', chapter: 5 }), 'Accountancy Part 2, chapter 5');
});

test('Free reading: every locked stub is gathered into one quiet row where the first stood', () => {
  const view = fixtureDeckView(FIXTURE_DECKS['business_studies.nature-and-significance-of-management'], false);
  const rows = readingRows(view);
  const stubs = rows.filter((r) => r.stub);
  assert.equal(stubs.length, 1);
  assert.equal(stubs[0].stub, view.filter((c) => c.locked).length);
  assert.equal(splitDeck(view).open.length, 5);
  // Pro sees every card whole.
  assert.equal(readingRows(fixtureDeckView(FIXTURE_DECKS['business_studies.nature-and-significance-of-management'], true)).filter((r) => r.stub).length, 0);
});

test('chapter rows: counts and states in words, no percentage, no forbidden word', () => {
  assert.equal(countsLine({ cards: 38, unlocked: 5, due: 2 }, false), '5 of 38 open, 2 due');
  assert.equal(countsLine({ cards: 18, due: 6 }, true), '18 cards, 6 due');
  assert.equal(countsLine({ cards: 1, due: 0 }, true), '1 card');
  assert.equal(countsLine({ cards: 0 }, true), 'No cards yet');
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
  assert.equal(findChapter(home, 'business_studies', 'Nature and Significance of Management')?.cards, 26);
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
  const deck = fixtureDeck('business_studies.nature-and-significance-of-management', { isPro: false });
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
  assert.equal(fixtureLine('none-q').source, 'none');
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
});

test('Revise plays Key cards as a third source: its own key, 15 seconds a card, its own part of the mix', () => {
  const items = fixtureReviseKeycards({ isPro: true });
  assert.equal(items.length, 3);
  assert.equal(itemKey(items[0]), `kc:${items[0].cardId}`);
  assert.equal(kindLine(items[0]).title, 'A Key card');
  assert.equal(estimateMinutes([{ kind: 'question' }, { kind: 'question' }, { kind: 'keycard' }, { kind: 'keycard' }]), 2); // 40 + 40 + 15 + 15 = 110 s
  assert.equal(estimateMinutes([{ kind: 'keycard' }]), 1);
  assert.equal(estimateMinutes([]), 0);
  assert.equal(headLine(3, 1), '3 due today, about 1 minute.');
  assert.deepEqual(mixParts({ back: 0, checks: 0, cards: 0, keycards: 2 }).map((p) => p.text), ['2 Key cards']);
  const queue = { items: [{ kind: 'question', questionId: 'q' }, ...items], counts: {}, total: 4 };
  assert.equal(filterSource(queue, 'keycards').items.length, 3);
  let run = startRun(queue.items);
  run = recordAnswer(run, items[0], { correct: true });
  run = recordAnswer(run, items[1], { correct: false });
  run = recordAnswer(run, items[1], { correct: true }); // a second report changes nothing
  assert.equal(summary(run).keycards, 2);
  assert.equal(summary(run).keycardsMissed, 1);
  assert.equal(summary(startRun([])).keycards, undefined);
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
