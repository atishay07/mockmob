// Learn v2: the Must-know re-tier (data/learn/mustknow.js, B5; CRITIQUE-1 E1 and E4). On the real decks about one card in
// four per chapter is Must-know (rule R2 of understand/R6-mustknow.md: 225 of 868 in Accountancy), every chapter keeps
// enough for the Free taste, a near-duplicate pair is never Must-know twice, and the deck files are not changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDecks } from '../../src/lib/server/keycards.js';
import { MUST_RULES, conceptOf, linkCounts, mustScore, mustTarget, mustTier, withMustTier } from '../learn/mustknow.js';
import { tasteIds, KEYCARD_RULES } from '../keycards.js';

const decks = loadDecks({ log: () => {} });
const tiered = withMustTier(decks);

test('targets: a quarter of the chapter, at least 6, at most 40, never more than the chapter has', () => {
  assert.deepEqual([46, 53, 164, 8, 16, 106, 4].map(mustTarget), [12, 13, 40, 6, 6, 27, 4]);
  assert.equal(MUST_RULES.share, 0.25);
});

test('score: links (capped at 3), kind and a Summary section', () => {
  assert.equal(mustScore({ kind: 'definition' }, 0), 4);
  assert.equal(mustScore({ kind: 'fact' }, 5), 3 * 3 + 1);
  assert.equal(mustScore({ kind: 'example', source: { section: 'Summary' } }, 1), 3 + 0 + 1);
});

test('one concept: "Define partnership." and "What is partnership?" are the same card twice', () => {
  assert.equal(conceptOf({ kind: 'definition', front: 'Define partnership.' }), conceptOf({ kind: 'definition', front: 'What is partnership?' }));
  assert.equal(conceptOf({ kind: 'term', front: 'Partners are called ____.' }), null);
  const a = { id: 'a', chapterKey: 'x.c', kind: 'definition', front: 'Define partnership.', order: 10, source: { chapterNo: 2 } };
  const b = { id: 'b', chapterKey: 'x.c', kind: 'definition', front: 'What is partnership?', order: 10, source: { chapterNo: 1 } };
  const rest = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, chapterKey: 'x.c', kind: 'fact', front: `Fact ${i}`, order: 20 + i, source: { chapterNo: 1 } }));
  const must = mustTier([a, b, ...rest]);
  assert.equal(must.has('b'), true, "the chapter's own source wins");
  assert.equal(must.has('a'), false);
});

test('the real decks: about one in four per chapter, R6 totals, Free taste still 5 per chapter', () => {
  const totals = {};
  for (const [subject, deck] of tiered.bySubject) {
    const byChapter = new Map();
    for (const c of deck.cards) {
      const row = byChapter.get(c.chapterKey) || { n: 0, must: 0 };
      row.n += 1;
      if (c.importance === 'must') row.must += 1;
      byChapter.set(c.chapterKey, row);
    }
    for (const [key, row] of byChapter) {
      assert.ok(row.must >= 1 && row.must <= MUST_RULES.max, `${key}: ${row.must} of ${row.n}`);
      if (row.n >= 24 && row.n <= 160) assert.ok(row.must / row.n >= 0.2 && row.must / row.n <= 0.3, `${key}: ${row.must} of ${row.n}`);
      if (row.n >= KEYCARD_RULES.free.tastePerChapter) assert.ok(row.must >= KEYCARD_RULES.free.tastePerChapter, `${key}: the Free taste needs 5`);
    }
    totals[subject] = deck.cards.filter((c) => c.importance === 'must').length;
    assert.equal(tasteIds(deck.cards).size, [...byChapter.values()].reduce((s, r) => s + Math.min(KEYCARD_RULES.free.tastePerChapter, r.must), 0));
  }
  assert.equal(totals.accountancy, 225);
  const pf = tiered.bySubject.get('accountancy').cards.filter((c) => c.chapterKey === 'accountancy.partnership-fundamentals');
  const adm = tiered.bySubject.get('accountancy').cards.filter((c) => c.chapterKey === 'accountancy.admission-of-partner');
  assert.equal(pf.filter((c) => c.importance === 'must').length, 12);
  assert.equal(adm.filter((c) => c.importance === 'must').length, 13);
  // E4: the off-chapter "Define partnership." (source Ch 2) is not Must-know beside "What is partnership?".
  const fronts = pf.filter((c) => c.importance === 'must').map((c) => c.front);
  assert.ok(fronts.includes('What is partnership?'));
  assert.ok(!fronts.includes('Define partnership.'));
});

test('the overlay copies: the deck objects, ids, links and the deck mark stay as they were', () => {
  const card = decks.bySubject.get('accountancy').cards[0];
  const copy = tiered.byId.get(card.id);
  assert.notEqual(copy, card);
  assert.equal(copy.deckImportance, card.importance);
  assert.equal(tiered.byId.size, decks.byId.size);
  assert.equal(tiered.links, decks.links);
  assert.equal(withMustTier(decks), tiered, 'memoised');
  assert.equal(withMustTier(tiered), tiered, 'idempotent');
  assert.ok(linkCounts(decks.links).size > 1000);
});
