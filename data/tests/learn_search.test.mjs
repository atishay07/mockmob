// Learn v2 search (data/learn/search.js): chapters, lesson titles and Key cards (front, quote, kind) in one subject,
// 2+ characters, every word must match, match spans, and a locked card never returns its text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { queryWords, searchSubject, spans } from '../learn/search.js';
import { KIND_LABELS, lockedStub, tasteIds } from '../keycards.js';

const deck = JSON.parse(readFileSync(path.join(process.cwd(), 'data/keycards/decks/accountancy.json'), 'utf8')).cards;
const chapters = [...new Map(deck.map((c) => [c.chapterKey, { key: c.chapterKey, title: c.chapter, name: c.chapter, cards: deck.filter((x) => x.chapterKey === c.chapterKey).length }])).values()];
const lessons = [{ id: 'accountancy-revaluation', title: 'Revaluation of assets and liabilities', chapterKey: 'accountancy.admission-of-partner' }];
const base = { chapters, lessons, cards: deck, chapterTitle: (k) => chapters.find((c) => c.key === k)?.title, kindLabel: (k) => KIND_LABELS[k] };

test('two characters at least', () => {
  assert.deepEqual(queryWords('g'), []);
  assert.deepEqual(queryWords('  '), []);
  assert.deepEqual(queryWords('Go'), ['go']);
  const out = searchSubject({ ...base, query: 'g' });
  assert.equal(out.tooShort, true);
  assert.deepEqual([out.chapters, out.lessons, out.cards], [[], [], []]);
});

test('goodwill: the chapter, its cards, with spans on the matched words', () => {
  const out = searchSubject({ ...base, query: 'goodwill' });
  assert.equal(out.tooShort, false);
  assert.ok(out.chapters.some((c) => c.key === 'accountancy.goodwill-valuation'));
  assert.ok(out.cards.length > 10);
  assert.ok(out.cards.length <= 50);
  for (const r of out.cards) {
    const card = r.card;
    const fields = Object.keys(r.match);
    assert.ok(fields.length);
    for (const f of fields) {
      const text = f === 'kind' ? KIND_LABELS[card.kind] : card[f];
      for (const s of r.match[f]) assert.equal(text.slice(s.start, s.end).toLowerCase(), 'goodwill');
    }
    assert.ok(r.chapterTitle);
  }
  // A match in the front ranks above a match only in the quote.
  const firstQuoteOnly = out.cards.findIndex((r) => !r.match.front);
  const lastFront = out.cards.map((r) => Boolean(r.match.front)).lastIndexOf(true);
  if (firstQuoteOnly >= 0) assert.ok(firstQuoteOnly > 0 && lastFront >= 0);
});

test('every word must match; lessons are searched by title; kinds by their label', () => {
  const both = searchSubject({ ...base, query: 'revaluation account' });
  assert.ok(both.cards.every((r) => {
    const text = `${r.card.front} ${r.card.quote} ${KIND_LABELS[r.card.kind]}`.toLowerCase();
    return text.includes('revaluation') && text.includes('account');
  }));
  const lesson = searchSubject({ ...base, query: 'revaluation of assets' });
  assert.deepEqual(lesson.lessons.map((l) => l.id), ['accountancy-revaluation']);
  const kind = searchSubject({ ...base, query: 'formula' });
  assert.ok(kind.cards.some((r) => r.match.kind));
  assert.deepEqual(spans('Goodwill and GOODWILL', ['goodwill']), [{ start: 0, end: 8 }, { start: 13, end: 21 }]);
  assert.deepEqual(spans('abcabc', ['abc', 'bca']), [{ start: 0, end: 6 }]);
});

test('Free: open cards first with their text; a locked card comes back as its stub, never its words', () => {
  const taste = tasteIds(deck);
  const out = searchSubject({ ...base, query: 'partner', isOpen: (c) => taste.has(c.id), stub: lockedStub, limit: 500 });
  const open = out.cards.filter((r) => !r.locked);
  const locked = out.cards.filter((r) => r.locked);
  assert.ok(open.length > 0 && locked.length > 0);
  assert.ok(out.cards.findIndex((r) => r.locked) > open.length - 1, 'open first');
  for (const r of locked) {
    assert.equal(r.match, null);
    assert.equal(r.card.front, undefined);
    assert.equal(r.card.quote, undefined);
    assert.equal(r.card.locked, true);
  }
});

test('no match, and the overflow count past the limit', () => {
  const none = searchSubject({ ...base, query: 'zzzz qqqq' });
  assert.deepEqual([none.chapters.length, none.lessons.length, none.cards.length, none.more], [0, 0, 0, 0]);
  const many = searchSubject({ ...base, query: 'the', limit: 5 });
  assert.equal(many.cards.length, 5);
  assert.ok(many.more > 0);
});
