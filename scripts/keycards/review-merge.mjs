#!/usr/bin/env node
// Key cards check 6 (KEYCARDS-CONTENT-SPEC.md section 5): merge the independent reviewers' verdicts.
//
//   node scripts/keycards/review-merge.mjs
//
// Input   ncert-books/reviews/<code>.json = [{ id, exact, important, unambiguous, importanceRight, reason }]
//         ncert-books/drafts/<code>.json  (the cards the reviewer saw; each verdict is tied to that exact content)
// Output  data/keycards/review-verdicts.json   { <cardId>: { ok, hash, reasons, code, at } }, read by validate.mjs
//         and, at once, any published card with a "no" moves from data/keycards/decks/<subject>.json to the quarantine
//         (deck version, coverage and manifest rewritten). Then run validate.mjs again (the pipeline's stage 4).
// Any `false` (or a missing answer) is a "no". A verdict for an id no draft has is reported and ignored.
// Malformed input (a review file that is not a JSON array of objects with a string id) exits 1 before anything is written.
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DRAFTS_DIR, OUT_DIR, REVIEWS_DIR, VERDICTS_FILE, cardHash, readJSON, writeJSON, writeManifest, writeSubject } from './lib.mjs';
import { readDrafts } from './validate.mjs';

const QUESTIONS = Object.freeze(['exact', 'important', 'unambiguous', 'importanceRight']);

/** Read every review file. Throws on malformed input. */
export function readReviews(dir = REVIEWS_DIR) {
  if (!existsSync(dir)) throw new Error(`reviews folder not found: ${dir}`);
  const errors = [];
  const out = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    let list;
    try { list = readJSON(path.join(dir, name)); } catch (e) { errors.push(`${name}: not JSON (${e.message})`); continue; }
    if (!Array.isArray(list)) { errors.push(`${name}: not an array`); continue; }
    list.forEach((v, i) => { if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !v.id) errors.push(`${name}[${i}]: no id`); });
    out.push({ code: name.replace(/\.json$/, ''), verdicts: list });
  }
  if (errors.length) throw Object.assign(new Error(`malformed reviews:\n  ${errors.join('\n  ')}`), { malformed: errors });
  return out;
}

/** One verdict -> { ok, reasons }. Every one of the four answers must be literally true. */
export function judge(v) {
  const no = QUESTIONS.filter((q) => v[q] !== true);
  const why = typeof v.reason === 'string' && v.reason.trim() ? v.reason.trim().slice(0, 300) : null;
  return { ok: no.length === 0, reasons: no.length ? [...no.map((q) => `not_${q}`), ...(why ? [why] : [])] : [] };
}

export function runReviewMerge({ draftsDir = DRAFTS_DIR, reviewsDir = REVIEWS_DIR, now = new Date(), log = console.log } = {}) {
  const reviews = readReviews(reviewsDir);
  const drafts = readDrafts(draftsDir);
  const cardById = new Map();
  for (const d of drafts) for (const c of d.cards) if (c && typeof c.id === 'string') cardById.set(c.id, c);
  const verdicts = readJSON(VERDICTS_FILE(), {});
  const unknown = [];
  let ok = 0;
  let no = 0;
  for (const { code, verdicts: list } of reviews) {
    for (const v of list) {
      const card = cardById.get(v.id);
      if (!card) { unknown.push(v.id); continue; }
      const j = judge(v);
      verdicts[v.id] = { ok: j.ok, hash: cardHash(card), reasons: j.reasons, code, at: now.toISOString() };
      if (j.ok) ok += 1; else no += 1;
    }
  }
  writeJSON(VERDICTS_FILE(), Object.fromEntries(Object.keys(verdicts).sort().map((k) => [k, verdicts[k]])));

  // Move every published card with a "no" into its subject's quarantine now.
  const manifest = {};
  const decksDir = path.join(OUT_DIR, 'decks');
  for (const name of existsSync(decksDir) ? readdirSync(decksDir).filter((f) => f.endsWith('.json') && !f.startsWith('_')) : []) {
    const deck = readJSON(path.join(decksDir, name));
    const failing = (deck.cards || []).filter((c) => verdicts[c.id] && !verdicts[c.id].ok);
    if (!failing.length) continue;
    const quarantine = readJSON(path.join(OUT_DIR, 'quarantine', name), { cards: [] });
    const moved = failing.map((c) => ({ ...c, reasons: verdicts[c.id].reasons.map((r) => `review:${r}`) }));
    const keep = deck.cards.filter((c) => !failing.includes(c));
    const rest = (quarantine.cards || []).filter((q) => !failing.some((c) => c.id === q.id));
    const coverage = readJSON(path.join(OUT_DIR, 'coverage', name), { chapters: {} });
    const notes = Object.fromEntries(Object.entries(coverage.chapters || {}).filter(([, r]) => r?.coverage_note).map(([k, r]) => [k, r.coverage_note]));
    manifest[deck.subject] = writeSubject(deck.subject, keep, [...rest, ...moved], notes);
  }
  if (Object.keys(manifest).length) writeManifest(manifest);
  const result = { reviewed: ok + no, passed: ok, failed: no, unknownIds: unknown, movedToQuarantine: manifest };
  log(JSON.stringify(result, null, 2));
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { runReviewMerge(); } catch (e) { console.error(e.message); process.exit(1); }
}
