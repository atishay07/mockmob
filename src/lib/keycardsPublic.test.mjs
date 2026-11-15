// The public Key card decks' pure model (src/lib/keycardsPublic.mjs) and words (src/components/keycards/public/publicDeckCopy.mjs).
// What is public is exactly a Free account's taste, whole, and nothing else of a chapter but its locked cards' kinds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDecks } from './server/keycards.js';
import { syllabusFrom } from './server/keycardsSyllabus.js';
import * as cuetSyllabus from '../../data/cuet_syllabus.js';
import { KIND_LABELS, deckView, tasteIds } from '../../data/keycards.js';
import { SUBJECT_PAGES } from './subjectPages.mjs';
import {
  KEY_CARDS_PATH, NO_DECKS, PUBLIC_CARD_FIELDS, appDeckPath, bookRef, buildPublicDecks, chapterDeck, chapterDescription, chapterSlugOf,
  chapterTitle, deckPath, lockedKinds, publicCard,
} from './keycardsPublic.mjs';
import {
  DECK_WORDS, cardOf, endLead, endTitle, freeCount, freeLine, indexFacts, lockedHead,
} from '../components/keycards/public/publicDeckCopy.mjs';

const DECKS = loadDecks({ log: () => {} });
const SYLLABUS = syllabusFrom(cuetSyllabus);
const real = (cardsOf = (s) => DECKS.bySubject.get(s)?.cards || []) => buildPublicDecks({
  pages: SUBJECT_PAGES, served: [...DECKS.bySubject.keys()], unitsFor: (s) => SYLLABUS.unitsFor(s, {}), cardsOf,
});

const mk = (i, over = {}) => ({
  id: `kc.business_studies.planning.c${String(i).padStart(2, '0')}`, v: 1, subject: 'business_studies', chapterKey: 'business_studies.planning',
  kind: i % 3 === 0 ? 'list' : 'definition', front: `Front ${i}`, back: `Back ${i}`, quote: `Quote ${i}`, blanks: [], importance: i <= 7 ? 'must' : 'good',
  order: i * 10, asked: 2, tags: ['x'], authorImportance: 'must', source: { kind: 'ncert', book: 'Business Studies Part 1', chapterNo: 4, page: 90 + i }, ...over,
});
const PLANNING = { key: 'business_studies.planning', title: 'Planning', unit: 'Planning', ncert: { book: 'Business Studies Part 1', chapter: 4 } };

test('the chapter slug is the chapter key without its subject; anything else is not a chapter', () => {
  assert.equal(chapterSlugOf('accountancy.partnership-fundamentals'), 'partnership-fundamentals');
  assert.equal(chapterSlugOf('business_studies.planning'), 'planning');
  for (const bad of ['', null, undefined, 'accountancy', 'accountancy.', '.planning', 'Accountancy.Planning', 'a.b/c', 'a.b c', 'a.-b', 'a.b--c', 'a.b.c']) {
    assert.equal(chapterSlugOf(bad), null, String(bad));
  }
  assert.equal(deckPath('business-studies', 'planning'), '/key-cards/business-studies/planning');
  assert.equal(appDeckPath('business_studies.planning'), '/cards/business_studies.planning');
  assert.equal(KEY_CARDS_PATH, '/key-cards');
});

test('a public card carries only the drawn fields', () => {
  const out = publicCard(mk(1, { texHtml: { front: '<b>x</b>' }, note: null }));
  assert.deepEqual(Object.keys(out).sort(), ['back', 'blanks', 'chapterKey', 'front', 'id', 'importance', 'kind', 'source', 'subject', 'texHtml']);
  for (const key of Object.keys(out)) assert.ok(PUBLIC_CARD_FIELDS.includes(key), key);
  assert.equal('quote' in out || 'asked' in out || 'tags' in out || 'authorImportance' in out, false);
});

test('a chapter: the Free taste whole (deckView, tasteIds), the rest only as kinds counted', () => {
  const cards = Array.from({ length: 12 }, (_, i) => mk(i + 1)).reverse();
  const deck = chapterDeck(PLANNING, cards);
  const taste = tasteIds(cards);
  assert.deepEqual(deck.open.map((c) => c.id), deckView(cards).filter((c) => !c.locked).map((c) => c.id), 'the Free deck view, in book order');
  assert.deepEqual(new Set(deck.open.map((c) => c.id)), taste);
  assert.equal(deck.open.length, 5);
  assert.deepEqual({ total: deck.total, mustKnow: deck.mustKnow, lockedCount: deck.lockedCount }, { total: 12, mustKnow: 7, lockedCount: 7 });
  assert.equal(deck.locked.reduce((n, k) => n + k.count, 0), 7);
  assert.deepEqual(deck.locked.map((k) => Object.keys(k).sort()), deck.locked.map(() => ['count', 'kind', 'label']), 'a locked card is its kind and label, never its words');
  const text = JSON.stringify(deck);
  for (const c of cards.filter((x) => !taste.has(x.id))) {
    assert.equal(text.includes(c.id), false, `${c.id} stays locked`);
    assert.equal(text.includes(`"${c.front}"`) || text.includes(`"${c.back}"`), false, `${c.id}'s words stay locked`);
  }
  assert.deepEqual(deck.ncert, { book: 'Business Studies Part 1', chapter: 4 });
});

test('a chapter with fewer Must-know cards shows what it has; with none, or retired, it has no page', () => {
  const three = [mk(1), mk(2), mk(3), mk(8), mk(9)];
  assert.equal(chapterDeck(PLANNING, three).open.length, 3);
  assert.equal(chapterDeck(PLANNING, [mk(8), mk(9)]), null, 'Good-to-know cards are never in the taste');
  assert.equal(chapterDeck(PLANNING, []), null);
  assert.equal(chapterDeck({ ...PLANNING, retired: true }, [mk(1)]), null);
  assert.equal(chapterDeck({ ...PLANNING, key: 'not a key' }, [mk(1)]), null);
});

test('locked kinds: most first, then the kinds\' own order, labels from the app', () => {
  const stubs = [{ kind: 'list', locked: true }, { kind: 'definition', locked: true }, { kind: 'list', locked: true }, { kind: 'term', locked: true }, { kind: 'definition', locked: true }, { id: 'x' }];
  assert.deepEqual(lockedKinds(stubs), [
    { kind: 'definition', label: 'Definition', count: 2 }, { kind: 'list', label: 'List', count: 2 }, { kind: 'term', label: 'Term', count: 1 },
  ]);
  assert.deepEqual(lockedKinds([]), []);
});

test('the real decks: every public chapter shows exactly a Free account\'s taste of its published cards, and addresses never collide', () => {
  const model = real();
  assert.ok(model.subjects.length >= 10, 'the served subjects have pages');
  const addresses = new Set();
  let cards = 0;
  for (const subject of model.subjects) {
    const page = SUBJECT_PAGES.find((p) => p.id === subject.id);
    assert.equal(subject.slug, page.slug, 'the public site\'s own subject slug');
    const published = DECKS.bySubject.get(subject.id).cards;
    for (const chapter of subject.chapters) {
      const list = published.filter((c) => c.chapterKey === chapter.key);
      assert.deepEqual(new Set(chapter.open.map((c) => c.id)), tasteIds(list), chapter.key);
      assert.ok(chapter.open.length >= 1 && chapter.open.length <= 5, chapter.key);
      assert.equal(chapter.total, list.length);
      assert.equal(chapter.lockedCount, list.length - chapter.open.length);
      assert.equal(chapter.open.every((c) => c.importance === 'must'), true);
      assert.equal(SYLLABUS.chapterByKey(chapter.key)?.retired, undefined, 'a live syllabus chapter');
      assert.equal(chapter.path, `/key-cards/${subject.slug}/${chapter.slug}`);
      assert.ok(!addresses.has(chapter.path), chapter.path);
      addresses.add(chapter.path);
      assert.equal(model.find(subject.slug, chapter.slug), chapter);
      cards += chapter.open.length;
    }
  }
  assert.equal(model.totals.cards, cards);
  assert.equal(model.totals.chapters, addresses.size);
  assert.equal(model.params().length, addresses.size);
  assert.equal(model.find('accountancy', 'no-such-chapter'), null);
  assert.equal(model.find('nope', 'partnership-fundamentals'), null);
  assert.equal(model.find('business_studies', 'planning'), null, 'the internal id is not an address');
  assert.equal(model.subjects.some((s) => s.id === 'gat'), false, 'no deck, no page');
});

test('a card suspended for everyone leaves the public taste the way it leaves a Free deck: the next Must-know card takes its place', () => {
  const before = real();
  const chapter = before.subjects[0].chapters[0];
  const gone = chapter.open[0].id;
  const after = real((s) => (DECKS.bySubject.get(s)?.cards || []).filter((c) => c.id !== gone)).find(chapter.subject.slug, chapter.slug);
  assert.equal(after.open.some((c) => c.id === gone), false);
  assert.equal(after.total, chapter.total - 1);
  const list = DECKS.bySubject.get(chapter.subject.id).cards.filter((c) => c.chapterKey === chapter.key && c.id !== gone);
  assert.deepEqual(new Set(after.open.map((c) => c.id)), tasteIds(list));
});

test('no served deck, no public page; the empty model has nothing', () => {
  assert.deepEqual(NO_DECKS.subjects, []);
  assert.deepEqual(NO_DECKS.params(), []);
  assert.deepEqual(NO_DECKS.totals, { subjects: 0, chapters: 0, cards: 0 });
});

test('the words: real numbers with their unit, sentence case, no exclamation marks, no arrows', () => {
  assert.equal(freeCount(5, 38), '5 of 38 cards free');
  assert.equal(freeCount(3, 3), 'All 3 cards free');
  assert.equal(freeLine(5, 38), '5 of this chapter’s 38 cards are free to read here, with no account.');
  assert.equal(freeLine(3, 3), 'All 3 cards in this chapter are free to read here, with no account.');
  assert.equal(freeLine(1, 1), 'This chapter’s one card is free to read here, with no account.');
  assert.equal(cardOf(2, 5), 'Card 2 of 5');
  assert.equal(endTitle(5), 'That’s the five.');
  assert.equal(endTitle(3), 'That’s all 3 free cards.');
  assert.equal(endTitle(1), 'That’s the free card.');
  assert.equal(lockedHead(33), '33 more cards in this chapter');
  assert.equal(lockedHead(1), '1 more card in this chapter');
  assert.equal(lockedHead(0), null);
  assert.equal(endLead({ open: 5, total: 38 }), 'A free account keeps these 5 in Revise, and your rating sets when each comes back. Pro opens all 38 cards in this chapter.');
  assert.equal(endLead({ open: 3, total: 3 }), 'A free account keeps these 3 in Revise, and your rating sets when each comes back.');
  assert.equal(endLead({ open: 5, total: 38, signedIn: true }), 'In Key cards, these 5 go into Revise, and your rating sets when each comes back.');
  assert.equal(indexFacts({ cards: 911, chapters: 183, subjects: 14 }), '911 cards free to read, from 183 chapters in 14 subjects.');
  const all = [...Object.values(DECK_WORDS), freeLine(5, 38), endLead({ open: 5, total: 38 }), endTitle(5), indexFacts({ cards: 2, chapters: 1, subjects: 1 })];
  for (const line of all) {
    assert.doesNotMatch(line, /[!→←⟶]|->|—|\p{Extended_Pictographic}/u, line);
    assert.equal(line[0], line[0].toUpperCase(), `sentence case: ${line}`);
  }
  assert.equal(DECK_WORDS.keepFree, 'Sign up free to keep these cards');
});

test('search words say what the page holds', () => {
  const model = real();
  const chapter = model.find('accountancy', 'partnership-fundamentals');
  assert.ok(chapter, 'Accountancy, Partnership fundamentals has a page');
  assert.equal(chapterTitle(chapter), `${chapter.title}, CUET Accountancy Key cards | MockMob`);
  const d = chapterDescription(chapter);
  assert.match(d, new RegExp(`^${chapter.open.length} of the ${chapter.total} Key cards for `));
  assert.match(d, /from NCERT Accountancy Part 1, chapter 1/);
  assert.ok(d.length <= 230, `${d.length} characters`);
  assert.equal(bookRef(null), null);
  assert.equal(bookRef({ book: 'Accountancy Part 1', chapter: 1 }), 'Accountancy Part 1, chapter 1');
  assert.equal(Object.keys(KIND_LABELS).length > 10, true);
});
