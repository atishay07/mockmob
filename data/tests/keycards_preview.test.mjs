// The development preview's real-deck source (&decks=real): off in production, kept out of the browser bundle, and faithful
// to the real decks; plus the display rules the real decks needed (src/components/keycards/kinds.js).
//   node --test data/tests/keycards_preview.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewAnswer, previewKeycards, previewOff } from '../../src/lib/server/keycardsPreview.js';
import {
  blocksOf, bookName, cardFace, chapterRef, deckOrigin, entryRows, formulaLines, ownMarker, sourceLine, startsMidSentence, withLead,
} from '../../src/components/keycards/kinds.js';

const FORBIDDEN = /mastered|mastery|marks to recover|marks you could recover|!|·/i;
const ask = (to, query = {}, method = 'GET', body) => new Request(`http://localhost/preview/arena/realdeck?${new URLSearchParams({ _to: to, ...query })}`, { method, body: body ? JSON.stringify(body) : undefined });

test('the real-deck source is off in a production build or deployment', async () => {
  assert.equal(previewOff({ NODE_ENV: 'production' }), true);
  assert.equal(previewOff({ NODE_ENV: 'development', VERCEL_ENV: 'production' }), true);
  assert.equal(previewOff({ NODE_ENV: 'development' }), false);
  const was = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await previewKeycards(ask('/api/keycards'));
    assert.equal(res.status, 404);
  } finally {
    process.env.NODE_ENV = was;
  }
});

test('the route imports the source only inside the NODE_ENV guard, and the browser side imports no deck', () => {
  const route = readFileSync(new URL('../../src/app/preview/arena/realdeck/route.js', import.meta.url), 'utf8');
  const guard = route.indexOf("if (process.env.NODE_ENV !== 'production') {");
  const load = route.indexOf("await import('@/lib/server/keycardsPreview')");
  assert.ok(guard > 0 && load > guard, 'the dynamic import sits inside the guard');
  assert.doesNotMatch(route.replace(/^\s*\/\/.*$/gm, ''), /^import /m, 'no static import that a production build would keep');
  for (const file of ['../../src/app/preview/arena/previewRealDecks.js', '../../src/app/preview/arena/ArenaPreviewClient.jsx']) {
    const imports = (readFileSync(new URL(file, import.meta.url), 'utf8').match(/^import [^;]+;/gm) || []).join('\n');
    assert.ok(imports || file.endsWith('previewRealDecks.js'));
    assert.doesNotMatch(imports, /keycards\/(decks|links)|keycardsPreview|lib\/server\/keycards/, `${file} pulls no deck into the browser`);
  }
});

test('home: the commerce and science students see their real subjects, chapters and today', async () => {
  const free = (await previewAnswer(ask('/api/keycards', { _plan: 'free', _student: 'commerce', _s: 'test-home' }))).body;
  assert.deepEqual(free.subjects.map((s) => s.subject), ['accountancy', 'business_studies', 'economics', 'english']);
  const ratios = free.subjects[0].units.flatMap((u) => u.chapters).find((c) => c.key === 'accountancy.accounting-ratios');
  assert.equal(ratios.cards, 165);
  assert.equal(ratios.unlocked, 5);
  assert.ok(free.today.due > 0 && free.today.reviewsLeft === 10);
  const science = (await previewAnswer(ask('/api/keycards', { _plan: 'pro', _student: 'science', _s: 'test-home' }))).body;
  assert.deepEqual(science.subjects.map((s) => s.subject), ['biology', 'political_science']);
  assert.equal(science.isPro, true);
  const fresh = (await previewAnswer(ask('/api/keycards', { _plan: 'free', _student: 'new', _s: 'test-home' }))).body;
  assert.equal(fresh.today.due, 0);
  assert.doesNotMatch(JSON.stringify(free.subjects.flatMap((s) => s.units.flatMap((u) => u.chapters.map((c) => c.state.label)))), FORBIDDEN);
});

test('deck, revise and the line you needed come from the real decks and links', async () => {
  const deck = (await previewAnswer(ask('/api/keycards/deck', { _plan: 'free', chapter: 'accountancy.accounting-ratios', _s: 'test-deck' }))).body;
  assert.deepEqual(deck.counts, { total: 165, mustKnow: deck.counts.mustKnow, locked: 160 });
  const first = 'kc.accountancy.accounting-ratios.fml-current-ratio';
  const led = (await previewAnswer(ask('/api/keycards/deck', { _plan: 'pro', chapter: 'accountancy.accounting-ratios', _first: first, _s: 'test-deck' }))).body;
  assert.equal(led.cards[0].id, first);
  assert.equal(led.cards.length, 165);
  const revise = (await previewAnswer(ask('revise', { _plan: 'pro', limit: 20, _s: 'test-revise' }))).body;
  assert.ok(revise.items.length > 0 && revise.items.every((i) => i.kind === 'keycard' && i.card?.id === i.cardId));
  const line = (await previewAnswer(ask('/api/keycards/line', { _plan: 'free', questionId: 'fixture-q2', _s: 'test-line' }))).body;
  assert.equal(line.source, 'linked');
  assert.ok(line.cards.length >= 1 && line.cards.every((c) => c.subject === 'accountancy'));
  assert.equal(line.left, 2);
  const review = await previewAnswer(ask('/api/keycards/review', { _plan: 'pro', _s: 'test-review' }, 'POST', { cardId: first, rating: 3, mode: 'study', clientReviewedAt: new Date().toISOString() }));
  assert.equal(review.http, 200);
  assert.ok(review.body.next.interval_days > 0);
});

test('one book name per NCERT book, and references that do not repeat the screen', () => {
  for (const book of ['Accountancy : Partnership Accounts', 'Accountancy – Partnership Accounts', 'Accountancy Part 1 (Partnership Accounts)']) {
    assert.equal(bookName({ kind: 'ncert', book, code: 'leac102' }), 'Accountancy Part 1');
  }
  assert.equal(sourceLine({ kind: 'ncert', book: 'Accountancy: Company Accounts and Analysis of Financial Statements', code: 'leac205', chapterNo: 5, page: 200 }), 'Accountancy Part 2, Ch 5, p. 200');
  assert.equal(sourceLine({ kind: 'ncert', book: 'Biology', code: 'lebo105', chapterNo: 5, page: 80 }), 'Biology, Ch 5, p. 80');
  assert.equal(sourceLine({ kind: 'authored' }), null);
  assert.equal(sourceLine({ kind: 'wordnet' }), 'Meaning from WordNet');
  assert.equal(chapterRef({ book: 'Politics in India since Independence', chapter: 7 }, { unit: 'Politics in India Since Independence' }), 'Ch 7');
  assert.equal(chapterRef({ book: 'Computerised Accounting System', chapter: null }, { title: 'Computerised Accounting System' }), null);
  assert.equal(chapterRef({ book: 'Accountancy Part 2', chapter: 5 }), 'Accountancy Part 2, Ch 5');
  assert.equal(deckOrigin([{ source: { kind: 'authored' } }, { source: { kind: 'wordnet' } }]), 'Written for MockMob, with some meanings from WordNet');
  assert.equal(deckOrigin([{ source: { kind: 'ncert' } }]), null);
});

test('real card shapes: entries, lists, formulas, kinds said once, the ellipsis on NCERT only', () => {
  assert.deepEqual(entryRows('Bank A/c Dr.\nTo Premium for Goodwill A/c\n(Amount brought by new partner as premium)'), [
    { kind: 'dr', text: 'Bank A/c' }, { kind: 'cr', text: 'To Premium for Goodwill A/c' }, { kind: 'note', text: '(Amount brought by new partner as premium)' },
  ]);
  assert.deepEqual(entryRows('Realisation A/c Dr. To Assets (Individually) A/c'), [{ kind: 'dr', text: 'Realisation A/c' }, { kind: 'cr', text: 'To Assets (Individually) A/c' }]);
  assert.deepEqual(entryRows('Debenture Suspense A/c\nDr.\n10,00,000\nTo 9% Debentures A/c'), [{ kind: 'dr', text: 'Debenture Suspense A/c', amount: '10,00,000' }, { kind: 'cr', text: 'To 9% Debentures A/c' }]);
  assert.equal(entryRows('Depreciation is a non-cash item. Therefore, this amount must be added back.'), null);
  assert.deepEqual(ownMarker('1. Liquidity Ratios'), ['1.', 'Liquidity Ratios']);
  assert.deepEqual(ownMarker('(iii) with standards set for that firm'), ['(iii)', 'with standards set for that firm']);
  assert.equal(ownMarker('A ratio is a mathematical number'), null);
  assert.equal(ownMarker('i.e. the same'), null);
  assert.deepEqual(formulaLines('Trade Receivable Turnover ratio\n= Net Credit Revenue from Operations/Average Trade Receivable'), [
    { lhs: 'Trade Receivable Turnover ratio', rhs: '= Net Credit Revenue from Operations/Average Trade Receivable' },
  ]);
  assert.deepEqual(cardFace({ kind: 'formula', front: 'Formula: Current ratio' }), { label: 'Formula', front: 'Current ratio' });
  assert.deepEqual(cardFace({ kind: 'entry', front: 'Journal entry: new partner brings premium for goodwill in cash.' }), { label: 'Journal entry', front: 'New partner brings premium for goodwill in cash.' });
  assert.deepEqual(cardFace({ kind: 'quote', front: 'Who said: “Tomorrow we shall be free”?' }), { label: 'Quote', front: 'Who said: “Tomorrow we shall be free”?' });
  assert.equal(startsMidSentence('affect', { source: { kind: 'authored' } }), false);
  assert.equal(withLead('the Western Ghats have', { source: { kind: 'ncert' } }), '…the Western Ghats have');
});

test('every real entry card reads as an entry or as a paragraph, never as a run-on', () => {
  const cards = JSON.parse(readFileSync(new URL('../keycards/decks/accountancy.json', import.meta.url), 'utf8')).cards.filter((c) => c.kind === 'entry');
  assert.ok(cards.length > 100);
  for (const c of cards) {
    const rows = entryRows(c.back);
    if (!rows) { assert.doesNotMatch(c.back, /\bDr\.?\s+To\s/, c.id); continue; }
    assert.ok(rows.some((r) => r.kind === 'dr' || r.kind === 'cr'), c.id);
    assert.ok(rows.every((r) => !/^Dr\.?$/.test(r.text)), `${c.id}: a lone Dr. joins its account`);
  }
});

test('units: headed only where the heading adds something', () => {
  const one = (unit, title = unit) => ({ unit, chapters: [{ key: title, title }] });
  // Every unit one chapter (Business Studies): one plain list.
  assert.deepEqual(blocksOf([one('Planning'), one('Business Finance', 'Financial Management')]).map((b) => b.unit), [null]);
  // Mixed (Economics): a group per unit, headed only for several chapters or another name.
  const econ = blocksOf([one('Money and Banking'), { unit: 'Current Challenges facing the Indian Economy', chapters: [{ key: 'a', title: 'Rural Development' }, { key: 'b', title: 'Employment' }] }, one('Open Economy Macroeconomics')]);
  assert.deepEqual(econ.map((b) => b.unit), [null, 'Current Challenges facing the Indian Economy', null]);
  assert.deepEqual(econ.map((b) => b.label), ['Money and Banking', 'Current Challenges facing the Indian Economy', 'Open Economy Macroeconomics']);
});
