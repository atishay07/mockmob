#!/usr/bin/env node
// Must-know tiers for Key cards (owner, 31 Oct 2026: "everything just has a must know mark").
//
//   node scripts/keycards/tier.mjs [--out=data/keycards/tiers.json] [--dir=data/keycards] [--print]
//
// The decks mark 68% of their cards "must" (an author judgement, never enforced), which makes the tag meaningless. This
// script re-tiers honestly WITHOUT touching the decks: importance is inside cardHash and each deck's sha256 must match
// manifest.json, so the deck files, the manifest and the verdicts stay as they are. It writes data/keycards/tiers.json, and
// loadDecks (src/lib/server/keycards.js) applies it after the sha256 check (data/keycards.js applyTiers), keeping the
// author's value as `authorImportance`.
//
// Score per card = 3 x min(linked questions, 3) + the kind's weight + 1 for a Summary / Recap / Points to remember section.
// Per chapter the Must-know cards are the top ceil(25%) by score, at least 6 and at most 40 (a chapter of 6 cards or fewer
// keeps every card), ties broken by book order. Deterministic: a second run writes the same file but for `built`.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const TIER_RULE = Object.freeze({ share: 0.25, min: 6, max: 40 });
export const TIER_RULE_TEXT = 'Per chapter, the top 25% of cards (at least 6, at most 40) by score = 3 x min(linked questions, 3) + kind weight + 1 for a Summary or Recap section; ties in book order';
export const KIND_WEIGHT = Object.freeze({
  definition: 4, formula: 4, steps: 3, difference: 3, list: 3, types: 2, entry: 2, key_line: 1, fact: 1, term: 1, example: 0,
});
const OTHER_KIND = 1;
const SUMMARY_SECTION = /summary|recap|points to remember/i;

const bookOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));

/** How many distinct questions link to each card: Map(card id -> n), from a links file { questionId: [cardId, ...] }. */
export function linkCounts(links) {
  const counts = new Map();
  for (const ids of Object.values(links || {})) for (const id of new Set(ids || [])) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

export function scoreCard(card, linked = 0) {
  return 3 * Math.min(linked, 3) + (KIND_WEIGHT[card.kind] ?? OTHER_KIND) + (SUMMARY_SECTION.test(card.source?.section || '') ? 1 : 0);
}

/** How many of a chapter's `n` cards are Must-know. */
export const mustCount = (n) => (n <= TIER_RULE.min ? n : Math.min(n, TIER_RULE.max, Math.max(TIER_RULE.min, Math.ceil(TIER_RULE.share * n))));

/** The Must-know ids of one chapter's cards, in book order. `counts` is Map(card id -> linked questions). */
export function mustOfChapter(cards, counts = new Map()) {
  const k = mustCount(cards.length);
  const ranked = [...cards].sort(bookOrder).map((c, i) => ({ c, i, s: scoreCard(c, counts.get(c.id) || 0) }));
  const top = ranked.sort((a, b) => b.s - a.s || a.i - b.i).slice(0, k).map((x) => x.c);
  return top.sort(bookOrder).map((c) => c.id);
}

/** { version, rule, built, must: { chapterKey: [card id, ...] } } over { subject: { cards } } and { subject: links }. */
export function buildTiers(decks, links, { built = new Date().toISOString() } = {}) {
  const by = new Map();
  for (const [subject, deck] of Object.entries(decks)) {
    const counts = linkCounts(links[subject]);
    for (const c of deck.cards || []) {
      if (!c?.id || c.subject !== subject) continue;
      if (!by.has(c.chapterKey)) by.set(c.chapterKey, []);
      by.get(c.chapterKey).push({ ...c, _n: counts.get(c.id) || 0 });
    }
  }
  const must = {};
  for (const key of [...by.keys()].sort()) {
    const cards = by.get(key);
    must[key] = mustOfChapter(cards, new Map(cards.map((c) => [c.id, c._n])));
  }
  return { version: 1, rule: TIER_RULE_TEXT, built, must };
}

/** Read the decks the manifest lists and their link files. */
export function readDecks(dir) {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const decks = {};
  const links = {};
  for (const subject of Object.keys(manifest).sort()) {
    decks[subject] = JSON.parse(readFileSync(path.join(dir, 'decks', `${subject}.json`), 'utf8'));
    const file = path.join(dir, 'links', `${subject}.json`);
    links[subject] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  }
  return { decks, links };
}

function main(argv) {
  const arg = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const dir = path.resolve(arg('dir') || path.join(ROOT, 'data/keycards'));
  const out = path.resolve(arg('out') || path.join(dir, 'tiers.json'));
  const { decks, links } = readDecks(dir);
  const tiers = buildTiers(decks, links);
  writeFileSync(out, `${JSON.stringify(tiers, null, 1)}\n`);
  const total = Object.values(decks).reduce((n, d) => n + d.cards.length, 0);
  const must = Object.values(tiers.must).reduce((n, ids) => n + ids.length, 0);
  console.log(`[tier] ${Object.keys(tiers.must).length} chapters, ${must} of ${total} cards Must-know (${Math.round((100 * must) / total)}%) -> ${path.relative(ROOT, out)}`);
  if (argv.includes('--print')) {
    for (const [subject, deck] of Object.entries(decks)) {
      const was = deck.cards.filter((c) => c.importance === 'must').length;
      const now = deck.cards.filter((c) => tiers.must[c.chapterKey]?.includes(c.id)).length;
      console.log(`${subject.padEnd(16)} ${String(deck.cards.length).padStart(5)} cards  was ${String(was).padStart(5)} (${Math.round((100 * was) / deck.cards.length)}%)  now ${String(now).padStart(5)} (${Math.round((100 * now) / deck.cards.length)}%)`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
