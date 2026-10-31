// The Must-know tier overlay (owner, 31 Oct 2026: "everything just has a must know mark"): scripts/keycards/tier.mjs builds
// data/keycards/tiers.json, loadDecks applies it after the sha256 check. Every count here is recomputed from the bundled
// decks, so a content pass that adds or drops cards changes nothing but the number the test reads back.
//   node --test data/tests/keycards_tiers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTiers, tasteIds, validTiers, KEYCARD_RULES } from '../keycards.js';
import { loadDecks } from '../../src/lib/server/keycards.js';
import { TIER_RULE, buildTiers, linkCounts, mustCount, readDecks, scoreCard } from '../../scripts/keycards/tier.mjs';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../keycards');
const { decks, links } = readDecks(DIR);
const tiers = JSON.parse(readFileSync(path.join(DIR, 'tiers.json'), 'utf8'));
const allCards = Object.values(decks).flatMap((d) => d.cards);
const byChapter = new Map();
for (const c of allCards) byChapter.set(c.chapterKey, [...(byChapter.get(c.chapterKey) || []), c]);
const authorMark = new Map(allCards.map((c) => [c.id, c.importance]));
const strip = (t) => ({ ...t, built: undefined });

test('mustCount: the top 25% rounded up, 6 at least, 40 at most, and a chapter of 6 or fewer keeps every card', () => {
  assert.equal(TIER_RULE.share, 0.25);
  assert.deepEqual([0, 1, 5, 6].map(mustCount), [0, 1, 5, 6]);
  assert.deepEqual([7, 24, 25, 26, 100].map(mustCount), [6, 6, 7, 7, 25]);
  assert.deepEqual([159, 160, 161, 164, 400].map(mustCount), [40, 40, 40, 40, 40]);
});

test('the score: 3 per linked question (3 at most), the kind weight, 1 for a Summary, Recap or Points to remember section', () => {
  const c = (kind, section) => ({ kind, source: { section } });
  assert.equal(scoreCard(c('definition', 'Why it matters'), 0), 4);
  assert.equal(scoreCard(c('definition', 'Summary'), 2), 4 + 6 + 1);
  assert.equal(scoreCard(c('fact', 'Recap'), 9), 1 + 9 + 1);
  assert.equal(scoreCard(c('example', 'Points to Remember'), 0), 1);
  assert.equal(scoreCard(c('example', 'x'), 0), 0);
  assert.equal(scoreCard(c('word', null), 0), 1, 'any other kind weighs 1');
  assert.equal(scoreCard(c('steps'), 1), 6);
  assert.deepEqual([...linkCounts({ q1: ['a', 'a', 'b'], q2: ['a'] })], [['a', 2], ['b', 1]], 'distinct questions per card');
});

test('tiers.json is current: rebuilding it from the decks and links gives the same file (rebuild with node scripts/keycards/tier.mjs)', () => {
  assert.equal(tiers.version, 1);
  assert.deepEqual(strip(buildTiers(decks, links)), strip(tiers), 'the decks or links changed: run node scripts/keycards/tier.mjs');
  assert.ok(validTiers(tiers));
  assert.ok(!Number.isNaN(Date.parse(tiers.built)));
  assert.deepEqual(Object.keys(tiers.must), [...Object.keys(tiers.must)].sort(), 'chapters sorted');
});

test('every chapter has exactly mustCount cards, the best-scoring ones, listed in book order', () => {
  assert.deepEqual([...byChapter.keys()].sort(), Object.keys(tiers.must));
  for (const [key, cards] of byChapter) {
    const ids = tiers.must[key];
    assert.equal(ids.length, mustCount(cards.length), key);
    assert.equal(new Set(ids).size, ids.length, key);
    const counts = linkCounts(links[cards[0].subject]);
    const score = new Map(cards.map((c) => [c.id, scoreCard(c, counts.get(c.id) || 0)]));
    const inSet = new Set(ids);
    const orders = ids.map((id) => cards.find((c) => c.id === id).order);
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b), `${key} in book order`);
    const worstIn = Math.min(...ids.map((id) => score.get(id)));
    for (const c of cards) if (!inSet.has(c.id)) assert.ok(score.get(c.id) <= worstIn, `${c.id} outranks a Must-know card`);
  }
  const must = Object.values(tiers.must).reduce((n, ids) => n + ids.length, 0);
  assert.ok(must / allCards.length > 0.2 && must / allCards.length < 0.3, `Must-know is ${Math.round((100 * must) / allCards.length)}% of the cards`);
});

test('loadDecks serves the overlay: in the chapter list is must, the rest good, the author\'s mark kept as authorImportance', () => {
  const loaded = loadDecks({ dir: DIR, log: (m) => assert.fail(m) });
  assert.deepEqual(loaded.disabled, [], 'every deck still matches its manifest sha256');
  assert.equal(loaded.byId.size, allCards.length);
  for (const c of allCards) {
    const served = loaded.byId.get(c.id);
    assert.equal(served.importance, tiers.must[c.chapterKey].includes(c.id) ? 'must' : 'good', c.id);
    assert.equal(served.authorImportance, authorMark.get(c.id), c.id);
  }
  // Nothing else about a card moves.
  const sample = allCards[7];
  const { importance, authorImportance, ...rest } = loaded.byId.get(sample.id);
  const { importance: wasImportance, ...was } = sample;
  assert.deepEqual(rest, was);
  assert.ok(importance && authorImportance && wasImportance);
});

test('the deck files and the manifest are untouched by the overlay', () => {
  const manifest = JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  for (const [subject, entry] of Object.entries(manifest)) {
    const text = readFileSync(path.join(DIR, 'decks', `${subject}.json`), 'utf8');
    assert.equal(createHash('sha256').update(text).digest('hex'), entry.sha256, subject);
  }
  assert.ok(allCards.some((c) => c.importance === 'must') && allCards.some((c) => c.importance === 'good'));
});

test('behaviours keyed off Must-know still hold at a quarter: every chapter keeps its Free taste, Pro Add chapter and Last look sets', () => {
  const served = [...loadDecks({ dir: DIR, log: () => {} }).byId.values()];
  const taste = tasteIds(served);
  for (const [key, cards] of byChapter) {
    const must = served.filter((c) => c.chapterKey === key && c.importance === 'must');
    assert.ok(must.length >= Math.min(cards.length, 6), `${key} has ${must.length} Must-know cards`);
    const open = served.filter((c) => c.chapterKey === key && taste.has(c.id));
    assert.equal(open.length, Math.min(cards.length, KEYCARD_RULES.free.tastePerChapter), `${key}: the Free taste finds ${KEYCARD_RULES.free.tastePerChapter}`);
  }
});

test('a missing or invalid tiers.json logs one warning and the authors\' marks stand; a chapter the overlay does not list keeps them too', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kc-tiers-'));
  try {
    cpSync(path.join(DIR, 'manifest.json'), path.join(tmp, 'manifest.json'));
    cpSync(path.join(DIR, 'decks'), path.join(tmp, 'decks'), { recursive: true });
    const run = () => { const logs = []; const l = loadDecks({ dir: tmp, log: (m) => logs.push(m) }); return { logs, l }; };
    let { logs, l } = run();
    assert.equal(logs.length, 1);
    assert.match(logs[0], /^\[keycards\] tiers\.json/);
    assert.equal(l.disabled.length, 0);
    assert.equal(l.byId.size, allCards.length);
    assert.ok([...l.byId.values()].every((c) => c.importance === authorMark.get(c.id) && !('authorImportance' in c)));
    for (const bad of ['{not json', JSON.stringify({ version: 2, must: {} }), JSON.stringify({ version: 1, must: { a: [1] } }), JSON.stringify({ version: 1 }), 'null']) {
      writeFileSync(path.join(tmp, 'tiers.json'), bad);
      ({ logs, l } = run());
      assert.equal(logs.length, 1, bad);
      assert.equal(l.byId.size, allCards.length);
    }
    // A valid file that lists one chapter tiers that chapter only.
    const key = 'english.vocabulary';
    writeFileSync(path.join(tmp, 'tiers.json'), JSON.stringify({ version: 1, must: { [key]: [byChapter.get(key)[0].id] } }));
    ({ logs, l } = run());
    assert.equal(logs.length, 0);
    const served = [...l.byId.values()];
    assert.equal(served.filter((c) => c.chapterKey === key && c.importance === 'must').length, 1);
    assert.ok(served.filter((c) => c.chapterKey !== key).every((c) => c.importance === authorMark.get(c.id)));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('applyTiers leaves cards alone without a valid overlay and never mutates its input', () => {
  const cards = [{ id: 'a', chapterKey: 'x.y', importance: 'must' }, { id: 'b', chapterKey: 'x.y', importance: 'must' }, { id: 'c', chapterKey: 'x.z', importance: 'good' }];
  assert.equal(applyTiers(cards, null), cards);
  assert.equal(applyTiers(cards, { version: 3, must: {} }), cards);
  const out = applyTiers(cards, { version: 1, must: { 'x.y': ['b'] } });
  assert.deepEqual(out.map((c) => [c.id, c.importance, c.authorImportance]), [['a', 'good', 'must'], ['b', 'must', 'must'], ['c', 'good', undefined]]);
  assert.equal(cards[0].importance, 'must');
});
